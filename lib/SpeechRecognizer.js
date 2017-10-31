const request = require('superagent');
const base64 = require('file-base64');

class SpeechRecognizer {

    constructor(apiKey, languageCode) {
        this.apiKey = apiKey;
        this.languageCode = languageCode;
    }

    _convertAudioToText(filePathName) {
        console.log("_convertAudioToText: " + filePathName);
        const getBase64String = () => new Promise((resolve, reject) => {
            base64.encode(filePathName, (err, base64String) => {
                if (err) reject(err);
                console.log("Base64 OK");
                resolve(base64String);
            });
        });
        const getText = base64String => new Promise((resolve, reject) => {
            let payload = {
                config: {
                    languageCode: this.languageCode
                },
                audio: {
                    content: base64String
                }
            };
            request
                .post('https://speech.googleapis.com/v1/speech:recognize')
                .type('application/json;')
                .parse(request.parse.text)
                .query({key: this.apiKey})
                .send(payload)
                .timeout(10000)
                .end((err, res) => {
                    if (err) return reject(err);
                    try {
                        let r = JSON.parse(res.text);
                        console.log(JSON.stringify(r));
                        resolve(r.results);
                    } catch (ex) {
                        console.log(ex);
                        reject(ex);
                    }
                });
        });
        return getBase64String()
            .then(getText);
    };

    getText(messagingEvent) {
        console.log("getText");

        const isEmpty = obj => {
            for (let key in obj) {
                if (obj.hasOwnProperty(key))
                    return false;
            }
            console.log("isEmpty true.");
            return true;
        };

        return new Promise((resolve, reject) => {
            this._convertAudioToText(messagingEvent.filePathName)
                .then(results => {
                        console.log(JSON.stringify(results));
                        if (results && !isEmpty(results))
                            messagingEvent.message = {text: results[0].alternatives[0].transcript};
                        else
                            messagingEvent.message = {text: ""};
                        resolve(messagingEvent);
                    }
                ).catch(reject);
            }
        );
    }

}

module.exports = SpeechRecognizer;