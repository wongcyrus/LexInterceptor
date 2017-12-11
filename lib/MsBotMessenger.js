const request = require('superagent');

let tokenObject;

class MsBotMessenger {
    constructor(appId, password) {
        this.appId = appId;
        this.password = password;
    }

    getToken() {
        return new Promise((resolve, reject) => {
            if (!tokenObject || tokenObject.expireTime < Date.now()) {
                console.log("Get new token!");
                let payload = `grant_type=client_credentials&client_id=${this.appId}&client_secret=${this.password}&scope=https%3A%2F%2Fapi.botframework.com%2F.default`;
                request
                    .post("https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token")
                    .type('application/x-www-form-urlencoded')
                    .parse(request.parse.text)
                    .send(payload)
                    .timeout(10000)
                    .end((err, res) => {
                        if (err) return reject(err);
                        try {
                            let r = JSON.parse(res.text);
                            console.log(JSON.stringify(r));
                            tokenObject = r;
                            let t = new Date();
                            t.setSeconds(t.getSeconds() + r.expires_in - 100);
                            tokenObject.expireTime = t;
                            resolve(r.access_token);
                        } catch (ex) {
                            console.log(ex);
                            reject(ex);
                        }
                    });
            } else {
                console.log("Use cached token!");
                resolve(tokenObject.access_token);
            }
        });
    }

    sendTextMessage(headers, body, message) {
        return new Promise((resolve, reject) => {
            let payload = {
                type: "message",
                from: {
                    id: body.recipient.id,
                    name: body.recipient.name
                },
                conversation: {
                    id: body.conversation.id,
                    name: body.conversation.name,
                },
                recipient: {
                    id: body.from.id,
                    name: body.from.name
                },
                text: message,
                replyToId: body.id
            };
            this._sendMessage(body, payload, reject, resolve);
        });
    }

    sendVoiceMessage(headers, body, url) {
        return new Promise((resolve, reject) => {
            let payload = {
                type: "message",
                from: {
                    id: body.recipient.id,
                    name: body.recipient.name
                },
                conversation: {
                    id: body.conversation.id,
                    name: body.conversation.name,
                },
                recipient: {
                    id: body.from.id,
                    name: body.from.name
                },
                attachments: [
                    {
                        contentType: "audio/mpeg3",
                        contentUrl: url
                    }
                ],
                replyToId: body.id
            };
            this._sendMessage(body, payload, reject, resolve);
        });
    }

    _sendMessage(body, payload, reject, resolve) {
        this.getToken().then(() => {
                request
                    .post(body.serviceUrl + `/v3/conversations/${body.conversation.id}/activities/${body.id}`)
                    .type('application/json')
                    .set('Authorization', "Bearer " + tokenObject.access_token)
                    .parse(request.parse.text)
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
            }
        ).catch(ex => {
            console.log(ex);
            reject(ex);
        });
    }
}

module.exports = MsBotMessenger;