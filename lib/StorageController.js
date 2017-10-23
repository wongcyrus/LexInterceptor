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

    downloadImage = url => new Promise((resolve, reject) => {
        console.log("downloadImage");
        let options = {
            url,
            dest: '/tmp'
        };
        this.download.image(options)
            .then(({filename, image}) => {
                console.log('File saved to', filename);
                resolve({url, filename});
            }).catch((err) => {
            console.log(err);
            reject("Sorry, we ran into a problem at our end.");
        });
    });

    uploadToS3 = context => new Promise((resolve, reject) => {
        console.log("uploadToS3");
        let fileBuffer = fs.readFileSync(context.filename);
        let params = {Bucket: this.imageBucket, Key: context.filename, Body: fileBuffer};
        this.s3.upload(params, (err, data) => {
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
}

module.exports = StorageController;