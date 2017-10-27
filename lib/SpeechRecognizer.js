const fs = require('fs');

class SpeechRecognizer {
    constructor() {
        //process.env['GOOGLE_APPLICATION_CREDENTIALS'] = process.env['LAMBDA_TASK_ROOT']+"/googleAccount.json";

        this.speechClient = require('@google-cloud/speech')({
            keyFilename: process.env['LAMBDA_TASK_ROOT'] + '/googleAccount.json'
        });
    }

    getText(messagingEvent) {
        const file = fs.readFileSync(messagingEvent.filePathName);
        const audioBytes = file.toString('base64');

// The audio file's encoding, sample rate in hertz, and BCP-47 language code
        const audio = {
            content: audioBytes
        };
        const config = {
            encoding: 'FLAC',
            sampleRateHertz: 48000,
            languageCode: "yue-Hant-HK" //'yue-Hant-HK'
        };
        const request = {
            audio: audio,
            config: config
        };

        return new Promise((resolve, reject) => {
                this.speechClient.recognize(request)
                    .then((data) => {
                        const response = data[0];
                        console.log(data);
                        const transcription = response.results.map(result =>
                            result.alternatives[0].transcript).join('\n');
                        console.log(`Transcription: ${transcription}`);
                        messagingEvent.message.text = transcription;
                        resolve(messagingEvent);
                    })
                    .catch((err) => {
                        console.error('ERROR:', err);
                    });
            }
        );
    }

}

module.exports = SpeechRecognizer;