/**
 * Created with IntelliJ IDEA.
 * User: daffodil
 * Date: 24/4/14
 * Time: 7:02 PM
 * To change this template use File | Settings | File Templates.
 */

var Utils = require("ApplaneCore/apputil/util.js");
var Constants = require("../Constants.js");

exports.preInsert = function (doc, collection, db, callback) {
    removeChildDataFromRecord(doc, collection, db, callback);
}

exports.preUpdate = function (doc, collection, db, callback) {
    removeChildDataFromRecord(doc, collection, db, callback);
}

function removeChildDataFromRecord(doc, collection, db, callback) {
    try {
        collection.get(Constants.Admin.Collections.CHILDS, function (err, childs) {
            if (err) {
                callback(err);
                return;
            }
            Utils.iterateArray(childs, callback, function (child, callback) {
                if (!child.collection) {
                    throw new Error("Collection is mandatory in child [" + JSON.stringify(child) + "]");
                }
                if (!child.alias) {
                    throw new Error("Alias is mandatory in child [" + JSON.stringify(child) + "]");
                }
                var alias = child.alias;
                var aliasValue = doc.get(alias);
                doc.set(alias, undefined);
                doc.unset(alias, undefined);
                callback();
            });
        })
    } catch (e) {
        callback(e);
    }
}

exports.postInsert = function (doc, collection, db, callback) {
    try {
        collection.get(Constants.Admin.Collections.CHILDS, function (err, childs) {
            if (err) {
                callback(err);
                return;
            }
            var updateId = doc.get("_id");
            Utils.iterateArray(childs, callback, function (child, callback) {
                if (!child.fk) {
                    throw new Error("Fk is mandatory in child [" + JSON.stringify(child) + "]");
                }
                db.collection(child.collection, function (err, childCollection) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    var alias = child.alias;
                    var aliasValue = doc.get(alias);
                    if (aliasValue === undefined) {
                        callback();
                        return;
                    }
                    var collectionToPut = childCollection.options && childCollection.options[Constants.Admin.Collections.COLLECTION] ? childCollection.options : childCollection[Constants.Admin.Collections.COLLECTION];
                    if (Array.isArray(aliasValue)) {
                        //override case
                        removeChildRecords(collectionToPut, updateId, child, db, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            populateParentColumnId(updateId, child, aliasValue, childCollection, function (err) {
                                if (err) {
                                    callback(err);
                                    return;
                                }
                                var queryToInsertData = {};
                                queryToInsertData[Constants.Update.COLLECTION] = collectionToPut;
                                queryToInsertData[Constants.Update.INSERT] = aliasValue;
                                db.batchUpdateById([queryToInsertData], callback);
                            });
                        });
                    } else if (Utils.isJSONObject(aliasValue)) {
                        aliasValue[Constants.Update.COLLECTION] = collectionToPut;
                        var valueToUpdate = undefined;
                        for (var key in aliasValue) {
                            if (key == Constants.Update.INSERT) {
                                valueToUpdate = aliasValue[key];
                                break;
                            }
                        }
                        populateParentColumnId(updateId, child, valueToUpdate, childCollection, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            db.batchUpdateById([aliasValue], callback);
                        });
                    } else if (aliasValue == null) {
                        removeChildRecords(collectionToPut, updateId, child, db, callback);
                    } else {
                        throw new Error("Alias Value must be Object [" + aliasValue + "] in child [" + JSON.stringify(child));
                    }
                })
            })
        })
    } catch (e) {
        callback(e);
    }
}

function populateParentColumnId(updateId, child, value, childCollection, callback) {
    if (!value) {
        callback();
        return;
    }
    childCollection.get(Constants.Admin.Collections.CHILDS, function (err, innerChilds) {
        if (err) {
            callback(err);
            return;
        }
        addParentColumnId(value, innerChilds, child.fk, updateId);
        callback();
    })

}

function addParentColumnId(value, innerChilds, childFk, updateId) {
    if (value) {
        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                updateValue(innerChilds, value[i], childFk, updateId);
            }
        } else {
            updateValue(innerChilds, value, childFk, updateId);
        }
    }
}

function updateValue(innerChilds, value, childFk, updateId) {
    value[childFk] = {_id:updateId};
    var innerChildsLength = innerChilds ? innerChilds.length : 0;
    for (var j = 0; j < innerChildsLength; j++) {
        var alias = innerChilds[j].alias;
        if (value[alias]) {
            addParentColumnId(value[alias], innerChilds, childFk, updateId);
        }
    }
}

function removeChildRecords(collectionToPut, updatedId, child, db, callback) {
    var deleteQuery = {};
    deleteQuery[Constants.Query.COLLECTION] = collectionToPut;
    deleteQuery[Constants.Query.FIELDS] = {_id:1};
    var filter = {};
    filter[child.fk] = updatedId;
    deleteQuery[Constants.Query.FILTER] = filter;
    db.query(deleteQuery, function (err, valuesToDelete) {
        if (err) {
            callback(err);
            return;
        }
        var queryToRemoveData = {};
        queryToRemoveData[Constants.Update.COLLECTION] = collectionToPut;
        queryToRemoveData[Constants.Update.DELETE] = valuesToDelete.result;
        db.batchUpdateById([queryToRemoveData], callback);
    })
}

exports.postUpdate = function (doc, collection, db, callback) {
    this.postInsert(doc, collection, db, callback);
}

exports.doQuery = function (query, collection, db, callback) {
    try {
        var queryChilds = query[Constants.Query.CHILDS];
        if (!queryChilds || Object.keys(queryChilds).length == 0) {
            callback();
            return;
        }
        delete  query[Constants.Query.CHILDS];
        var queryChildAliases = Object.keys(queryChilds);
        Utils.iterateArray(queryChildAliases, callback, function (queryChildAlias, callback) {
            var queryChildValue = queryChilds[queryChildAlias];
            getChildDef(queryChildValue, queryChildAlias, collection, function (err, childDef) {
                if (err) {
                    callback(err);
                    return;
                }
                if (!childDef) {
                    throw new Error("Child Defination not found for child alias [" + queryChildAlias + "]");
                }
                var innerQuery = childDef.query || {$collection:childDef.collection};
                var childCollectionName = typeof  childDef.collection == "string" ? childDef.collection : childDef.collection.collection;
                addRecursionInQuery(innerQuery, childCollectionName, db, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    addSubQuery(query, queryChildAlias, innerQuery, childDef.fk);
                    callback();
                })
            })
        })
    } catch (e) {
        callback(e);
    }
}

function addRecursionInQuery(innerQuery, collectionName, db, callback) {
    var innerQueryChilds = innerQuery[Constants.Query.CHILDS];
    if (!innerQueryChilds || Object.keys(innerQueryChilds).length == 0) {
        callback();
        return;
    }
    var innerQueryChildAliases = Object.keys(innerQueryChilds);
    var recursiveAlias = undefined;
    Utils.iterateArray(innerQueryChildAliases, function (err) {
        if (err) {
            callback(err);
            return;
        }
        if (!recursiveAlias) {
            callback();
            return;
        }
        if (Object.keys(recursiveAlias).length > 1) {
            throw new Error("More than one recursive columns found in child [" + JSON.stringify(recursiveAlias) + "]");
        }
        var recursiveChildAlias = Object.keys(recursiveAlias)[0];
        var fkColumn = recursiveAlias[recursiveChildAlias].fk;
        innerQuery[Constants.Query.FILTER] = innerQuery[Constants.Query.FILTER] || {};
        if (!innerQuery[Constants.Query.FILTER][fkColumn]) {
            innerQuery[Constants.Query.FILTER][fkColumn] = null;
        }
        if (!innerQuery[Constants.Query.RECURSION]) {
            var recursion = {};
            recursion[fkColumn] = "_id";
            recursion[Constants.Query.Recursion.ALIAS] = recursiveChildAlias;
            innerQuery[Constants.Query.RECURSION] = recursion;
        }
        callback(null, {return:true});
    }, function (innerQueryChildAlias, callback) {
        var innerQueryChildValue = innerQueryChilds[innerQueryChildAlias];
        db.collection(innerQuery[Constants.Query.COLLECTION], function (err, innerQueryCollection) {
            if (err) {
                callback(err);
                return;
            }
            getChildDef(innerQueryChildValue, innerQueryChildAlias, innerQueryCollection, function (err, childDef) {
                if (err) {
                    callback(err);
                    return;
                }
                if (!childDef) {
                    throw new Error("Child Defination not found for child alias [" + innerQueryChildAlias + "]");
                }
                var innerCollectionName = typeof  childDef.collection == "string" ? childDef.collection : childDef.collection.collection;
                if (collectionName == innerCollectionName) {
                    delete innerQueryChilds[innerQueryChildAlias];
                    recursiveAlias = recursiveAlias || {};
                    recursiveAlias[innerQueryChildAlias] = childDef;
                }
                callback();
            })
        })
    })
}

function getChildDef(childValue, queryChildAlias, collection, callback) {
    if (Utils.isJSONObject(childValue)) {
        callback(null, childValue);
    } else if (childValue == 1) {
        collection.get(Constants.Admin.Collections.CHILDS, function (err, childs) {
            if (err) {
                callback(err);
                return;
            }
            var childDef = undefined;
            if (childs && childs.length > 0) {
                for (var i = 0; i < childs.length; i++) {
                    if (childs[i].alias == queryChildAlias) {
                        childDef = childs[i];
                        break;
                    }
                }
            }
            callback(null, childDef);
        })
    } else {
        throw new Error("Child having value [" + childValue + "] is not defined proper");
    }
}

function addSubQuery(query, alias, innerQuery, fk) {
    var subQuery = {};
    subQuery[Constants.Query.Fields.TYPE] = "n-rows";
    subQuery[Constants.Query.Fields.QUERY] = innerQuery;
    subQuery[Constants.Query.Fields.FK] = fk
    subQuery[Constants.Query.Fields.PARENT] = "_id";
    query[Constants.Query.FIELDS] = query[Constants.Query.FIELDS] || {};
    query[Constants.Query.FIELDS][alias] = subQuery;
}

