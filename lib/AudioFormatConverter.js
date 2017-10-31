'use strict';
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const execute = require('lambduh-execute');

class AudioConverter {

    constructor() {
        process.env['PATH'] = process.env['PATH'] + ':/tmp/:' + process.env['LAMBDA_TASK_ROOT'];
    }

    convertToLinear16(context) {
        console.log("convertToLinear16", context);
        return this._setupffmpeg()
            .then(c => this._toLinear16(context))
    }

    _setupffmpeg() {
        console.log("Set up ffmpeg.");
        let result = {};
        return execute(result, {
            shell: `cp /var/task/lib/ffmpeg /tmp/.; chmod 755 /tmp/ffmpeg; `, // copies an ffmpeg binary to /tmp/ and chmod permissions to run it
            logOutput: true
        });
    }

    _toLinear16(context) {
        console.log("_toLinear16", context);
        let filePathIn = context.filePathName;
        let filePathOut = context.filePathName.split("?")[0].replace(".mp4", ".flac").replace(".aac", ".flac");
        return new Promise((resolve, reject) => {
            if (!filePathIn || !filePathOut) {
                reject('You must specify a path for both input and output files.');
            }
            if (!fs.existsSync(filePathIn)) {
                reject('Input file must exist.');
            }
            if (filePathIn.indexOf('.mp4') > -1 || filePathIn.indexOf('.aac') > -1) {
                try {
                    ffmpeg(filePathIn)
                        .outputOptions(['-ac 1', '-ar 16000']) //1 channel, sampleRate 16.000
                        .save(filePathOut)
                        .on('error', (err) => {
                            console.log('An error occurred: ' + err.message);
                            reject(err);
                        })
                        .on('end', (stdout, stderr) => {
                            console.log(stdout);
                            console.log(stderr);
                            context.sourceFilePathName = context.filePathName;
                            context.filePathName = filePathOut;
                            context.Key = context.Key.replace(".mp4", ".flac");
                            resolve(context);
                        });

                } catch (e) {
                    reject(e);
                }
            } else {
                reject('File must have audio mp4 or aac');
            }
        });
    }
}

module.exports = AudioConverter;