'use strict';
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

class ImageProcessor {

    constructor(qrcodeFunctionName) {
        this.rekognition = new AWS.Rekognition({region: 'us-east-1'});
        this.lambda = new AWS.Lambda();
        this.qrcodeFunctionName = qrcodeFunctionName;
    }

    qrCodeDecode = context => new Promise((resolve, reject) => {
        console.log("qrCodeDecode");
        this.lambda.invoke({
            FunctionName: this.qrcodeFunctionName,
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

    detectLabels = context => new Promise((resolve, reject) => {
        console.log("detectLabels");
        if (!context.qrCode) {
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
            this.rekognition.detectLabels(params, (err, data) => {
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
}

module.exports = ImageProcessor;