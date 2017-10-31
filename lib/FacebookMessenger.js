const https = require('https');

class FacebookMessenger {
    constructor(pageToken) {
        this.pageToken = pageToken;
    }

    sendTextMessage(senderFbId, text) {
        return new Promise((resolve, reject) => {
            let json = {
                recipient: {id: senderFbId},
                message: {text},
            };
            console.log("sendTextMessage");
            this._sendMessage(senderFbId, json, resolve, reject);
        });
    }

    sendVoiceMessage(senderFbId, url) {
        return new Promise((resolve, reject) => {
            let json = {
                recipient: {id: senderFbId},
                message: {
                    attachment: {
                        type: 'audio',
                        payload: {
                            url,
                            is_reusable: true
                        }
                    }
                }
            };
            console.log("sendVoiceMessage");
            this._sendMessage(senderFbId, json, resolve, reject);
        });
    }

    _sendMessage(senderFbId, json, resolve, reject) {
        let body = JSON.stringify(json);
        let path = '/v2.6/me/messages?access_token=' + this.pageToken;
        let options = {
            host: "graph.facebook.com",
            path: path,
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        };
        let callback = response => {
            let str = '';
            response.on('data', chunk => {
                str += chunk;
                console.log(str);
            });
            response.on('end', () => {
                resolve(`Sent message ${senderFbId}: \n${body}`);
            });
        };
        let req = https.request(options, callback);
        req.on('error', e => {
            console.log('problem with request: ' + e);
            reject(e)
        });
        req.write(body);
        req.end();
    }
}

module.exports = FacebookMessenger;