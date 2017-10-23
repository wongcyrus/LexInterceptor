const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

class LexController {

    constructor(botName, botAlias) {
        this.botName = botName;
        this.botAlias = botAlias;
        this.lexruntime = new AWS.LexRuntime({
            region: 'us-east-1' //change to your region
        });
    }

    postText = messagingEvent => new Promise((resolve, reject) => {
        console.log("postText");
        let params = {
            botAlias: this.botAlias,
            botName: this.botName,
            inputText: messagingEvent.message.text,
            userId: messagingEvent.sender.id,
            sessionAttributes: {}
        };
        console.log(params);
        this.lexruntime.postText(params, (err, data) => {
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

}

module.exports = LexController;