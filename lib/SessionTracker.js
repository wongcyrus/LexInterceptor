let SimpleTableController = require("./SimpleTableController");

class SessionTracker {

    constructor(tablename) {
        this.sessionTable = new SimpleTableController(tablename);
    }

    restoreLastSession(messagingEvent) {
        return new Promise((resolve, reject) => {
            this.sessionTable.get(messagingEvent.sender.id)
                .then(item => {
                    console.log(item);
                    if (item) {
                        messagingEvent.sessionAttributes = item.sessionAttributes;
                        messagingEvent.message.currentSlot = item.slotToElicit ? item.slotToElicit : "";
                    }
                    resolve(messagingEvent);
                })
                .catch(reject);
        })
    }

    saveCurrentSession(messagingEvent) {
        return new Promise((resolve, reject) => {
            //Set slotToElicit to currentSlot for the next session.
            messagingEvent.sessionAttributes.currentSlot = messagingEvent.message.slotToElicit;
            this.sessionTable.put({
                id: messagingEvent.sender.id,
                sessionAttributes: messagingEvent.sessionAttributes
            }).then(data => {
                resolve(messagingEvent);
            }).catch(reject);
        })
    }
}

module.exports = SessionTracker;