'use strict';
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const fs = require('fs');
const urlencode = require('urlencode');
const randomstring = require("randomstring");

const StorageController = require("./StorageController");

class TextSpeechController {

    constructor(synthesizeSpeechLanguageHints) {
        this.polly = new AWS.Polly({region: "us-east-1"});
        this.storageController = new StorageController();
        console.log(synthesizeSpeechLanguageHints);
        this.synthesizeSpeechLanguageHints = JSON.parse(synthesizeSpeechLanguageHints.replace('\\', ''));
        console.log("synthesizeSpeechLanguageHints", this.synthesizeSpeechLanguageHints);
    }

    getSpeech(messagingEvent) {
        let key = messagingEvent.sender.id + "_" + Date.now() + "_"
            + randomstring.generate({
                length: 12,
                charset: 'alphabetic'
            })
            + "_reply.mp3";
        messagingEvent.filePathName = "/tmp/" + key;
        messagingEvent.Key = key;
        return this._getPollyLanguageCodes()
            .then(pollyVoices => new Promise((resolve, reject) => {
                    let pollyVoice = pollyVoices.filter(v => v.LanguageCode === messagingEvent.message.language);
                let pollyVoiceLanguage = pollyVoices.filter(v => v.LanguageCode.substring(0, 2) === messagingEvent.message.language.substring(0, 2));
                    if (pollyVoice.length > 1)
                        resolve(pollyVoice[0].Id);
                    else if (pollyVoiceLanguage.length > 1)
                        resolve(pollyVoiceLanguage[0].Id);
                    else
                        resolve();
                })
            ).then(
                pollyVoiceId => {
                    if (pollyVoiceId) {
                        console.log("Polly with Voice " + pollyVoiceId);
                        return this._getPollySpeech(messagingEvent, pollyVoiceId)
                            .then(this._saveToBufferToFile);
                    } else {
                        console.log("Responsive Voice");
                        return this._getResponsiveVoiceSpeech(messagingEvent)
                            .then(downloadToTmpContent => new Promise((resolve, reject) => {
                                messagingEvent.filePathName = downloadToTmpContent.filePathName;
                                messagingEvent.Key = downloadToTmpContent.Key;
                                resolve(messagingEvent);
                            }));
                    }
                });
    }

    _getPollyLanguageCodes() {
        return new Promise((resolve, reject) => {
            this.polly.describeVoices({}, (err, data) => {
                if (err) reject(err, err.stack); // an error occurred
                else resolve(data.Voices.filter(c => c.Gender === "Female"));           // successful response
            });
        });
    }

    _saveToBufferToFile(messagingEvent) {
        return new Promise((resolve, reject) => {
            fs.writeFile(messagingEvent.filePathName, messagingEvent.buffer, (err) => {
                if (err) return reject(err);
                //delete  messagingEvent["buffer"];
                resolve(messagingEvent);
            })
        });
    }

    _getResponsiveVoiceSpeech(messagingEvent) {
        let urlText = urlencode.encode(messagingEvent.message.reply);
        let languageHint = this.synthesizeSpeechLanguageHints[messagingEvent.message.language.substring(0, 2)];
        let langCode = languageHint || messagingEvent.message.language;

        console.log("_getResponsiveVoiceSpeech");
        console.log(this.synthesizeSpeechLanguageHints, messagingEvent.message.language.substring(0, 2));

        return this.storageController.downloadToTmp(
            `https://responsivevoice.org/responsivevoice/getvoice.php?t=${urlText}&tl=${langCode}`,
            messagingEvent.Key);
    }

    _getPollySpeech(messagingEvent, voiceId) {
        let params = {
            LexiconNames: [],
            OutputFormat: "mp3",
            SampleRate: "8000",
            Text: messagingEvent.message.reply,
            TextType: "text",
            VoiceId: voiceId
        };
        return new Promise((resolve, reject) => {
            this.polly.synthesizeSpeech(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else {
                    if (data.AudioStream instanceof Buffer) {
                        messagingEvent.buffer = data.AudioStream;
                        resolve(messagingEvent);
                    }
                    reject("No AudioStream!");
                }
            });
        }).then(this._saveToBufferToFile);
    }
}

module.exports = TextSpeechController;