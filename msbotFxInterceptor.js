"use strict";
const GoogleTranslator = require('./lib/GoogleTranslator');
const SessionTracker = require("./lib/SessionTracker");
const LexController = require("./lib/LexController");
const request = require('superagent');

const BOT_ALIAS = process.env.BOT_ALIAS;
const BOT_NAME = process.env.BOT_NAME;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME;
const ALLOWED_LANGUAGES = process.env.ALLOWED_LANGUAGES;

const MS_BOT_FRAMEWORK_APP_ID = process.env.MS_BOT_FRAMEWORK_APP_ID;
const MS_BOT_FRAMEWORK_APP_PASSWORD = process.env.MS_BOT_FRAMEWORK_APP_PASSWORD;

const googleTranslator = new GoogleTranslator(GOOGLE_API_KEY, ALLOWED_LANGUAGES);
const lexController = new LexController(BOT_NAME, BOT_ALIAS);
const sessionTracker = new SessionTracker(SESSION_TABLE_NAME);

exports.handler = (event, context, callback) => {
    console.log(JSON.stringify(event));

    const body = JSON.parse(event.body);
    const headers = event.headers;
    console.log(JSON.stringify(body));
    console.log(JSON.stringify(headers));

    if (body.text) {
        const receivedMessage = body.text;

        let messagingEvent = {
            message: {
                text: receivedMessage
            },
            sender: {
                id: body.from.id
            },
            recipient: {
                id: body.recipient.id
            }
        };

        googleTranslator.detectLanguage(messagingEvent)
            .then(c => sessionTracker.restoreLastSession(c))
            .then(c => googleTranslator.translateRequest(c))
            .then(c => lexController.postText(c))
            .then(c => sessionTracker.saveCurrentSession(c))
            .then(c => googleTranslator.translateReply(c))
            .then(() => getToken())
            .then(
                token => {
                    console.log(token);
                    console.log(JSON.stringify(messagingEvent));
                    return sendReplyMessage(headers, body, token, messagingEvent.message.reply)
                }
            ).then(result => {
            console.log(result);
            callback(null, createResponse(200, "ok"));
        }).catch(reason => {
            console.log(reason);
            console.log("Call back with Error");
            callback(null, createResponse(200, reason));
        });
    } else if (body.attachments) {
        getToken()
            .then(
                token => {
                    console.log(token);
                    return sendReplyMessage(headers, body, token, "Sorry attachment is not support at this moment!")
                }
            ).then(result => {
            console.log(result);
            callback(null, createResponse(200, "ok"));
        }).catch(reason => {
            console.log(reason);
            console.log("Call back with Error");
            callback(null, createResponse(200, reason));
        });
    } else {
        console.log("Unknown message data!");
        callback(null, createResponse(200, "Unknown message data!"));
    }

};

const getToken = () => new Promise((resolve, reject) => {
    let payload = `grant_type=client_credentials&client_id=${MS_BOT_FRAMEWORK_APP_ID}&client_secret=${MS_BOT_FRAMEWORK_APP_PASSWORD}&scope=https%3A%2F%2Fapi.botframework.com%2F.default`;
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
                resolve(r.access_token);
            } catch (ex) {
                console.log(ex);
                reject(ex);
            }
        });
});
const sendReplyMessage = (headers, body, token, message) => new Promise((resolve, reject) => {
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
    request
        .post(body.serviceUrl + `/v3/conversations/${body.conversation.id}/activities/${body.id}`)
        .type('application/json')
        .set('Authorization', "Bearer " + token)
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
});

const createResponse = (statusCode, body) => {
    return {
        statusCode: statusCode,
        body: body
    }
};
