"use strict";
const GoogleTranslator = require('./lib/GoogleTranslator');
const ImageProcessor = require('./lib/ImageProcessor');
const StorageController = require("./lib/StorageController");
const LexController = require("./lib/LexController");
const SimpleTableController = require("./lib/SimpleTableController");
const SessionTracker = require("./lib/SessionTracker");
const AudioConverter = require("./lib/AudioFormatConverter");
const SpeechRecognizer = require("./lib/SpeechRecognizer");
const TextSpeechController = require("./lib/TextSpeechController");
const MsBotMessenger = require("./lib/MsBotMessenger");

const QRCODE_FUNCTION = process.env.QRCODE_FUNCTION;
const BOT_ALIAS = process.env.BOT_ALIAS;
const BOT_NAME = process.env.BOT_NAME;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ATTACHMENT_BUCKET = process.env.ATTACHMENT_BUCKET;
const VOICE_BUCKET = process.env.VOICE_BUCKET;
const VOICE_SITE_URL = process.env.VOICE_SITE_URL;
const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME;
const IMAGE_TABLE = process.env.IMAGE_TABLE;
const ALLOWED_LANGUAGES = process.env.ALLOWED_LANGUAGES;
const SPEECH_RECOGNIZE_LANGUAGE = process.env.SPEECH_RECOGNIZE_LANGUAGE;
const SYNTHESIZE_SPEECH_LANGUAGE_HINTS = process.env.SYNTHESIZE_SPEECH_LANGUAGE_HINTS;
const MS_BOT_FRAMEWORK_APP_ID = process.env.MS_BOT_FRAMEWORK_APP_ID;
const MS_BOT_FRAMEWORK_APP_PASSWORD = process.env.MS_BOT_FRAMEWORK_APP_PASSWORD;

const googleTranslator = new GoogleTranslator(GOOGLE_API_KEY, ALLOWED_LANGUAGES);
const lexController = new LexController(BOT_NAME, BOT_ALIAS);
const sessionTracker = new SessionTracker(SESSION_TABLE_NAME);
const msBotMessenger = new MsBotMessenger(MS_BOT_FRAMEWORK_APP_ID, MS_BOT_FRAMEWORK_APP_PASSWORD);

const sha1 = require('sha1');
const fs = require('fs');
const mime = require('mime-types');

exports.handler = (event, context, callback) => {
    console.log(JSON.stringify(event));

    const body = JSON.parse(event.body);
    const headers = event.headers;
    console.log(JSON.stringify(body));
    console.log(JSON.stringify(headers));
    let messagingEvent = {
        sender: {
            id: body.from.id
        },
        recipient: {
            id: body.recipient.id
        }
    };

    let process;

    if (body.text) {
        const receivedMessage = body.text;
        messagingEvent.message = {
            text: receivedMessage
        };

        process = googleTranslator.detectLanguage(messagingEvent)
            .then(c => sessionTracker.restoreLastSession(c))
            .then(c => googleTranslator.translateRequest(c));

    } else if (body.attachments) {
        messagingEvent.message = {
            text: ""
        };
        let imageLinks = body.attachments
            .filter(c => c.contentType.startsWith("image/"))
            .map(c => {
                return {contentUrl: c.contentUrl, contentType: c.contentType}
            });

        let audioLinks = body.attachments
            .filter(c => c.contentType.startsWith("video/mp4") || c.contentType.startsWith("audio/aac") || c.contentType.startsWith("audio/ogg"))
            .map(c => {
                return {contentUrl: c.contentUrl, contentType: c.contentType}
            });

        if (audioLinks.length === 1) {
            console.log("Audio links: " + audioLinks);
            process = processAudio(audioLinks[0])
                .then(voice => new Promise((resolve, reject) => {
                        messagingEvent.message = voice.message;
                        if (messagingEvent.message.text !== "") {
                            msBotMessenger.sendTextMessage(headers, body, "You: " + messagingEvent.message.text);
                            resolve(messagingEvent);
                        } else {
                            msBotMessenger.sendTextMessage(headers, body, "Sorry, I cannot recognize your speech!");
                            reject("Cannot recognize Audio.");
                        }
                    }
                ))
                .then(c => googleTranslator.detectLanguage(c))
                .then(c => sessionTracker.restoreLastSession(c))
                .then(c => googleTranslator.translateRequest(c));
        } else if (imageLinks.length > 0) {
            console.log("Image links: " + imageLinks);
            process = Promise.all(imageLinks.map(processImage))
                .then(imageData => new Promise((resolve, reject) => {
                        messagingEvent.imageData = imageData;
                        let sessionAttributes = messagingEvent.sessionAttributes || {};
                        if (sessionAttributes.currentSlot) {
                            console.log("Save currentSlot translated text for Images");
                            sessionAttributes["original_" + sessionAttributes.currentSlot] = "" + imageLinks;
                            sessionAttributes["translated_" + sessionAttributes.currentSlot] = "" + imageLinks;
                        }
                        resolve(messagingEvent);
                    }
                )).then(c => sessionTracker.restoreLastSession(c))
                .then(saveImageDataToSessionTable);
        } else {
            console.log("Unsupported file type!");
            callback(null, createResponse(200, "Unsupported file type!"));
        }
    } else {
        console.log("Unknown message data!");
        callback(null, createResponse(200, "Unknown message data!"));
    }

    if (process) {
        let textSpeechController = new TextSpeechController(SYNTHESIZE_SPEECH_LANGUAGE_HINTS);
        let storageController = new StorageController(VOICE_BUCKET);
        process.then(c => lexController.postText(c))
            .then(c => sessionTracker.saveCurrentSession(c))
            .then(c => googleTranslator.translateReply(c))
            .then(c => textSpeechController.getSpeech(c))
            .then(c => storageController.uploadToS3(c))
            .then(messagingEvent => {
                console.log("sendTextMessage", messagingEvent);
                let voiceUrl = VOICE_SITE_URL + "/" + messagingEvent.Key;
                return msBotMessenger.sendVoiceMessage(headers, body, voiceUrl)
                    .then(msBotMessenger.sendTextMessage(headers, body, messagingEvent.message.reply));
            }).then(result => {
            console.log(result);
            callback(null, createResponse(200, "ok"));
        }).catch(reason => {
            console.log(reason);
            console.log("Call back with Error");
            callback(null, createResponse(200, reason));
        });
    }
};

const saveImageDataToSessionTable = (messagingEvent) => {
    return new Promise((resolve, reject) => {
        //Save into Session and send send "OK" to Lex.
        let sessionAttributes = messagingEvent.sessionAttributes ? messagingEvent.sessionAttributes : {};
        //Lex sessionAttributes does not support tree like json!
        sessionAttributes.imageData = "true";
        messagingEvent.sessionAttributes = sessionAttributes;

        let imageTable = new SimpleTableController(IMAGE_TABLE);
        imageTable.put({id: messagingEvent.sender.id, data: messagingEvent.imageData})
            .then(data => {
                messagingEvent.message = {text: "OK", language: googleTranslator.getDefaultLanguages()};
                resolve(messagingEvent);
            }).catch(reject);
    });
};

const processImage = imageLink => {
    console.log("processImage:" + imageLink.contentUrl);
    let imageProcessor = new ImageProcessor(QRCODE_FUNCTION, ATTACHMENT_BUCKET);
    let storageController = new StorageController(ATTACHMENT_BUCKET);

    const key = sha1(imageLink.contentUrl) + "." + mime.extension(imageLink.contentType);

    return storageController.downloadToTmp(imageLink.contentUrl, key)
        .then(c => storageController.uploadToS3(c, imageLink.contentType))
        .then(c => imageProcessor.qrCodeDecode(c))
        .then(c => imageProcessor.detectLabels(c));
};

const processAudio = audioLink => {
    console.log("processAudio:" + audioLink);
    let audioConverter = new AudioConverter();
    let storageController = new StorageController(ATTACHMENT_BUCKET);
    let speechRecognizer = new SpeechRecognizer(GOOGLE_API_KEY, SPEECH_RECOGNIZE_LANGUAGE);

    let ext = mime.extension(audioLink.contentType);
    if (!ext)
        ext = audioLink.contentType.split("/")[1];
    const key = sha1(audioLink.contentUrl) + "." + ext;

    return storageController.downloadToTmp(audioLink.contentUrl, key)
        .then(c => storageController.uploadToS3(c, audioLink.contentType))
        .then(c => audioConverter.convertToLinear16(c))
        .then(c => storageController.uploadToS3(c))
        .then(c => speechRecognizer.getText(c));
};

const createResponse = (statusCode, body) => {
    return {
        statusCode: statusCode,
        body: body
    }
};
