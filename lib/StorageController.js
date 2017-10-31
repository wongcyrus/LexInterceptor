'use strict';
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const fs = require("fs");
const mime = require('mime-types');

class StorageController {

    constructor(attachmentBucket) {
        this.download = require('image-downloader');
        this.s3 = new AWS.S3();
        this.attachmentBucket = attachmentBucket;
    }

    downloadToTmp(link, key) {
        return new Promise((resolve, reject) => {
            console.log("downloadToTmp");
            if (!key) {
                let url = require("url");
                let path = require("path");
                let parsed = url.parse(link);
                key = path.basename(parsed.pathname);
            }

            let options = {
                url: link,
                dest: '/tmp/' + key
            };
            this.download.image(options)
                .then(({filename, content}) => {
                    console.log('File saved to', filename);
                    resolve({url: link, filePathName: filename, Key: key});
                }).catch((err) => {
                console.log(err);
                reject("Sorry, we ran into a problem at our end.");
            });
        })
    };

    uploadToS3(context) {
        return new Promise((resolve, reject) => {
            console.log("uploadToS3");
            let fileBuffer = fs.readFileSync(context.filePathName);

            let params = {
                Bucket: this.attachmentBucket,
                Key: context.Key,
                Body: fileBuffer,
                ContentType: mime.contentType(context.Key)
            };
            this.s3.upload(params, (err, data) => {
                console.log(err, data);
                if (err) {
                    console.log(err, err.stack); // an error occurred
                    reject("Sorry, we ran into a problem at our end.");
                } else {
                    console.log(data);
                    context.bucket = this.attachmentBucket;
                    resolve(context)
                }
            });
        })
    };
}

module.exports = StorageController;