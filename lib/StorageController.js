'use strict';
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const fs = require("fs");

class StorageController {

    constructor(imageBucket) {
        this.download = require('image-downloader');
        this.s3 = new AWS.S3();
        this.imageBucket = imageBucket;
    }

    downloadToTmp(link) {
        return new Promise((resolve, reject) => {
            console.log("downloadToTmp");
            let options = {
                url: link,
                dest: '/tmp'
            };
            this.download.image(options)
                .then(({filename, content}) => {
                    console.log('File saved to', filename);
                    let url = require("url");
                    let path = require("path");
                    let parsed = url.parse(link);
                    let key = path.basename(parsed.pathname);
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

            let params = {Bucket: this.imageBucket, Key: context.Key, Body: fileBuffer};
            this.s3.upload(params, (err, data) => {
                console.log(err, data);
                if (err) {
                    console.log(err, err.stack); // an error occurred
                    reject("Sorry, we ran into a problem at our end.");
                } else {
                    console.log(data);
                    context.bucket = this.imageBucket;
                    resolve(context)
                }
            });
        })
    };
}

module.exports = StorageController;