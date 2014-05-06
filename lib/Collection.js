var Utils = require("ApplaneCore/apputil/util.js");
var Document = require("./Document.js");
var Constants = require("./Constants.js");
var ModuleManager = require("./ModuleManager.js");
var Collection = function (collection, db, options) {
    this.mongoCollection = collection;
    this.db = db;
    this.options = options;
//    validateFields(options ? options.fields : undefined);
}

function validateFields(fields, pField) {
    if (fields) {
        for (var i = 0; i < fields.length; i++) {
            if (fields[i].field.indexOf(".") > -1) {
                throw new Error("Dotted Fields not allowed [" + (pField ? (pField + ">>" + fields[i].field) : fields[i].field) + "]");
            }
            if (fields[i].fields) {
                validateFields(fields[i].fields, (pField ? (pField + ">>" + fields[i].field) : fields[i].field));
            }
        }
    }
}

module.exports = Collection;

Collection.prototype.find = function (query, options) {
    return this.mongoCollection.find(query, options);
}

Collection.prototype.count = function (query, options, callback) {
    return this.mongoCollection.find(query, options).count(callback);
}

Collection.prototype.aggregate = function (pipeline, callback) {
    return this.mongoCollection.aggregate(pipeline, callback);
}

Collection.prototype.upsert = function (query, update, fields, options, callback) {
    var that = this;
    var queryTogetData = {};
    queryTogetData[Constants.Query.COLLECTION] = this.options && this.options[Constants.Admin.Collections.COLLECTION] ? this.options : this.mongoCollection.collectionName;
    queryTogetData[Constants.Query.FIELDS] = fields;
    queryTogetData[Constants.Query.FILTER] = query;
    queryTogetData[Constants.Query.LIMIT] = 2;
    that.db.query(queryTogetData, function (err, data) {
        if (err) {
            callback(err);
            return;
        } else {
            if (data && data.result && data.result.length > 0) {
                if (data.result.length > 1) {
                    throw Error("Mulitple Records found corresponding to [" + query + "] in collection [" + this.mongoCollection.collectionName + "]");
                } else {
                    if (update.$set || update.$pull || update.$push || update.$unset) {
                        that.updateById(data.result[0]._id, update, options, function (err, result) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            queryTogetData[Constants.Query.FILTER] = {_id: data.result[0]._id};
                            that.db.query(queryTogetData, function (err, finalResult) {
                                if (err) {
                                    callback(err);
                                    return;
                                }
                                callback(null, finalResult.result[0]);
                            });
                        });
                    } else {
                        callback(null, data.result[0]);
                    }
                }
            } else {
                var newInsert = update.$set || {};
                for (var key in query) {
                    if (!newInsert[key]) {
                        newInsert[key] = query[key];
                    }
                }
                that.insert(newInsert, options, function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    that.db.query(queryTogetData, function (err, finalResult) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback(null, finalResult.result[0]);
                    });
                });
            }
        }
    });

}

Collection.prototype.insert = function (inserts, modules, options, callback) {
    if (typeof modules == "function") {
        callback = modules;
        options = {w: 1};
        modules = undefined;
    } else if (typeof options == "function") {
        callback = options;
        options = modules;
        modules = undefined;
    }

    var that = this;
    var docId = Utils.getUnique();
    if (!inserts._id) {
        inserts._id = Utils.getUnique();
    }
    var document = new Document(inserts, null, "insert");
    ModuleManager.preInsert(docId, document, modules, that, that.db, function (err) {
        if (err) {
            callback(err);
            return;
        }
        if (document.cancelUpdates) {
            callback();
            return;
        }
        prepareInserts(inserts);
        that.mongoCollection.insert(inserts, options, function (err, result) {
            if (err) {
                callback(err);
                return;
            }
            ModuleManager.postInsert(docId, document, modules, that, that.db, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, result);
            });
        });
    });
};

Collection.prototype.findAndModify = function (update, options, callback) {
    this.db.findAndModify(update, options, function (err, data) {
        if (err) {
            callback(err);
            return;
        } else {
            callback(null, data);
        }
    })

}

Collection.prototype.updateById = function (id, update, modules, options, callback) {
    if (!id) {
        callback(new Error("_id is mandatory in case of UpdateById."));
        return;
    }
    if (typeof modules == "function") {
        callback = modules;
        options = {w: 1};
        modules = undefined;
    } else if (typeof options == "function") {
        callback = options;
        options = modules;
        modules = undefined;
    }
    var that = this;
    var query = {};
    query[Constants.Query.COLLECTION] = this.options && this.options[Constants.Admin.Collections.COLLECTION] ? this.options : this.mongoCollection.collectionName;
    query[Constants.Query.FILTER] = {"_id": id};
    that.db.query(query, function (err, data) {
        if (err) {
            callback(err);
            return;
        } else {
            var oldData = data.result[0];
            var docId = Utils.getUnique();
            var document = new Document(update, oldData, "update");
            ModuleManager.preUpdate(docId, document, modules, that, that.db, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                if (document.cancelUpdates) {
                    callback(null, 0);
                    return;
                }
                prepareUpdates(update, update, oldData, null, null);
                var newUpdates = prepareMongoUpdates(update);
                var finalResult = {};
                Utils.iterateArray(newUpdates, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    ModuleManager.postUpdate(docId, document, modules, that, that.db, function (err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback(null, finalResult);

                    });
                }, function (newUpdate, callback) {
                    if (newUpdate.$push && Object.keys(newUpdate.$push).length !== 0) {
                        var operations = populateMap(newUpdate.$push);
                        newUpdate.$push = seperateConflictingOperations(operations, null, id, options, "$push", that);
                    }
                    if (newUpdate.$pull && Object.keys(newUpdate.$pull).length !== 0) {
                        var operations = populateMap(newUpdate.$pull);
                        newUpdate.$pull = seperateConflictingOperations(operations, null, id, options, "$pull", that);
                    }
                    that.mongoCollection.update({"_id": id}, newUpdate, options, function (err, result) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        finalResult = result;
                        callback(null, result);
                    });
                });
            })
        }
    });
}

Collection.prototype.update = function (query, update, options, callback) {
    var that = this;
    update.$set = update.$set || {};
    var map = populateDollarMap(update.$set);
    if (Object.keys(map).length > 0) {
        if (validateFilter(query)) {
            that.mongoCollection.find(query).batchSize(10).each(function (err, document) {
                if (document != null) {
                    var updates = {};
                    prepareDollarUpdates(document, Object.keys(query)[0], query[Object.keys(query)[0]], map, updates);
                    var newUpdate = {};
                    newUpdate.$set = updates;
                    that.mongoCollection.update({_id: document._id}, newUpdate, options, function (err, result) {
                        if (err) {
                            console.log("err>>>>>" + err.stack);
                            callback(err);
                            return;
                        }

                    });
                } else {
                    callback(null, {});
                }
            });
        }
    } else {
        that.mongoCollection.update(query, update, options, function (err, result) {
            if (err) {
                console.log("err>>>>>" + err.stack);
                callback(err);
                return;
            }
            callback(null, result);
        });
    }
}

Collection.prototype.removeById = function (id, modules, options, callback) {
    if (!id) {
        callback(new Error("_id is mandatory in case of removeById."));
        return;
    }
    if (typeof modules == "function") {
        callback = modules;
        options = {w: 1};
        modules = undefined;
    } else if (typeof options == "function") {
        callback = options;
        options = modules;
        modules = undefined;
    }
    var query = {};
    query[Constants.Query.COLLECTION] = this.options && this.options[Constants.Admin.Collections.COLLECTION] ? this.options : this.mongoCollection.collectionName;
    query[Constants.Query.FILTER] = {"_id": id};
    var that = this;
    that.db.query(query, function (err, data) {
        if (err) {
            callback(err);
            return;
        } else {
            var oldData = data.result[0];
            var docId = Utils.getUnique();
            var document = new Document({"_id": id}, oldData, "delete");
            ModuleManager.preDelete(docId, document, modules, that, that.db, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                if (document.cancelUpdates) {
                    callback(null, 0);
                    return;
                }
                that.mongoCollection.remove({_id: id}, options, function (err, result) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    ModuleManager.postDelete(docId, document, modules, that, that.db, function (err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback(null, result);
                    })
                });
            });
        }
    });
}

Collection.prototype.remove = function (id, options, callback) {
    this.mongoCollection.remove(id, options, callback);
}

Collection.prototype.addField = function (field, callback) {
    // save in database
}

Collection.prototype.get = function (key, callback) {
    if (key == Constants.Admin.Collections.COLLECTION) {
        callback(null, this.mongoCollection.collectionName);
    } else if (this.options && this.options[key]) {
        callback(null, this.options[key]);
    } else if (key == Constants.Admin.Collections.REFERRED_FKS) {
        getReferredFks.call(this, this.options, function (err, referredFks) {
            if (err) {
                callback(err);
                return;
            }
            callback(null, referredFks);
        })
    } else {
        callback();
    }
}

function getReferredFks(options, callback) {
    if (!options || !options._id) {
        callback();
        return;
    }
    var query = {};
    query[Constants.Query.COLLECTION] = Constants.Admin.REFERRED_FKS;
    var fields = {};
    fields[Constants.Admin.ReferredFks.COLLECTION_ID + "._id"] = 1;
    fields[Constants.Admin.ReferredFks.COLLECTION_ID + "." + Constants.Admin.Collections.COLLECTION] = 1;
    fields[Constants.Admin.ReferredFks.FIELD] = 1;
    fields[Constants.Admin.ReferredFks.SET] = 1;
//    fields[Constants.Admin.ReferredFks.COLLECTION_ID] = 1;
    query[Constants.Query.FIELDS] = fields;
    query[Constants.Query.FILTER] = {"referredcollectionid._id": options._id};
    this.db.query(query, function (err, res) {
        if (err) {
            callback(err);
            return;
        }
        var referredFks = res.result;
        options[Constants.Admin.Collections.REFERRED_FKS] = referredFks;
        callback(null, referredFks);
    });

}

Collection.prototype.ensureIndex = function (callback) {
    // save in database
}

function handleUnsetAndIncUpdates(updates, operation, operator, pExpression, pIndex) {
    if (operation[operator] === undefined) {
        return;
    }
    var newOperation = operation[operator];
    newOperation = newOperation || {};
    var keys = Object.keys(newOperation);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        updates[operator] = updates[operator] || {};
        var newKey = pExpression ? pIndex ? pExpression + "." + pIndex + "." + key : pExpression + "." + key : key;
        updates[operator][newKey] = newOperation[key];
        if (pExpression) {
            delete newOperation[key];
        }
    }
    if (pExpression) {
        if (Object.keys(newOperation).length === 0) {
            delete operation[operator];
        }
    }

}
function prepareUpdates(updates, operation, oldData, pExpression, pIndex) {
    var setValue = operation && operation.$set ? operation.$set : {};
    handleUnsetAndIncUpdates(updates, operation, "$unset", pExpression, pIndex);
    handleUnsetAndIncUpdates(updates, operation, "$inc", pExpression, pIndex);
    var keys = Object.keys(setValue);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (Utils.isJSONObject(setValue[key])) {
            var newKey = pExpression ? ((pIndex !== undefined && pIndex !== null) ? pExpression + "." + pIndex + "." + key : pExpression + "." + key) : key;
            if (setValue[key].$set) {
                prepareUpdates(updates, setValue[key], oldData[key], newKey, null);
                delete setValue[key].$set;
            }
            if (setValue[key].$unset) {
                updates.$unset = updates.$unset || {};
                for (var newKey in setValue[key].$unset) {
                    updates.$unset[key + "." + newKey] = setValue[key].$unset[newKey];
                }
                delete setValue[key].$unset;
            }
            if (setValue[key].$inc) {
                updates.$inc = updates.$inc || {};
                for (var newKey in setValue[key].$inc) {
                    updates.$inc[newKey] = setValue[key].$inc[newKey];
                }
            }
            if (setValue[key][Constants.Update.INSERT]) {
                var push = updates.$push ? updates.$push : {};
                push[newKey] = {"$each": setValue[key][Constants.Update.INSERT]};
                delete setValue[key][Constants.Update.INSERT];
                updates.$push = push;
            }
            if (setValue[key][Constants.Update.DELETE]) {
                var deleteOperations = setValue[key][Constants.Update.DELETE];
                var pull = updates.$pull ? updates.$pull : {};
                var filters = [];
                var filterKey = null;
                for (var i = 0; i < deleteOperations.length; i++) {
                    var operation = deleteOperations[i];
                    if (Utils.isJSONObject(operation)) {
                        filterKey = Object.keys(operation)[0];
                        filters.push(operation[filterKey]);
                    } else {
                        filters.push(operation);
                    }
                }
                if (filterKey) {
                    var newFilter = {};
                    newFilter[filterKey] = {"$in": filters};
                    pull[newKey] = newFilter;
                } else {
                    pull[newKey] = {"$in": filters};
                }
                delete setValue[key][Constants.Update.DELETE];
                updates.$pull = pull;
            }
            if (setValue[key][Constants.Update.UPDATE]) {
                var updateOperation = setValue[key][Constants.Update.UPDATE];
                for (var i = 0; i < updateOperation.length; i++) {
                    var operation = updateOperation[i];
                    var updateQuery = {};
                    if (operation.$query) {
                        updateQuery = operation[Constants.Update.QUERY];
                    } else {
                        updateQuery._id = operation._id;
                    }
                    var indexes = fetchIndex(updateQuery, oldData[key]);
                    for (var j = 0; j < indexes.length; j++) {
                        if (j == indexes.length - 1) {
                            prepareUpdates(updates, operation, indexes[j].data, newKey, indexes[j].index);
                        } else {
                            var operationClone = Utils.deepClone(operation);
                            prepareUpdates(updates, operationClone, indexes[j].data, newKey, indexes[j].index);
                        }
                    }
                }
                delete setValue[key][Constants.Update.UPDATE];
            }
            if (Object.keys(setValue[key]).length === 0) {
                delete setValue[key];
            }
        } else {
            if (pExpression) {
                var newKey = pExpression ? ((pIndex !== undefined && pIndex !== null) ? pExpression + "." + pIndex + "." + key : pExpression + "." + key ) : key;
                updates.$set[newKey] = setValue[key];
            }
        }
        if (pExpression) {
            delete setValue[key];
        }
    }
}

function fetchIndex(query, oldData) {

    var indexes = [];
    var length = oldData ? oldData.length : 0;
    for (var i = 0; i < length; i++) {
        if (Utils.evaluateFilter(query, oldData[i])) {
            indexes.push({index: i, data: oldData[i]});
        }
    }
    return indexes;
}

function prepareMongoUpdates(updates) {
    updates.$set = updates.$set || {};
    updates.$push = updates.$push || {};
    updates.$pull = updates.$pull || {};
    var pullUpdate = {};
    var pushUpdate = {};
    var pushKeys = Object.keys(updates.$push);
    var pullKeys = Object.keys(updates.$pull);
    var setKeys = Object.keys(updates.$set);
    for (var i = 0; i < pushKeys.length; i++) {
        var pushKey = pushKeys[i];
        var found = false;
        if (updates.$pull[pushKey]) {
            found = true;
            pushUpdate[pushKey] = updates.$push[pushKey];
            delete updates.$push[pushKey];
        }
        if (!found) {
            for (var j = 0; j < setKeys.length; j++) {
                var setKey = setKeys[j];
                if (setKey.indexOf(pushKey + ".") === 0) {
                    pushUpdate[pushKey] = updates.$push[pushKey];
                    delete updates.$push[pushKey];
                    break;
                }
            }
        }
    }
    for (var i = 0; i < pullKeys.length; i++) {
        var pullKey = pullKeys[i];
        for (var j = 0; j < setKeys.length; j++) {
            var setKey = setKeys[j];
            if (setKey.indexOf(pullKey + ".") === 0) {
                pullUpdate[pullKey] = updates.$pull[pullKey];
                delete updates.$pull[pullKey];
                break;
            }
        }
    }
    var newUpdates = [];
    newUpdates.push(updates);

    if (Object.keys(pushUpdate).length > 0) {
        newUpdates.push({$push: pushUpdate});
    }
    if (Object.keys(pullUpdate).length > 0) {
        newUpdates.push({$pull: pullUpdate});
    }
    return newUpdates;
}

function populateMap(object) {
    var keys = Object.keys(object);
    var newMap = {};
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var index = key.indexOf(".");
        if (index !== -1) {
            var firstPart = key.substr(0, index);
            var lastPart = key.substr(index + 1);
            index = lastPart.indexOf(".");
            while (index !== -1) {
                var secondPart = lastPart.substr(0, index);
                if (!isNaN(Number(secondPart))) {
                    var thirdPart = lastPart.substr(index + 1);
                    newMap[firstPart] = newMap[firstPart] || {};
                    newMap[firstPart][secondPart] = newMap[firstPart][secondPart] || {};
                    newMap[firstPart][secondPart][thirdPart] = object[key];
                    newMap[firstPart][secondPart] = populateMap(newMap[firstPart][secondPart]);
                    break;
                }
                firstPart = firstPart + "." + secondPart;
                lastPart = lastPart.substr(index + 1);
                index = lastPart.indexOf(".");
            }
            if (index == -1) {
                newMap[key] = newMap[key] || {}
                if (object[key][Constants.Update.QUERY]) {
                    newMap[key][Constants.Update.QUERY] = object[key][Constants.Update.QUERY];
                } else {
                    newMap[key][Constants.Update.QUERY] = object[key];
                }
            }
        } else {
            newMap[key] = newMap[key] || {}
            if (object[key][Constants.Update.QUERY]) {
                newMap[key][Constants.Update.QUERY] = object[key][Constants.Update.QUERY];
            } else {
                newMap[key][Constants.Update.QUERY] = object[key];
            }
        }
    }
    return newMap;
}

function seperateConflictingOperations(operations, pExpression, id, options, operator, collection) {
    if (Utils.isJSONObject(operations)) {
        var keys = Object.keys(operations);
        var operation = {};
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];

            if (operations[key][Constants.Update.QUERY]) {
                var newKey = pExpression ? pExpression + "." + key : key;
                operation[newKey] = operations[key][Constants.Update.QUERY];
                delete operations[key][Constants.Update.QUERY];
            } else {
                if (Utils.isJSONObject(operations[key])) {
                    var innerKeys = Object.keys(operations[key]);
                    for (var j = 0; j < innerKeys.length; j++) {
                        var innerKey = innerKeys[j];
                        var newParentExpression = pExpression ? pExpression + "." + key + "." + innerKey : key + "." + innerKey;
                        var newOperation = seperateConflictingOperations(operations[key][innerKey], newParentExpression, id, options, operator, collection);
                        for (var newInnerKey in newOperation) {
                            operation[ newInnerKey] = newOperation[newInnerKey];
                        }
                        delete operations[key][innerKey][Constants.Update.QUERY];
                        if (Object.keys(operations[key][innerKey]).length === 0) {
                            delete operations[key][innerKey];
                        }
                    }
                }
            }
            if (Object.keys(operations[key]).length === 0) {
                delete operations[key];
            }
            if (operations && operations[key] && Object.keys(operations).length !== 0) {
                var pulls = seperateConflictingOperations(operations, pExpression, id, options, operator, collection);
                var update = {};
                update[operator] = pulls;
                collection.mongoCollection.update({"_id": id}, update, options, function (err, result) {
                    if (err) {
                        console.log("err>>>>>" + err.stack);
                        callback(err);
                        return;
                    }
                });
            }
        }
    }
    return operation;
}

function populateDollarMap(updateSet, isChild) {
    var keys = Object.keys(updateSet);
    var map = {};
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var index = key.indexOf(".$.");
        if (index !== -1) {
            var first = key.substr(0, index);
            var second = key.substr(index + 3);
            map[first] = map[first] || {};
            map[first][second] = updateSet[key] || {};
            map[first] = populateDollarMap(map[first], true);
        } else {
            if (isChild) {
                map[key] = map[key] || {};
                map[key] = updateSet[key];
            }
        }
    }
    return map;
}

function validateFilter(filter) {
    filter = filter || {};
    var keys = Object.keys(filter);
    if (keys.length > 1 || keys.indexOf("$or") !== -1 || keys.indexOf("$and") !== -1) {
        throw Error("filter not supported");
    }
    return true;
}

function prepareDollarUpdates(doc, filterKey, filterValue, map, updates, pExp, pKey) {
    var index = filterKey.indexOf(".");
    var first = filterKey.substr(0, index);
    var rest = filterKey.substr(index + 1);
    if (index !== -1) {
        if (Utils.isJSONObject(doc[first])) {
            return prepareDollarUpdates(doc[first], rest, filterValue, map, updates, pExp, ((pKey ? pKey + "." + first : first)));
        } else if (Array.isArray(doc[first])) {
            var firstFinal = ((pKey ? pKey + "." + first : first));
            var evaluated = false;
            for (var i = 0; i < doc[first].length; i++) {
                var value = doc[first][i];
                var newMap = {};
                var found = prepareDollarUpdates(value, rest, filterValue, map[firstFinal], newMap, ((pExp ? pExp + "." + first : first) + "." + i));
                if (found) {
                    for (var key in newMap) {
                        updates[firstFinal + "." + i + "." + key] = newMap[key];
                    }
                    evaluated = true;
                }
            }
            if (evaluated) {
                for (var key in map) {
                    if (key !== firstFinal) {
                        updates[key] = map[key];
                    }
                }
            }
            return evaluated;
        } else {
            return false;
        }
    } else {
        var query = {};
        query[filterKey] = filterValue;
        var found = Utils.evaluateFilter(query, doc);
        if (found) {
            for (var key in map) {
                updates[key] = map[key];
            }
        }
        return found;
    }
}

function prepareInserts(inserts) {
    var keys = Object.keys(inserts);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (Utils.isJSONObject(inserts[key])) {
            if (inserts[key].$insert) {
                inserts[key] = inserts[key].$insert;
            }
            for (var j = 0; j < inserts[key].length; j++) {
                prepareInserts(inserts[key][j]);
            }
        } else if (Array.isArray(inserts[key])) {
            for (var j = 0; j < inserts[key].length; j++) {
                if (Utils.isJSONObject(inserts[key][j])) {
                    prepareInserts(inserts[key][j]);
                }
            }
        }
    }
}


Collection.prototype.mongoInsert = function (inserts, options, callback) {
    if (!inserts._id) {
        inserts._id = Utils.getUnique();
    }
    prepareInserts(inserts);
    this.mongoCollection.insert(inserts, options, function (err, result) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, result);
    });
}


function handleSimpleFields(document, newUpdate, field, pExpression) {
    var newField = pExpression ? pExpression + "." + field : field;
    if (document.updates && document.updates.$inc && document.updates.$inc[field] !== undefined) {
        newUpdate.$inc = newUpdate.$inc || {};
        newUpdate.$inc[newField] = document.get(field);
    } else if (document.updates && document.updates.$set && document.updates.$set[field] !== undefined) {
        newUpdate.$set = newUpdate.$set || {};
        newUpdate.$set[newField] = document.get(field);
    } else if (document.updates && document.updates.$unset && document.updates.$unset[field] !== undefined) {
        newUpdate.$unset = newUpdate.$unset || {};
        newUpdate.$unset[newField] = "";
    }
    return newField;
}
function modifyUpdates(document, newUpdate, pExpression) {
    console.log("modify updates called");
    var fields = document.getUpdatedFields();
    console.log("fields>>>>>>>>>>>>>>>>>>>>>>" + JSON.stringify(fields));
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var documents = document.getDocuments(field);
        if (documents) {
            var newParentExp = pExpression ? pExpression + "." + field : field;
            if (Array.isArray(documents)) {
                for (var j = 0; j < documents.length; j++) {
                    var document = documents[j];
                    if (document.type === "insert") {
                        handleInsertDocuments(document, newUpdate, newParentExp);
                    } else if (document.type === "delete") {
                        handleDeleteDocuments(document, newUpdate, newParentExp);
                    } else if (document.type === "update") {
                        handleUpdateDocuments(document, newUpdate, newParentExp);
                    }
                }
            } else {
                modifyUpdates(documents, newUpdate, newParentExp);
            }
        } else {
            handleSimpleFields(document, newUpdate, field, pExpression);
        }
    }
}

function handleDeleteDocuments(document, newUpdate, expression) {
    var deletes = [];
    var pull = newUpdate.$pull ? newUpdate.$pull : {};
    var filters = [];
    var filterKey = null;
    var operation = document.updates;
    if (Utils.isJSONObject(operation)) {
        filterKey = Object.keys(operation)[0];
        filters.push(operation[filterKey]);
    } else {
        filters.push(operation);
    }

    if (filterKey) {
        var newFilter = {};
        newFilter[filterKey] = {"$in": filters};
        pull[expression] = newFilter;
    } else {
        pull[expression] = {"$in": filters};
    }
    newUpdate.$pull = pull;
}


function handleInsertDocuments(document, newUpdate, expression) {
    var push = newUpdate.$push ? newUpdate.$push : {};
    push[expression] = {"$each": document.updates};
    newUpdate.$push = push;
}

function handleUpdateDocuments(document, newUpdate, pExp) {
    var updatedFields = document.getUpdatedFields();
    for (var i = 0; i < updatedFields.length; i++) {
        var field = updatedFields[i];
        var documents = document.getDocuments(field);
        if (documents) {
            var newParentExp = pExp ? pExp + "." + field : field;
            if (Array.isArray(documents)) {
                var nestedArray = [];
                for (var j = 0; j < documents.length; j++) {
                    var document = documents[j];
                    if (document.type === "insert" || document.type === "update") {
                        nestedArray.push(document.convertToJSON());
                    }
                }
            } else {
                handleUpdateDocuments(documents, newUpdate, newParentExp);
            }
        } else {
            handleSimpleFields(document, newUpdate, field, pExp);
        }
    }
}