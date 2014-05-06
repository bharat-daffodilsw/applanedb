var Constants = require("../Constants.js");
var Utils = require("ApplaneCore/apputil/util.js");
var Config = require("../../Config.js");

exports.preInsert = function (document, collection, db, callback) {
    collection.get(Constants.Admin.Collections.MERGE, function (err, mergeValue) {
        if (err || !mergeValue || Object.keys(mergeValue).length == 0 || db.isAdminDB()) {
            callback(err);
            return;
        }
        var mergeInCollection = mergeValue.collection;
        if (mergeInCollection === "override") {
            mergeValueForOverride(db, collection, callback);
        } else {
//            var type = document.get("__type__");
//            if (!type) {
            document.set("__type__", "insert");
//            }
            callback();
        }
    })

}

exports.preUpdate = function (document, collection, db, callback) {
    collection.get(Constants.Admin.Collections.MERGE, function (err, mergeValue) {
        if (err || !mergeValue || Object.keys(mergeValue).length == 0 || db.isAdminDB()) {
            callback(err);
            return;
        }
        var type = document.get("__type__");
        if (type == "insert") {
            callback();
            return;
        }
        var mergeInCollection = mergeValue.collection;
        if (mergeInCollection === "override") {
            mergeValueForOverride(db, collection, callback);
        } else {
            var updates = document.updates;
            if (updates.$inc) {
                callback(new Error("$inc is not allowed if Merge in defined in collection [" + collection.mongoCollection.collectionName));
                return;
            }
            var updateId = document.get("_id");
            updateUnsetValues(updates);
            collection.find({_id:updateId}, {}).toArray(function (err, result) {
                if (err) {
                    callback(err);
                    return;
                }
                var oldRecord = result && result.length > 0 ? result[0] : undefined;

//                var mergeFields = mergeValue.fields;
                var valuesToSet = updates.$set;
                var newInsert = {};
                if (valuesToSet && Object.keys(valuesToSet).length > 0) {
                    for (var exp in valuesToSet) {
                        var valueToSet = valuesToSet[exp];
                        if (Array.isArray(valueToSet)) {
                            //TODO
                        } else if (Utils.isJSONObject(valueToSet) && (valueToSet.$insert || valueToSet.$update || valueToSet.$delete)) {
                            if (valueToSet.$update) {
                                addValueIfNotExist(oldRecord, exp, newInsert, valueToSet.$update, false);
                            }
                            if (valueToSet.$delete) {
                                addValueIfNotExist(oldRecord, exp, newInsert, valueToSet.$delete, true);
                            }
                        }
                    }
                }
                if (!oldRecord) {
                    newInsert._id = updateId;

                }
                var newInsertKeys = Object.keys(newInsert);
                if (newInsertKeys.length > 0) {
                    var update = {};
                    update[Constants.Update.COLLECTION] = collection.mongoCollection.collectionName;
                    if (oldRecord) {
                        update[Constants.Update.UPDATE] = [
                            {_id:oldRecord._id, $set:newInsert}
                        ];
                    } else {

                        update[Constants.Update.INSERT] = [newInsert];
                    }
                    update[Constants.Query.MODULES] = {TransactionModule:1};
                    db.batchUpdateById([update], function (err, res) {
                        //TODO no need to done..
                        if (err) {
                            callback(err);
                            return;
                        }
                        collection.find({_id:updateId}, {}).toArray(function (err, result) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            if (document.oldRecord) {
                                for (var i = 0; i < newInsertKeys.length; i++) {
                                    document.oldRecord[newInsertKeys[i]] = result[0][newInsertKeys[i]];
                                }
                            }
                            callback();
                        })
                    });
                } else {
                    callback();
                }
            })
        }
    })
}

function addValueIfNotExist(oldRecord, exp, newInsert, valuesToUpdate, isDelete) {
    var oldValue = oldRecord ? oldRecord[exp] : undefined;
    for (var i = 0; i < valuesToUpdate.length; i++) {
        var valueToUpdate = valuesToUpdate[i];
        if (!isDelete) {
            updateUnsetValues(valueToUpdate);
        }
        var old = undefined;
        if (oldValue && oldValue.length > 0) {
            for (var j = 0; j < oldValue.length; j++) {
                if (oldValue[j]._id === valueToUpdate._id) {
                    old = oldValue[j];
                    break;
                }
            }
        }
        if (!isDelete) {
            //TODO dont need to unset to null if insert in array is there.
            updateUnsetValues(valueToUpdate);
        }
        if (!old) {
            newInsert[exp] = newInsert[exp] || {};
            newInsert[exp].$insert = newInsert[exp].$insert || [];
            var valueToPush = {_id:valueToUpdate._id};
            if (isDelete) {
                valueToPush["__type__"] = "delete";
                valuesToUpdate.splice(i, 1);
                i = i - 1;
            }
            newInsert[exp].$insert.push(valueToPush);
        }
    }
}


function updateUnsetValues(updates) {
    if (updates.$unset && Object.keys(updates.$unset).length > 0) {
        var valuesToUnset = updates.$unset;
        updates.$set = updates.$set || {};
        for (var exp in valuesToUnset) {
            updates.$set[exp] = null;
        }
        delete updates.$unset;
    }
}

exports.preDelete = function (document, collection, db, callback) {
    collection.get(Constants.Admin.Collections.MERGE, function (err, mergeValue) {
        if (err || !mergeValue || Object.keys(mergeValue).length == 0 || db.isAdminDB()) {
            callback(err);
            return;
        }
        var mergeInCollection = mergeValue.collection;
        if (mergeInCollection === "override") {
            mergeValueForOverride(db, collection, callback);
        } else {
            var type = document.get("__type__");
            if (type && type == "insert") {
                callback();
                return;
            }
            var updateId = document.get("_id");
            var update = {};
            update[Constants.Update.COLLECTION] = collection.mongoCollection.collectionName;
            update[Constants.Update.INSERT] = [
                {_id:updateId, __type__:"delete"}
            ];
            update[Constants.Query.MODULES] = {TransactionModule:1};
            db.batchUpdateById([update], function (err, res) {
                if (err) {
                    callback(err);
                    return;
                }
                document.setCancelUpdates();
                callback();
            })
        }
    })
}

function mergeValueForOverride(db, collection, callback) {
    collection.count({}, {}, function (err, count) {
        if (count > 0) {
            callback();
            return;
        }
        db.adminDB(function (err, adminDb) {
            if (err) {
                callback(err);
                return;
            }
            adminDb.collection(collection.mongoCollection.collectionName).find().toArray(function (err, result) {
                if (err) {
                    callback(err);
                    return;
                }
                var update = {};
                update[Constants.Update.COLLECTION] = collection.mongoCollection.collectionName;
                update[Constants.Update.INSERT] = result;
                update[Constants.Query.MODULES] = {TransactionModule:1};
                db.batchUpdateById([update], callback);
            });
        })
    });
}

