'use strict';
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const https = require('https');
const download = require('image-downloader');
const fs = require("fs");
const lambda = new AWS.Lambda();
const s3 = new AWS.S3();

const PAGE_TOKEN = process.env.PAGE_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const QRCODE_FUNCTION = process.env.QRCODE_FUNCTION;
const BOT_ALIAS = process.env.BOT_ALIAS;
const BOT_NAME = process.env.BOT_NAME;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET;

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
    if (messagingEvent.message.attachments) {   //Facebook Attachments
        let imageLinks = messagingEvent.message.attachments.map(c => c.payload.url);
        console.log("Receive links: " + imageLinks);
        Promise.all(imageLinks.map(processImage))
            .then(data => sendTextMessage(messagingEvent.sender.id, JSON.stringify(data)))
            .then(resolve)
            .catch(reject);
    } else {
        if (messagingEvent.message && messagingEvent.message.text) {
            let text = messagingEvent.message.text;
            console.log("Receive a message: " + text);
            detectLanguage(messagingEvent)
                .then(translateRequest)
                .then(callLex)
                .then(translateReply)
                .then(messagingEvent => sendTextMessage(messagingEvent.sender.id, messagingEvent.message.reply))
                .then(resolve)
                .catch(reject);
        }
    }
});

const createResponse = (statusCode, body) => {
    return {
        statusCode: statusCode,
        body: body
    }
};

const processImage = imageLink => {
    console.log("processImage:" + imageLink);
    return downloadImage(imageLink)
        .then(uploadToS3)
        .then(qrCodeDecode)
        .then(detectLabels);
};


const translateRequest = messagingEvent => new Promise((resolve, reject) => {
    console.log("translateRequest");
    let googleTranslate = require('google-translate')(GOOGLE_API_KEY);
    let text = messagingEvent.message.text;
    googleTranslate.translate(text, "en", (error, translation) => {
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

const translateReply = (messagingEvent) => new Promise((resolve, reject) => {
    console.log("translateReply");
    let googleTranslate = require('google-translate')(GOOGLE_API_KEY);
    let text = messagingEvent.message.reply;
    console.log(messagingEvent.message.language);
    console.log(text);
    googleTranslate.translate(text, messagingEvent.message.language, (error, translation) => {
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


const detectLanguage = messagingEvent => new Promise((resolve, reject) => {
    console.log("detectLanguage");
    let googleTranslate = require('google-translate')(GOOGLE_API_KEY);
    let text = messagingEvent.message.text;
    googleTranslate.detectLanguage(text, (error, detection) => {
        if (error) {
            console.log('error', error);
            reject(error);
        }
        console.log(`User language is ${detection.language}`);
        messagingEvent.message.language = detection.language;
        resolve(messagingEvent);
    });
});


const callLex = messagingEvent => new Promise((resolve, reject) => {
    console.log("callLex");
    let lexruntime = new AWS.LexRuntime({
        region: 'us-east-1' //change to your region
    });
    let params = {
        botAlias: BOT_ALIAS,
        botName: BOT_NAME,
        inputText: messagingEvent.message.text,
        userId: messagingEvent.sender.id,
        sessionAttributes: {}
    };
    console.log(params);
    lexruntime.postText(params, (err, data) => {
        if (err) {
            console.log(err, err.stack); // an error occurred
            reject("Sorry, we ran into a problem at our end.");
        } else {
            console.log(data);           // got something back from Amazon Lex
            messagingEvent.message.reply = data.message;
            resolve(messagingEvent)
        }
    });
});

const qrCodeDecode = context => new Promise((resolve, reject) => {
    console.log("qrCodeDecode");
    lambda.invoke({
        FunctionName: QRCODE_FUNCTION,
        Payload: JSON.stringify(context.url) // pass params
    }, (error, data) => {
        if (error) {
            console.log('error', error);
            reject(error);
        }
        let qrcodeText = data.Payload;
        console.log(data);
        if (qrcodeText !== '""')
            context.qrCode = qrcodeText;
        resolve(context);
    });
});

const downloadImage = url => new Promise((resolve, reject) => {
    console.log("downloadImage");
    let options = {
        url,
        dest: '/tmp'
    };
    download.image(options)
        .then(({filename, image}) => {
            console.log('File saved to', filename);
            resolve({url, filename});
        }).catch((err) => {
        console.log(err);
        reject("Sorry, we ran into a problem at our end.");
    });
});

const uploadToS3 = context => new Promise((resolve, reject) => {
    console.log("uploadToS3");
    let fileBuffer = fs.readFileSync(context.filename);
    let params = {Bucket: IMAGE_BUCKET, Key: context.filename, Body: fileBuffer};
    s3.upload(params, (err, data) => {
        console.log(err, data);
        if (err) {
            console.log(err, err.stack); // an error occurred
            reject("Sorry, we ran into a problem at our end.");
        } else {
            console.log(data);
            resolve(context)
        }
    });
});

const detectLabels = context => new Promise((resolve, reject) => {
    console.log("detectLabels");
    if (!context.qrCode) {
        let rekognition = new AWS.Rekognition({region: 'us-east-1'});
        let params = {
            Image: {
                S3Object: {
                    Bucket: IMAGE_BUCKET,
                    Name: context.filename
                }
            },
            MaxLabels: 15,
            MinConfidence: 70
        };
        rekognition.detectLabels(params, (err, data) => {
            if (err) reject(err, err.stack); // an error occurred
            else {
                console.log(data);           // successful response
                context.labels = data.Labels;
                resolve(context);
            }
        });
    } else
        resolve(context);
});

const sendTextMessage = (senderFbId, text) => new Promise((resolve, reject) => {
    let json = {
        recipient: {id: senderFbId},
        message: {text: text},
    };
    let body = JSON.stringify(json);
    let path = '/v2.6/me/messages?access_token=' + PAGE_TOKEN;
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
        });
        response.on('end', () => {
            resolve(`Sent message ${senderFbId}: \n${text}`);
        });
    };
    let req = https.request(options, callback);
    req.on('error', e => {
        console.log('problem with request: ' + e);
        reject(e)
    });
    req.write(body);
    req.end();
});