'use strict';

class GoogleTranslator {
    constructor(googleApiKey) {
        this.googleTranslate = require('google-translate')(googleApiKey);
    }

    translateRequest = messagingEvent => new Promise((resolve, reject) => {
        console.log("translateRequest");
        let text = messagingEvent.message.text;
        this.googleTranslate.translate(text, "en", (error, translation) => {
            if (error) {
                console.log('error', error);
                reject(error);
            }
            console.log(`${text} translate to ${translation.translatedText}`);
            messagingEvent.message.originalText = text;
            messagingEvent.message.text = translation.translatedText;
            resolve(messagingEvent);
        });
    });

    translateReply = (messagingEvent) => new Promise((resolve, reject) => {
        console.log("translateReply");
        let text = messagingEvent.message.reply;
        console.log(messagingEvent.message.language);
        console.log(text);
        this.googleTranslate.translate(text, messagingEvent.message.language, (error, translation) => {
            if (error) {
                console.log('error', error);
                reject(error);
            }
            console.log(`${text} translate to ${translation.translatedText}`);
            messagingEvent.message.originaRepy = text;
            messagingEvent.message.reply = translation.translatedText;
            resolve(messagingEvent);
        });
    });


    detectLanguage = messagingEvent => new Promise((resolve, reject) => {
        console.log("detectLanguage");
        let text = messagingEvent.message.text;
        this.googleTranslate.detectLanguage(text, (error, detection) => {
            if (error) {
                console.log('error', error);
                reject(error);
            }
            console.log(`User language is ${detection.language}`);
            messagingEvent.message.language = detection.language;
            resolve(messagingEvent);
        });
    });
}

module.exports = GoogleTranslator;