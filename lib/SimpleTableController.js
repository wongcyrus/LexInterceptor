'use strict';
const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const dynamo = new AWS.DynamoDB.DocumentClient();

class SimpleTableController {

    constructor(tablename) {
        this.tablename = tablename;
    }

    get(id) {
        return new Promise((resolve, reject) => {
            console.log("get");
            let params = {
                TableName: this.tablename,
                Key: {id}
            };
            let dbGet = (params) => {
                return dynamo.get(params).promise()
            };

            dbGet(params).then((data) => {
                if (!data.Item) {
                    resolve(undefined);
                }
                console.log(`RETRIEVED ${this.tablename} ITEM SUCCESSFULLY WITH ${JSON.stringify(data.Item)}`);
                resolve(data.Item);
            }).catch((err) => {
                console.log(`GET ITEM FAILED FOR doc = ${params.Key.id}, WITH ERROR: ${err}`);
                reject(err);
            });
        })
    };

    put(item) {
        return new Promise((resolve, reject) => {
            console.log("put");
            let params = {
                TableName: this.tablename,
                Item: item
            };

            let dbPut = (params) => {
                return dynamo.put(params).promise()
            };

            dbPut(params).then((data) => {
                console.log(`PUT ${this.tablename} ITEM SUCCEEDED WITH doc = ${JSON.stringify(item)}`);
                resolve(data);
            }).catch((err) => {
                console.log(`PUT ITEM FAILED FOR doc = ${item}, WITH ERROR: ${err}`);
                reject(err);
            });
        })
    };

    destory(id) {
        return new Promise((resolve, reject) => {
            console.log("delete");
            let params = {
                TableName: this.tablename,
                Key: {id},
                ReturnValues: 'ALL_OLD'
            };

            let dbDelete = (params) => {
                return dynamo.delete(params).promise()
            };

            dbDelete(params).then((data) => {
                if (!data.Attributes) {
                    resolve("ITEM NOT FOUND FOR DELETION " + id);
                    return;
                }
                console.log(`DELETED ${this.tablename} ITEM SUCCESSFULLY WITH id = ${id}`);
                resolve(data);
            }).catch((err) => {
                console.log(`DELETE ${this.tablename} ITEM FAILED FOR id = ${id}, WITH ERROR: ${err}`);
                reject(err);
            });
        })
    };
}

module.exports = SimpleTableController;