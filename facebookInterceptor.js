'use strict';
const GoogleTranslator = require('./lib/GoogleTranslator');
const ImageProcessor = require('./lib/ImageProcessor');
const StorageController = require("./lib/StorageController");
const LexController = require("./lib/LexController");
const SimpleTableController = require("./lib/SimpleTableController");
const SessionTracker = require("./lib/SessionTracker");
const AudioConverter = require("./lib/AudioFormatConverter");
const SpeechRecognizer = require("./lib/SpeechRecognizer");
const TextSpeechController = require("./lib/TextSpeechController");
const FacebookMessenger = require("./lib/FacebookMessenger");

const PAGE_TOKEN = process.env.PAGE_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
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


exports.handler = (event, context, callback) => {
    console.log(JSON.stringify(event));

    if (event.queryStringParameters) {
        console.log("Handle Verification.");
        // process GET request
        let queryParams = event.queryStringParameters;
        let rVerifyToken = queryParams['hub.verify_token'];

        if (rVerifyToken === VERIFY_TOKEN) {
            let challenge = queryParams['hub.challenge'];
            callback(null, createResponse(200, parseInt(challenge)))
        } else {
            callback(null, createResponse(500, 'Error, wrong validation token'));
        }
    } else {
        console.log("Handle Facebook Chat.");
        // process POST request
        let body = JSON.parse(event.body);
        console.log(JSON.stringify(body));

        //Flat Map
        let messagingEvents = body.entry.reduce((list, x) => list.concat(x.messaging), []);

        Promise.all(messagingEvents.map(processMessage))
            .then(values => {
                console.log("Call back without Error");
                console.log(JSON.stringify(values));
                callback(null, createResponse(200, JSON.stringify(values)));
            }).catch(reason => {
            console.log(reason);
            console.log("Call back with Error");
            callback(null, createResponse(200, reason));
        });
    }
};


const processMessage = messagingEvent => new Promise((resolve, reject) => {
    console.log(JSON.stringify(messagingEvent));
    let googleTranslator = new GoogleTranslator(GOOGLE_API_KEY, ALLOWED_LANGUAGES);
    let lexController = new LexController(BOT_NAME, BOT_ALIAS);
    let sessionTracker = new SessionTracker(SESSION_TABLE_NAME);
    let facebookMessenger = new FacebookMessenger(PAGE_TOKEN);

    let process;
    if (messagingEvent.message.attachments) {   //Facebook Attachments

        let attachments = messagingEvent.message.attachments;
        console.log("attachments", JSON.stringify(attachments));

        let imageLinks = attachments
            .filter(c => c.type === "image")
            .map(c => c.payload.url);

        let audioLinks = attachments
            .filter(c => c.type === "audio")
            .map(c => c.payload.url);

        if (audioLinks.length === 1) {
            console.log("Audio links: " + audioLinks);
            process = processAudio(audioLinks[0])
                .then(voice => new Promise((resolve, reject) => {
                        messagingEvent.message = voice.message;
                        if (messagingEvent.message.text !== "") {
                            facebookMessenger.sendTextMessage(messagingEvent.sender.id, "You: " + messagingEvent.message.text);
                            resolve(messagingEvent);
                        } else {
                            facebookMessenger.sendTextMessage(messagingEvent.sender.id, "Sorry, I cannot recognize your speech!");
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
            reject("Unsupported file type!");
        }
    } else {
        if (messagingEvent.message && messagingEvent.message.text) {
            let text = messagingEvent.message.text;
            console.log("Receive a message: " + text);
            process = googleTranslator.detectLanguage(messagingEvent)
                .then(c => sessionTracker.restoreLastSession(c))
                .then(c => googleTranslator.translateRequest(c));
        }
    }
    if (process) {
        let textSpeechController = new TextSpeechController();
        let storageController = new StorageController(VOICE_BUCKET);
        process.then(c => lexController.postText(c))
            .then(c => sessionTracker.saveCurrentSession(c))
            .then(c => googleTranslator.translateReply(c))
            .then(c => textSpeechController.getSpeech(c))
            .then(c => storageController.uploadToS3(c))
            .then(messagingEvent => {
                console.log("sendTextMessage", messagingEvent);
                let voiceUrl = VOICE_SITE_URL + "/" + messagingEvent.Key;
                return facebookMessenger.sendVoiceMessage(messagingEvent.sender.id, voiceUrl)
                    .then(facebookMessenger.sendTextMessage(messagingEvent.sender.id, messagingEvent.message.reply));
            })
            .then(resolve)
            .catch(reject);
    }
});

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
                messagingEvent.message = {text: "OK", language: "en"};
                resolve(messagingEvent);
            }).catch(reject);
    });
};

const processImage = imageLink => {
    console.log("processImage:" + imageLink);
    let imageProcessor = new ImageProcessor(QRCODE_FUNCTION, ATTACHMENT_BUCKET);
    let storageController = new StorageController(ATTACHMENT_BUCKET);
    return storageController.downloadToTmp(imageLink)
        .then(c => storageController.uploadToS3(c))
        .then(c => imageProcessor.qrCodeDecode(c))
        .then(c => imageProcessor.detectLabels(c));
};

const processAudio = audioLink => {
    console.log("processAudio:" + audioLink);
    let audioConverter = new AudioConverter();
    let storageController = new StorageController(ATTACHMENT_BUCKET);
    let speechRecognizer = new SpeechRecognizer(GOOGLE_API_KEY, SPEECH_RECOGNIZE_LANGUAGE);

    return storageController.downloadToTmp(audioLink)
        .then(c => storageController.uploadToS3(c))
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
