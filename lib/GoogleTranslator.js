'use strict';

class GoogleTranslator {
    constructor(googleApiKey, allowedLanguages) {
        this.googleTranslate = require('google-translate')(googleApiKey);
        this.allowedLanguages = allowedLanguages.split(',');
    }

    translateRequest(messagingEvent) {
        return new Promise((resolve, reject) => {
            console.log("translateRequest");
            let text = messagingEvent.message.text;
            this.googleTranslate.translate(text, "en", (error, translation) => {
                if (error) {
                    console.log('error', error);
                    reject(error);
                }
                console.log(`${text} translate to ${translation.translatedText}`);
                messagingEvent.message.originalRequest = text;
                messagingEvent.message.text = translation.translatedText;

                let sessionAttributes = messagingEvent.sessionAttributes ? messagingEvent.sessionAttributes : {};
                if (sessionAttributes.currentSlot) {
                    console.log("Save currentSlot translated text!");
                    sessionAttributes["original_" + sessionAttributes.currentSlot] = text;
                    sessionAttributes["translated_" + sessionAttributes.currentSlot] = translation.translatedText;
                }

                messagingEvent.sessionAttributes = sessionAttributes;

                resolve(messagingEvent);
            });
        })
    };

    translateReply(messagingEvent) {
        return new Promise((resolve, reject) => {
            console.log("translateReply");
            let text = messagingEvent.message.reply;
            console.log("Language: " + messagingEvent.message.language);
            console.log("Text: " + text);
            this.googleTranslate.translate(text, messagingEvent.message.language, (error, translation) => {
                if (error) {
                    console.log('error', error);
                    reject(error);
                }
                if (translation.translatedText) {
                    console.log(`${text} translate to ${translation.translatedText}`);
                    messagingEvent.message.originaRepy = text;
                    messagingEvent.message.reply = translation.translatedText;
                } else {
                    messagingEvent.message.originaRepy = text;
                    messagingEvent.message.reply = text;
                }

                let sessionAttributes = messagingEvent.sessionAttributes ? messagingEvent.sessionAttributes : {};
                sessionAttributes.originaRepy = text;
                sessionAttributes.translatedReply = messagingEvent.message.reply;
                messagingEvent.sessionAttributes = sessionAttributes;

                resolve(messagingEvent);
            });
        })
    };

    detectLanguage(messagingEvent) {
        return new Promise((resolve, reject) => {
            console.log("detectLanguage");
            let text = messagingEvent.message.text;
            this.googleTranslate.detectLanguage(text, (error, detection) => {
                if (error) {
                    console.log('error', error);
                    reject(error);
                }
                console.log(detection);
                if (detection.language === "und" || detection.confidence < 0.5)
                    messagingEvent.message.language = "en";
                else {
                    let lang = detection.language.substring(0, 2);
                    let finalLanguages = this.allowedLanguages.filter(l => l.startsWith(lang));
                    console.log(lang, finalLanguages);
                    if (finalLanguages.length === 0)
                        messagingEvent.message.language = this.allowedLanguages[0];
                    else
                        messagingEvent.message.language = finalLanguages[0];
                }
                console.log("Final Language: " + messagingEvent.message.language);
                resolve(messagingEvent);
            });
        })
    };
}

module.exports = GoogleTranslator;