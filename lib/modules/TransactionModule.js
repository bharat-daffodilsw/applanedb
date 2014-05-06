/*
 * Basic Concept
 *   1.We are maintaining the transaction in the __txs__ collection.
 *   2 . On start of a transaction we create  a unique transaction id (txid)
 *   and insert a record with this transaction id as the _id of the record and set the status of this transaction as pending.
 *   3.If a new record is inserted or a previous one is deleted , we make an entry in the __txs__ collection with the reverse
 *     effect so that the transaction can be easily rollbacked.
 *    for eg :
 *         if we have to insert a record
 *         {$collection: "countries", $insert: [
 {_id: 1, country: "USA", code: "01"}
 ]}
 then we update the __txs__ record with the following updates
 {updates: [
 {tx: {$collection: "countries", $delete: [
 {_id: 1}
 ]}}

 *    4. In case of update we cannot keep the updates with the transaction table because in case of parrallel transactions,
 *      if both updates on the same field then the rollback is not manageable
 *  5. So we keep the reverse effects of the updates with the record itself
 *
 *      for eg:
 *       the record to be updated
 *      {$collection: "countries", $update: [
 {_id: 1, $set: {"country": "India"}}
 ]}
 then the record with the transaction will be like this
 {$collection: "countries", $update: [
 {_id: 1, $set: {"country": "India"}, __txs__: {txid: {tx: {_id: 1, $set: {"country": "USA"}}}}}
 ]}

 NOTE:  We are maintaining  an object corresponding to the __txs__ field . Correponding to this __txs__ field
 a transactionid - transaction (key-value)  pair is maintained so that we can easily commit or rollback or unset the
 transactionid in the __txs__ field after commit or rollback.
 6. In case of rollback , update the status of the transaction as rollback so that in case of any failure during the
 rollback process we can easily rollback the remaining transactions
 7. In case of commit , update the status of the transaction as commit so that in case of any failure during the commit
 process we can easily commit the remaining transactions.
 NOTE : all the transaction updates are executed using batchUpdate


 * */

var Constants = require("../Constants.js");
var Utils = require("ApplaneCore/apputil/util.js");


exports.preInsert = function (document, collection, db, callback) {
    var txid = db.txid;
    if (txid === undefined) {
        callback();
        return;
    }
    var documentId = document.get("_id");
    var collectionName = collection.mongoCollection.collectionName;
    var tx = {$collection: collectionName, $delete: {_id: documentId}};

    var update = [
        {$collection: Constants.TRANSACTIONS, $update: [
            {$query: {_id: txid}, $push: {updates: {$each: [
                {_id: Utils.getUnique(), tx: tx}
            ]}}}
        ]}
    ];
    /*
     * update the __txs__ collection with the reverse effect of insert( delete with the record id)
     * */
    console.log("pre insert >>>>>> " + JSON.stringify(update));
    db.batchUpdate(update, callback);

}

exports.preUpdate = function (document, collection, db, callback) {
    console.log("preUPdate called>>>>>>>.");
    if (db.txid === undefined) {
        callback();
        return;
    }
    var documentId = document.get("_id");
    var collectionName = collection.mongoCollection.collectionName;
    var tx = {};
    tx[Constants.Query.COLLECTION] = collectionName;
    tx[Constants.Update.UPDATE] = {_id: documentId};

    /*
     * query on the __txs__ collection to check whether a transaction is going on with collection with the same record updated that is  inserted or deleted in the same transaction
     * if the record is found the do nothing
     * else update the document with the reverse effect of the transaction and update the __txs__ collection with the id and name of the collection to be updated
     * */
    getTransaction(db, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        var toUpdate = true;
        var alreadyInProgress = false;
        var updates = data.result && data.result.length > 0 ? data.result[0].updates : [];
        for (var i = 0; i < updates.length; i++) {
            if (collectionName === updates[i].tx.$collection) {
                if ((updates[i].tx.$insert && updates[i].tx.$insert._id == documentId) || (updates[i].tx.$delete && updates[i].tx.$delete._id == documentId)) {
                    toUpdate = false;
                }
                if (updates[i].tx.$update && updates[i].tx.$update._id == documentId) {
                    alreadyInProgress = true;
                }

            }
        }
        if (toUpdate) {
            if (alreadyInProgress) {
                updateDocument(document, collection, db, callback);
            } else {
                var update = [
                    {$collection: Constants.TRANSACTIONS, $update: [
                        {$query: {_id: db.txid}, $push: {updates: {$each: [
                            {_id: Utils.getUnique(), tx: tx}
                        ]}}}
                    ]}
                ];
                db.batchUpdate(update, function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    updateDocument(document, collection, db, callback);
                });
            }
        } else {
            callback();
        }

    });
}

exports.preDelete = function (document, collection, db, callback) {
    var txid = db.txid;
    if (txid === undefined) {
        callback();
        return;
    }
    var collectionName = collection.mongoCollection.collectionName;
    var tx = {};
    tx[Constants.Query.COLLECTION] = collectionName;
    tx[Constants.Update.INSERT] = document.oldRecord;
    /*
     * update the __txs__ collection with the reverse effect of delete( save the old record )
     * */
    var update = [
        {$collection: Constants.TRANSACTIONS, $update: [
            {$query: {_id: txid}, $push: {updates: {$each: [
                {_id: Utils.getUnique(), tx: tx}
            ]}}}
        ]}
    ];
    db.batchUpdate(update, callback);

}

exports.onCommit = function (db, callback) {
    handleCommit(db, callback);
}

exports.onRollback = function (db, callback) {
    handleRollback(db, callback);
}

function handleCommit(db, callback) {

    getTransaction(db, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        var updates = data.result && data.result.length > 0 ? data.result[0].updates : [];
        if (updates && updates.length > 0) {
            processCommitUpdates(updates[0], db, function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                handleCommit(db, callback);
            });
        } else {
            deleteTransaction(db, function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                callback();
            })

        }
    });
}


function deleteTransaction(db, callback) {
    var update = {}
    update[Constants.Query.COLLECTION] = Constants.TRANSACTIONS;
    update[Constants.Update.DELETE] = [
        {_id: db.txid}
    ];
    db.batchUpdate([update], callback);
}

function handleRollback(db, callback) {
    /*
     * query on the __txs__ collection to fetch the transaction corresponding to the txid
     * */
    getTransaction(db, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        var updates = data.result && data.result.length > 0 ? data.result[0].updates : [];
        /*
         * process each operation in the transaction on by one
         * if no updated are found then delete the complete transaction
         * */
        if (updates && updates.length > 0) {
            processRollbackUpdates(updates[0], db, function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                handleRollback(db, callback);
            });
        } else {
            deleteTransaction(db, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                callback();
            })
        }
    });
}

function getTransaction(db, callback) {
    var query = {};
    query[Constants.Query.COLLECTION] = Constants.TRANSACTIONS;
    query[Constants.Query.FILTER] = {_id: db.txid};
    db.query(query, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, data);
    });
}

function processRollbackUpdates(update, db, callback) {
    /*
     * if the operation in transaction is insert or delete then rollback from the transaction
     * otherwise rollback from the document
     * */
    var tx = update.tx;
    if (tx) {
        if (tx.$insert !== undefined || tx.$delete !== undefined) {
            db.batchUpdate([tx], function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                removeFromTransaction(update._id, db, callback);
            });
        } else {
            rollbackFromRecord(update._id, tx, db, callback);
        }
    } else {
        throw new Error("Transaction not found in Transaction");
    }
}

function processCommitUpdates(update, db, callback) {
    var tx = update.tx;
    if (tx) {
        if (tx.$insert !== undefined || tx.$delete !== undefined) {
            removeFromTransaction(update._id, db, callback);
        } else {
            removeTxsFromRecord(tx, db, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                removeFromTransaction(update._id, db, callback);
            });
        }
    } else {
        throw new Error("Transaction not found in Transaction");
    }
}

function removeTxsFromRecord(tx, db, callback) {
    var collection = tx.$collection;
    var updates = tx.$update;
    var query = {};
    query._id = updates._id;
    var unset = {};
    unset["__txs__." + db.txid] = "";
    var update = {$collection: collection, $update: {$query: query, $unset: unset}};
    db.batchUpdate(update, callback);
}

function removeFromTransaction(id, db, callback) {
    var update = {}
    update[Constants.Query.COLLECTION] = Constants.TRANSACTIONS;
    update[Constants.Update.UPDATE] = [
        {$query: {_id: db.txid}, $pull: {updates: {_id: id}}}
    ];
    db.batchUpdate([update], callback);


}

function rollbackFromRecord(txsUpdatesid, tx, db, callback) {
    /*
     * query on the collection reffered in the transaction and extract the updates
     * */
    var collection = tx.$collection;
    var updates = tx.$update;
    var query = {};
    query[Constants.Query.COLLECTION] = collection;
    query[Constants.Query.FILTER] = {_id: updates._id};
    db.query(query, function (err, data) {
            if (err) {
                callback(err);
                return;
            }
            var transactions = data.result && data.result.length > 0 ? data.result[0].__txs__ : {};
            var txToRollback = transactions[db.txid] ? JSON.parse(transactions[db.txid]["tx"]) : undefined;
            if (txToRollback) {
                var id = txToRollback._id;
                delete txToRollback._id;
                txToRollback[Constants.Update.QUERY] = {_id: id};
                txToRollback.$unset = txToRollback.$unset || {};
                txToRollback.$unset["__txs__." + db.txid] = "";
                var update = {$collection: collection, $update: [txToRollback]};
                db.batchUpdate([update], function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    removeFromTransaction(txsUpdatesid, db, callback);
                });
            }
            else {
                callback();
            }
        }
    )
    ;
}


function updateDocument(document, collection, db, callback) {
    var tx = {};
    tx._id = document.get("_id");
    var updatedTx = handleUpdates(document, tx, db.txid);
    var txs = {$set: {}};
    txs.$set[db.txid + ".tx"] = JSON.stringify(updatedTx);
    document.set("__txs__", txs);
    callback();
}

function updateTransaction(document, tx, pExpression) {
    /*
     * get Updated Fields from the document and iterate them . If the getDocuments result in object or array then handle them
     * otherwise value corresponding to the field is simple and handle it accordingly
     * */

    var updatedFields = document.getUpdatedFields();
    for (var i = 0; i < updatedFields.length; i++) {
        var field = updatedFields[i];
        var documents = document.getDocuments(field);
        if (documents !== undefined) {
            if (Array.isArray(documents)) {
                var oldValue = document.getOld(field);
                var newParentExp = pExpression ? pExpression + "." + field : field;
                handleArray(documents, tx, oldValue, newParentExp);
            } else {
                var newParentExp = pExpression ? pExpression + "." + field : field;
                updateTransaction(documents, tx, newParentExp);
            }
        } else {
            var newKey = pExpression ? pExpression + "." + field : field;
            if (document.updates && document.updates.$inc && document.updates.$inc[field] !== undefined) {
                tx.$inc = tx.$inc || {};
                var oldValue = tx.$inc[newKey] || 0;
                oldValue = oldValue + (-1 * document.get(field));
                tx.$inc[newKey] = oldValue;
            } else if ((document.updates && document.updates.$unset && document.updates.$unset[field] !== undefined) || (document.updates && document.updates.$set && document.updates.$set[field] !== undefined)) {
                tx.$set = tx.$set || {};
                if (tx.$set[newKey] === undefined) {
                    tx.$set[newKey] = document.getOld(field);
                }
            } else {
                throw new Error("updates for field[" + field + "] must be in one of $set,$unset,$inc");
            }
        }
    }
    return tx;
}

function handleUpdates(document, tx, txid) {
    /*
     * check if a transaction is already in progress with the record to be updated
     * if found then update the changes in the ongoing transaction
     * otherwise create a new transaction
     * */
    var previousTransaction = document.getDocuments("__txs__");
    if (previousTransaction !== undefined) {
        var pTx = previousTransaction.get(txid);
        if (pTx !== undefined) {
            pTx = JSON.parse(pTx.tx);
            updateTransaction(document, pTx);
            return pTx;
        } else {
            updateTransaction(document, tx);
            return tx;
        }
    } else {
        updateTransaction(document, tx);
        return tx;
    }
}


function handleObject(document, tx) {
    var updatedFields = document.getUpdatedFields();
    for (var i = 0; i < updatedFields.length; i++) {
        var field = updatedFields[i];
        var documents = document.getDocuments(field);
    }
}


function handleArray(documents, tx, oldValue, pExp) {
    var insertDocs = [];
    var updateDocs = [];
    var deleteDocs = [];
    for (var i = 0; i < documents.length; i++) {
        if (documents[i].type === "insert") {
            insertDocs.push(documents[i]);
        } else if (documents[i].type === "update") {
            updateDocs.push(documents[i]);
        } else if (documents[i].type === "delete") {
            deleteDocs.push(documents[i]);
        }
    }
    if ((deleteDocs.length > 0 ) || (insertDocs.length > 0 && updateDocs.length > 0)) {
        tx.$set[pExp] = oldValue;
        return;
    }
    if (insertDocs.length > 0) {
        tx.$pull = tx.$pull || {};
        var pullIds = [];
        for (var i = 0; i < insertDocs.length; i++) {
            pullIds.push(insertDocs[i]._id);
        }
        tx.$pull[pExp] = {_id: pullIds};
    }
    if (updateDocs.length > 0) {
        for (var i = 0; i < updateDocs.length; i++) {
            var query = undefined;
            if (updateDocs[i].$query) {
                query = updateDocs[i].$query;
            } else {
                query = {"_id": updateDocs[i]._id};
            }
            var indexes = fetchIndex(query, oldValue);
            if (indexes && indexes.length === 1) {
                var index = indexes[0].index;
                updateTransaction(updateDocs[i], tx, pExp + "." + index);
            }
            else {
                throw new Error("Update operation matches with none or more than one records");
            }
        }
    }
}

function fetchIndex(query, oldData) {
    var Utils = require("ApplaneCore/apputil/util.js");

    var indexes = [];
    var length = oldData ? oldData.length : 0;

    for (var i = 0; i < length; i++) {
        if (Utils.evaluateFilter(query, oldData[i])) {
            indexes.push({index: i, data: oldData[i]});
        }
    }
    return indexes;
}

