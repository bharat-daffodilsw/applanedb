var DBS = {};
var MongoClient = require("mongodb").MongoClient;
var SELF = require("./DB.js");
var Utility = require("ApplaneCore/apputil/util.js")
var Collection = require("./Collection.js");
var Constants = require("./Constants.js");
var GridStore = require('mongodb').GridStore;
var ObjectID = require("mongodb").ObjectID;
var ApplaneDBError = require("./ApplaneDBError.js");
var Config = require("../Config.js");
var DBCodes = {};

var modules = [];
var globalCollections = {
    __collections__:{collection:Constants.Admin.COLLECTIONS, fields:[
        {field:Constants.Admin.Collections.COLLECTION, type:"string", mandatory:true}
    ], childs:[
        {collection:Constants.Admin.FIELDS, alias:"fields", fk:Constants.Admin.Fields.COLLECTION_ID}
    ], merge:{collection:"union"}},
    __fields__:{collection:Constants.Admin.FIELDS, fields:[
        {field:Constants.Admin.Fields.FIELD, type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:Constants.Admin.Fields.COLLECTION_ID, type:Constants.Admin.Fields.Type.FK, "collection":Constants.Admin.COLLECTIONS, set:[Constants.Admin.Collections.COLLECTION], mandatory:true},
        {field:Constants.Admin.Fields.PARENT_FIELD_ID, type:Constants.Admin.Fields.Type.FK, "collection":Constants.Admin.FIELDS, set:[Constants.Admin.Fields.FIELD]}
    ], triggers:[
        {
            functionName:"Field_Trigger",
            operations:["insert", "update", "delete"],
            when:"post"
        }
    ], childs:[
        {collection:Constants.Admin.FIELDS, alias:"fields", fk:Constants.Admin.Fields.PARENT_FIELD_ID}
    ]},
    __referredfks__:{collection:"__roles__", fields:[
        {field:Constants.Admin.ReferredFks.COLLECTION_ID, type:Constants.Admin.Fields.Type.FK, "collection":Constants.Admin.COLLECTIONS, set:[Constants.Admin.Collections.COLLECTION], mandatory:true},
        {field:Constants.Admin.ReferredFks.FIELD, type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:Constants.Admin.ReferredFks.SET, type:Constants.Admin.Fields.Type.STRING, multiple:true, mandatory:true},
        {field:Constants.Admin.ReferredFks.REFERRED_COLLECTION_ID, type:Constants.Admin.Fields.Type.FK, "collection":Constants.Admin.COLLECTIONS, set:[Constants.Admin.Collections.COLLECTION], mandatory:true},
        {field:Constants.Admin.ReferredFks.REFERRED_FIELD_ID, type:Constants.Admin.Fields.Type.FK, "collection":Constants.Admin.FIELDS, set:[Constants.Admin.Fields.FIELD], mandatory:true}
    ], triggers:[
        {
            functionName:"Referred_Fks_Trigger",
            operations:["insert"],
            when:"post"
        }
    ]},
    __roles__:{collection:"__roles__", fields:[
        {field:"role", type:Constants.Admin.Fields.Type.STRING, mandatory:true}
    ]},
    __users__:{collection:"__users__", fields:[
        {field:"username", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"emailid", type:Constants.Admin.Fields.Type.STRING},
        {field:"password", type:Constants.Admin.Fields.Type.STRING},
        {field:"roles", type:Constants.Admin.Fields.Type.OBJECT, multiple:true, fields:[
            {field:"role", type:Constants.Admin.Fields.Type.FK, "collection":"__roles__", set:["role"]}
        ]}


    ]},
    __applications__:{collection:"__applications__", fields:[
        {field:"label", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"db", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"roles", type:Constants.Admin.Fields.Type.OBJECT, multiple:true, fields:[
            {field:"role", type:Constants.Admin.Fields.Type.FK, "collection":"__roles__", set:["role"]}
        ]}


    ]},
    __menus__:{collection:"__menus__", fields:[
        {field:"label", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"index", type:Constants.Admin.Fields.Type.DECIMAL},
        {field:"collection", type:Constants.Admin.Fields.Type.STRING},
        {field:"parentmenu", type:Constants.Admin.Fields.Type.FK, "collection":"__menus__", set:["label"]},
        {field:"application", type:Constants.Admin.Fields.Type.FK, "collection":"__applications__", set:["label"]},
        {field:"defaultquickview", type:Constants.Admin.Fields.Type.FK, "collection":"__qviews__", set:["id"]},
        {field:"qviews", type:Constants.Admin.Fields.Type.OBJECT, multiple:true, fields:[
            {field:"label", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
            {field:"quickview", type:Constants.Admin.Fields.Type.FK, "collection":"__qviews__", set:["id"]},
            {field:"index", type:Constants.Admin.Fields.Type.DECIMAL}
        ]}
    ], triggers:[
        {
            functionName:"Menu_Trigger",
            operations:["insert", "update"],
            when:"pre"
        }
    ]},
    __qviews__:{collection:"__qviews__", fields:[
        {field:"id", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"collection", type:Constants.Admin.Fields.Type.FK, "collection":"__collections__", set:["collection"]}
    ]},
    __actions__:{collection:"__actions__", fields:[
        {field:"label", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"type", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
        {field:"onRow", type:Constants.Admin.Fields.Type.BOOLEAN},
        {field:"onHeader", type:Constants.Admin.Fields.Type.BOOLEAN},
        {field:"index", type:Constants.Admin.Fields.Type.DECIMAL},
        {field:"collection", type:Constants.Admin.Fields.Type.STRING},
        {field:"filter", type:Constants.Admin.Fields.Type.JSON},
        {field:"parameters", type:Constants.Admin.Fields.Type.JSON},
        {field:Constants.Admin.Fields.COLLECTION_ID, type:Constants.Admin.Fields.Type.FK, "collection":Constants.Admin.COLLECTIONS, set:[Constants.Admin.Collections.COLLECTION], mandatory:true},
        {field:"defaultquickview", type:Constants.Admin.Fields.Type.FK, "collection":"__qviews__", set:["id"]},
        {field:"qviews", type:Constants.Admin.Fields.Type.OBJECT, multiple:true, fields:[
            {field:"label", type:Constants.Admin.Fields.Type.STRING, mandatory:true},
            {field:"quickview", type:Constants.Admin.Fields.Type.FK, "collection":"__qviews__", set:["id"]},
            {field:"index", type:Constants.Admin.Fields.Type.DECIMAL}
        ]}
    ], triggers:[
        {
            functionName:"Action_Trigger",
            operations:["insert", "update"],
            when:"pre"
        }
    ]}
};

var systemFunctions = {
    Field_Trigger:{code:"populateRefferedFks", source:"ApplaneDB/lib/Triggers/Fields.js"},
    Referred_Fks_Trigger:{code:"populateRefferedFks", source:"ApplaneDB/lib/Triggers/ReferredFks.js"},
    Menu_Trigger:{code:"handleMenu", source:"ApplaneApps/lib/apps/triggers/Menus.js"},
    Action_Trigger:{code:"handleAction", source:"ApplaneApps/lib/apps/triggers/Action.js"},
    getUserState:{code:"getUserState", source:"ApplaneApps/lib/apps/UserState.js"},
    getView:{code:"getView", source:"ApplaneApps/lib/apps/View.js"},
    getMenuState:{code:"getMenuState", source:"ApplaneApps/lib/apps/UserState.js"},
    _CurrentDate:{code:"getCurrentDate", source:"ApplaneDB/lib/modules/Function.js"},
    "_CurrentDate+1":{code:"getNextDate", source:"ApplaneDB/lib/modules/Function.js"},
    _CurrentUser:{code:"getCurrentUser", source:"ApplaneDB/lib/modules/Function.js"}
}


var DB = function (db, user, options) {
    this.db = db;
    this.user = user;
    this.options = options;
}


exports.HTTP = require("./Http.js");
exports.connect = function (url, db, options, callback) {
    if (!db) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[db] while connect", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }
    if (typeof options == "function") {
        callback = options;
        options = {};
    }
    url += "/" + db + "/";
    connectToMongo(url, function (err, mongoDB) {
        if (err) {
            callback(err);
            return;
        }
        var userCollection = mongoDB.collection(Constants.Admin.USERS);
        userCollection.find().count(function (err, count) {
            if (err) {
                callback(err);
                return;
            }
            var userExists = count > 0;

            var userName = options[Constants.Admin.Users.USER_NAME];
            var pwd = options[Constants.Admin.Users.PASSWORD];
            var dbCode = options.dbcode;

            if (userExists) {
                if (dbCode) {
                    if (!DBCodes || !DBCodes[dbCode] || DBCodes[dbCode] !== db) {
                        callback(new ApplaneDBError(Constants.ErrorCode.INVALID_DB_CODE.MESSAGE, Constants.ErrorCode.INVALID_DB_CODE.CODE));
                        return;
                    }
                }
                if (userName) {
                    var filter = {username:userName};
                    if (dbCode) {
                        if (pwd) {
                            filter.password = pwd;
                        }
                    } else {
                        filter.password = pwd;
                    }
                    userCollection.findOne(filter, {fields:{username:1}}, function (err, user) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        if (!user) {
                            callback(new ApplaneDBError(Constants.ErrorCode.CREDENTIAL_MISSMATCH.MESSAGE, Constants.ErrorCode.CREDENTIAL_MISSMATCH.CODE))
                            return;
                        }
                        callback(null, new DB(mongoDB, user, options))
                    });
                } else {
                    callback(new ApplaneDBError(Constants.ErrorCode.CREDENTIAL_MISSMATCH.MESSAGE, Constants.ErrorCode.CREDENTIAL_MISSMATCH.CODE))
                    return;
                }
            } else {
                if (userName && pwd) {
                    userCollection.insert({_id:Utility.getUnique(), username:userName, password:pwd, admin:true}, function (err, users) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        callback(null, new DB(mongoDB, users[0], options));
                    });
                } else {
                    callback(null, new DB(mongoDB, undefined, options));
                }
            }
        });


    });
}

DB.prototype.adminDB = function (callback) {
    if (this.adminDb) {
        callback(null, this.adminDb)
    } else {
        var adminUrl = Config.URL + "/" + Config.Admin.DB + "/";
        connectToMongo(adminUrl, function (err, adminDb) {
            if (err) {
                callback(err);
                return;
            }
            this.adminDb = adminDb;
            callback(null, adminDb);
        });
    }
}

DB.prototype.isAdminDB = function () {
    return this.db.databaseName === Config.Admin.DB;
}


function connectToMongo(url, callback) {
    if (DBS[url]) {
        callback(null, DBS[url]);
        return;
    }
    MongoClient.connect(url, function (err, db) {
        if (err) {
            callback(err);
            return;
        }
        db.authenticate(Config.MongoAdmin.USER_NAME, Config.MongoAdmin.PASSWORD, {authdb:Config.MongoAdmin.DB}, function (err, res) {

            if (err) {
                console.log("auth error>>>" + err)
                callback(err);
            } else if (!res) {
                console.log("not auth ")
                callback(new Error("Auth fails"));
            } else {
                DBS[url] = db;
                callback(null, db);
            }

        })


    })
}


DB.prototype.addUser = function (username, password, otherFields, callback) {
    //check if current user is admin or not
    if (typeof otherFields == "function") {
        callback = otherFields;
        otherFields = undefined;
    }
    if (!this.user || !this.user._id) {
        callback(new ApplaneDBError(Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.MESSAGE, Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.CODE))
        return;
    }

    if (!username) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[username]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }
    if (!password) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[password]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }

    //check if current user is admin or not
    var userQuery = {$collection:Constants.Admin.USERS, $filter:{_id:this.user._id, admin:true}};
    this.query(userQuery, function (err, adminInfo) {
            if (!adminInfo || !adminInfo.result || adminInfo.result.length == 0) {
                callback(new ApplaneDBError(Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.MESSAGE, Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.CODE))
                return;
            }


        }
    )


    var that = this;
    var userCollection = that.db.collection(Constants.Admin.USERS);
    userCollection.find().count(function (err, count) {
        if (err) {
            callback(err);
            return;
        }
        var userExists = count > 0;
        if (!userExists) {
            callback(new ApplaneDBError(Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.MESSAGE, Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.CODE))
            return;
        }
        //check user
        var userQuery = {$collection:Constants.Admin.USERS, $filter:{username:username}};
        var that = this;
        that.query(userQuery, function (err, result) {
            if (err) {
                callback(err);
                return;
            }
            if (result && result.result && result.result > 0) {
                callback(new ApplaneDBError(Constants.ErrorCode.USER_ALREADY_EXISTS.MESSAGE, Constants.ErrorCode.USER_ALREADY_EXISTS.CODE));
                return;
            }
            var userUpdates = otherFields || {};
            userUpdates.username = username;
            userUpdates.password = password;

            that.batchUpdateById({$collection:Constants.Admin.USERS, $insert:userUpdates}, function (err, userResult) {
                if (err) {
                    callback(err);
                    return;
                }
                userResult = userResult[Constants.Admin.USERS].$insert[0];
                delete userResult.password;
                callback(null, userResult);
            })


        });
    });

}

DB.prototype.addMongoUser = function (username, passowrd, options, callback) {
    // if auth enabled, then add user in this database
}

/**
 *role : name of role
 * rights : {collection : 1 OR
 *                          0 OR
 *                          {
 *                              $fields:{task:1,cost:0},
 *                              $filter:{}
 *                            }
 *            }
 *
 *
 */
DB.prototype.addRole = function (role, rights, callback) {

}


function executeQuery(query, db, collection, callback) {
    if (query[Constants.Query.DATA]) {
        callback(null, query[Constants.Query.DATA]);
        return;
    }
    collection.get(Constants.Admin.Collections.MERGE, function (err, merge) {
        if (err) {
            callback(err);
            return;
        }
        if (query[Constants.Query.UNWIND] || query[Constants.Query.GROUP]) {
            var pipeLines = [];
            if (query[Constants.Query.UNWIND]) {
                for (var i = 0; i < query[Constants.Query.UNWIND].length; i++) {
                    pipeLines.push({$unwind:"$" + query[Constants.Query.UNWIND][i]});
                }
            }
            if (query[Constants.Query.FILTER]) {
                pipeLines.push({$match:query[Constants.Query.FILTER]});
            }
            if (query[Constants.Query.GROUP]) {
                if (Array.isArray(query[Constants.Query.GROUP])) {
                    for (var i = 0; i < query[Constants.Query.GROUP].length; i++) {
                        populateGroup(pipeLines, query[Constants.Query.GROUP][i]);
                    }
                } else {
                    populateGroup(pipeLines, query[Constants.Query.GROUP]);
                }
            }

            if (query[Constants.Query.FIELDS]) {
                pipeLines.push({$project:query[Constants.Query.FIELDS]});
            }
            if (query[Constants.Query.SORT]) {
                pipeLines.push({$sort:query[[Constants.Query.SORT]]});
            }
            console.log("pipeline>>>>>>>>>" + JSON.stringify(pipeLines));
            if (merge && db.db.databaseName !== Config.Admin.DB && Object.keys(merge).length > 0) {
                mergePipelineData(db, collection, merge, pipeLines, callback);
            } else {
                collection.aggregate(pipeLines, callback);
            }
        } else {
            var filter = query[Constants.Query.FILTER];
            var options = {fields:query[Constants.Query.FIELDS], sort:query[Constants.Query.SORT], limit:query[Constants.Query.LIMIT], skip:query[Constants.Query.SKIP]};
            if (merge && db.db.databaseName !== Config.Admin.DB && Object.keys(merge).length > 0) {
                mergeQueryData(db, collection, merge, filter, options, callback);
            } else {
                collection.find(filter, options).toArray(callback);
            }
        }
    })
}

function mergePipelineData(db, collection, merge, pipeLines, callback) {
    var mergeCollection = merge.collection;
    if (mergeCollection === "override") {
        collection.count({}, {}, function (err, count) {
            if (count > 0) {
                console.log("count >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>" + JSON.stringify(count));
                collection.aggregate(pipeLines, callback);
            } else {
                db.adminDB(function (err, adminDb) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    adminDb.collection(collection.mongoCollection.collectionName).aggregate(pipeLines, callback);
                })
            }
        });
    } else {
        callback(new Error("Merge is not supported for collection other than override in case of unwind/group for collection [" + collection.mongoCollection.collectionName + "]"));
    }
}

function mergeQueryData(db, collection, merge, filter, options, callback) {
    var mergeCollection = merge.collection;
    if (mergeCollection === "override") {
        collection.count({}, options, function (err, count) {
            if (count > 0) {
                collection.find(filter, options).toArray(callback);
            } else {
                db.adminDB(function (err, adminDb) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    adminDb.collection(collection.mongoCollection.collectionName).find(filter, options).toArray(callback);
                })
            }
        });
    } else {
        db.adminDB(function (err, adminDb) {
            if (err) {
                callback(err);
                return;
            }
            adminDb.collection(collection.mongoCollection.collectionName).find(filter, options).toArray(function (err, adminResult) {
                if (err) {
                    callback(err);
                    return;
                }
                var adminIds = [];
                for (var i = 0; i < adminResult.length; i++) {
                    adminIds.push(adminResult[i]._id);
                }
                collection.find({_id:{$in:adminIds}}, options).toArray(function (err, localResult) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    mergeResult(adminResult, localResult, merge.fields);
                    filter = filter || {};
                    filter.__type__ = "insert";
                    collection.find(filter, options).toArray(function (err, newlocalData) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        adminResult.push.apply(adminResult, newlocalData);
//                        for (var i = 0; i < newlocalData.length; i++) {
//                            delete newlocalData[i].__type__;
//                            adminResult.push(newlocalData[i]);
//                        }
                        var fieldToSort = undefined;
                        var sortType = undefined;
                        if (options && options.sort) {
                            var sortKeys = Object.keys(options.sort);
                            if (sortKeys.length > 1) {
                                callback(new Error("Sorting not allowed on multiple fields in merge is defined in collection [" + collection.mongoCollection.collectionName + "]"));
                                return;
                            } else if (sortKeys.length == 1) {
                                fieldToSort = sortKeys[0];
                                sortType = options.sort[sortKeys[0]] == 1 ? "asc" : "desc";
                            }
                        }
                        if (fieldToSort) {
                            Utility.sort(adminResult, sortType, fieldToSort);
                        }
                        callback(null, adminResult);
                    });
                });
            });
        })
    }
}

function mergeResult(mainResult, resultToMerge, mergeFields) {
    for (var i = 0; i < resultToMerge.length; i++) {
        var row = resultToMerge[i];
        var index = Utility.isExists(mainResult, row, "_id");
        if (index === undefined) {
            throw new Error("Record does not exist in Admindb [" + JSON.stringify(row) + "]");
        }
        if (row.__type__ && row.__type__ === "delete") {
            mainResult.splice(index, 1);
        } else {
            merge(mainResult[index], row, mergeFields);
        }
    }
}

function merge(mainRecord, recordToMerge, mergeFields) {
    for (var exp in recordToMerge) {
        var value = recordToMerge[exp];
        var mergeFieldValue = mergeFields ? mergeFields[exp] : undefined;
        if (mainRecord[exp] === undefined || (mergeFieldValue && mergeFieldValue === "override")) {
            mainRecord[exp] = value;
        } else {
            var mainRecordValue = mainRecord[exp];
            if (Array.isArray(value)) {
                for (var i = 0; i < value.length; i++) {
                    if (Utility.isJSONObject(value[i])) {
                        var index = Utility.isExists(mainRecordValue, value[i], "_id");
                        if (index === undefined) {
                            mainRecordValue.push(value[i]);
                        } else {
                            if (value[i].__type__ && value[i].__type__ === "delete") {
                                mainRecordValue.splice(index, 1);
                            } else {
                                merge(mainRecordValue[index], value[i], Utility.isJSONObject(mergeFieldValue) ? mergeFieldValue : undefined);
                            }
                        }
                    } else {
                        mainRecord[exp] = value;
                        break;
                    }
                }
            } else if (Utility.isJSONObject(value)) {
                merge(mainRecordValue, value, Utility.isJSONObject(mergeFieldValue) ? mergeFieldValue : undefined);
            } else {
                if (value == null && mainRecord[exp]) {
                    delete mainRecord[exp];
                } else {
                    mainRecord[exp] = value;
                }
            }
        }
    }
}

function populateGroup(pipeLines, group) {
    pipeLines.push({$group:group});
    if (group[Constants.Query.FILTER]) {
        pipeLines.push({$match:group[Constants.Query.FILTER]});
        delete group[Constants.Query.FILTER];
    }
    if (group[Constants.Query.SORT]) {
        pipeLines.push({$sort:group[Constants.Query.SORT]});
        delete group[Constants.Query.SORT];
    }
}

function batchUpdateInternalById(type, batchUpdate, batchResult, callback) {
    if (!batchUpdate[type]) {
        callback();
        return;
    }
    var that = this;
    if (Utility.isJSONObject(batchUpdate[type])) {
        batchUpdate[type] = [batchUpdate[type]];
    }
    Utility.iterateArray(batchUpdate[type], callback, function (operation, callback) {
        try {
            if (!batchUpdate[Constants.Update.COLLECTION]) {

                callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[" + Constants.Update.COLLECTION + "]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
                return;
            }


            that.collection(batchUpdate[Constants.Update.COLLECTION], function (err, collection) {
                if (err) {
                    callback(err);
                    return;
                }
                collection.get(Constants.Admin.Collections.COLLECTION, function (err, collectionName) {
                    try {
                        var resultCallback = function (err, result) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            batchResult[collectionName] = batchResult[collectionName] || {};
                            batchResult[collectionName][type] = batchResult[collectionName][type] || [];
                            if (type == Constants.Update.INSERT) {
                                result = result && result.length > 0 ? result[0] : undefined;
                            }
                            batchResult[collectionName][type].push(result);
                            callback();
                        }
                        if (type == Constants.Update.UPSERT) {
                            var newOperation = {};
                            if (operation.$set) {
                                newOperation.$set = operation.$set;
                            }
                            if (operation.$unset) {
                                newOperation.$unset = operation.$unset;
                            }
                            if (operation.$inc) {
                                newOperation.$inc = operation.$inc;
                            }
                            if (operation[Constants.Update.Upsert.QUERY]) {
                                collection.upsert(operation[Constants.Update.Upsert.QUERY], newOperation, operation[Constants.Update.Upsert.FIELDS], {w:1}, resultCallback);
                            } else {
                                resultCallback();
                            }
                        }

                        if (type == Constants.Update.INSERT) {
                            collection.insert(operation, batchUpdate[Constants.Query.MODULES], {w:1}, resultCallback)
                        } else if (type == Constants.Update.UPDATE) {
                            var newOperation = {};
                            if (operation.$set) {
                                newOperation.$set = operation.$set;
                            }
                            if (operation.$unset) {
                                newOperation.$unset = operation.$unset;
                            }
                            if (operation.$inc) {
                                newOperation.$inc = operation.$inc;
                            }
                            collection.updateById(operation._id, newOperation, batchUpdate[Constants.Query.MODULES], {w:1}, resultCallback)
                        } else if (type == Constants.Update.DELETE) {
                            collection.removeById(operation._id, batchUpdate[Constants.Query.MODULES], {w:1}, resultCallback)
                        }

                    } catch (e) {
                        callback(e);
                    }
                })
            })
        } catch (e) {
            console.log("Error>>>" + e)
            callback(e);
        }
    })

}

function batchUpdateInternal(type, batchUpdate, batchResult, options, callback) {
    if (!batchUpdate[type]) {
        callback();
        return;
    }
    var that = this;
    if (Utility.isJSONObject(batchUpdate[type])) {
        batchUpdate[type] = [batchUpdate[type]];
    }
    Utility.iterateArray(batchUpdate[type], callback, function (operation, callback) {
        try {
            //child doubt TODO
//            that.collection(batchUpdate.$collection, {$fields:batchUpdate.$fields, $childs:batchUpdate.$childs}, function (err, collection) {
            that.collection(batchUpdate[Constants.Update.COLLECTION], function (err, collection) {
                if (err) {
                    callback(err);
                    return;
                }
                collection.get(Constants.Admin.Collections.COLLECTION, function (err, collectionName) {
                    try {
                        var resultCallback = function (err, result) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            batchResult[collectionName] = batchResult[collectionName] || {};
                            batchResult[collectionName][type] = batchResult[collectionName][type] || [];
                            if (type == Constants.Update.INSERT) {
                                result = result[0];
                            }
                            batchResult[collectionName][type].push(result);
                            callback();
                        }
                        if (type == Constants.Update.INSERT) {
                            collection.mongoInsert(operation, options, resultCallback);
                        } else if (type == Constants.Update.UPDATE) {
                            var newOperation = {};
                            if (operation.$set) {
                                newOperation.$set = operation.$set;
                            }
                            if (operation.$unset) {
                                newOperation.$unset = operation.$unset;
                            }
                            if (operation.$inc) {
                                newOperation.$inc = operation.$inc;
                            }
                            if (operation.$push) {
                                newOperation.$push = operation.$push;
                            }
                            if (operation.$pull) {
                                newOperation.$pull = operation.$pull;
                            }
                            collection.update(operation[Constants.Update.QUERY], newOperation, options, resultCallback);
                        } else if (type == Constants.Update.DELETE) {
                            collection.remove(operation, options, resultCallback);
                        }

                    } catch (e) {
                        callback(e);
                    }
                })
            })
        } catch (e) {
            console.log("Error>>>" + e)
            callback(e);
        }
    })

}


DB.prototype.batchUpdateById = function (batchUpdates, callback) {
    try {
        if (!callback || (typeof callback != 'function')) {
            throw new Error("callback not defined in DB.prototype.batchUpdate");
        }
        var that = this;
        var batchResult = {};
        if (Utility.isJSONObject(batchUpdates)) {
            batchUpdates = [batchUpdates];
        }
        Utility.iterateArray(batchUpdates, function (err) {
            callback(err, batchResult);

        }, function (batchUpdate, callback) {
            try {
                batchUpdateInternalById.call(that, Constants.Update.UPSERT, batchUpdate, batchResult, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    batchUpdateInternalById.call(that, Constants.Update.INSERT, batchUpdate, batchResult, function (err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        batchUpdateInternalById.call(that, Constants.Update.UPDATE, batchUpdate, batchResult, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            batchUpdateInternalById.call(that, Constants.Update.DELETE, batchUpdate, batchResult, function (err) {
                                if (err) {
                                    callback(err);
                                    return;
                                }
                                callback();
                            });
                        });
                    });
                });
            } catch (e) {
                callback(e);
            }

        })
    } catch (e) {
        callback(e);
    }
}

DB.prototype.batchUpdate = function (batchUpdates, options, callback) {
    try {
        if (typeof options == "function") {
            callback = options;
            options = {w:1};
        }
        if (!callback || (typeof callback != 'function')) {
            throw new Error("callback not defined in DB.prototype.batchUpdate");
        }
        var that = this;
        var batchResult = {};
        if (Utility.isJSONObject(batchUpdates)) {
            batchUpdates = [batchUpdates];
        }
        Utility.iterateArray(batchUpdates, function (err) {
            callback(err, batchResult);

        }, function (batchUpdate, callback) {
            try {
                batchUpdateInternal.call(that, Constants.Update.INSERT, batchUpdate, batchResult, options, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    batchUpdateInternal.call(that, Constants.Update.UPDATE, batchUpdate, batchResult, options, function (err) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        batchUpdateInternal.call(that, Constants.Update.DELETE, batchUpdate, batchResult, options, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            callback();
                        });
                    });
                });
            } catch (e) {
                callback(e);
            }

        })
    } catch (e) {
        callback(e);
    }
}

DB.prototype.query = function (query, callback) {
    try {
        var queryId = Utility.getUnique();
        var that = this;
        if (!query[Constants.Query.COLLECTION]) {
            callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[" + Constants.Query.COLLECTION + "]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
            return;
        }

        this.collection(query[Constants.Query.COLLECTION], function (err, collection) {
            if (err) {
                callback(err);
                return;
            }
            try {
                var ModuleManager = require("./ModuleManager.js");
//                console.log("+++++++++++++++++++++++++++queryClone >>>>>>>>>>>>>>>>>>>>>>" + JSON.stringify(queryClone));
                var queryClone = require("ApplaneCore/apputil/util.js").deepClone(query);
                ModuleManager.doQuery(queryId, queryClone, collection, that, function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    executeQuery(queryClone, that, collection, function (err, result) {
                        if (err) {
                            callback(err);
                            return;
                        }
//                        console.log("+++++++++++++++++++++++++++result >>>>>>>>>>>>>>>>>>>>>>" + JSON.stringify(result));
                        var queryResult = {result:result};
                        ModuleManager.doResult(queryId, queryClone, queryResult, collection, that, function (err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            callback(null, queryResult);
                        })

                    });

                })
            } catch (e) {
                callback(e);
            }
        });


    } catch (e) {
        callback(e);
    }
}

DB.prototype.batchQuery = function (batchQueries, callback) {
    try {
        if (!callback || (typeof callback != 'function')) {
            throw new Error("callback not defined in DB.prototype.batchQuery");
        }
        var that = this;
        var batchResult = {};
        var keys = Object.keys(batchQueries);
        //TODO need to call Async or not
        //TODO query corresponds to alias direct or with in json of query.

        Utility.iterateArray(keys, function () {
            callback(null, batchResult);
        }, function (key, callback) {
            var innerQuery = batchQueries[key];
            that.query(innerQuery, function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                batchResult[key] = data;
                callback();
            })
        })
    } catch (e) {
        callback(e);
    }
}

/**
 *  collection : string (populate it from schema passed)OR
 *  collection : JSON object with complete field definiton
 *
 *
 */

DB.prototype.collection = function (collection, callback) {
    if (!collection) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[collection]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }
    var that = this;
    if (typeof collection == "string") {
        if (globalCollections[collection]) {
            callback(null, new Collection(that.db.collection(collection), that, globalCollections[collection]));
        } else {
            var collectionQuery = populateCollectionQuery(collection);
            that.query(collectionQuery, function (err, collectionResult) {
                if (err) {
                    callback(err);
                    return;
                }
                var collectionDef = {};
                if (collectionResult && collectionResult.result && collectionResult.result.length > 0) {
                    collectionDef = collectionResult.result[0];
                }
                collectionDef[Constants.Admin.Collections.COLLECTION] = collection;
                callback(null, new Collection(that.db.collection(collection), that, collectionDef));
            })
        }
    } else {
        callback(null, new Collection(that.db.collection(collection[Constants.Admin.Collections.COLLECTION]), that, Utility.deepClone(collection)));
    }
}

function populateCollectionQuery(collectionName) {
    var fieldsQuery = {};
    fieldsQuery[Constants.Query.Fields.TYPE] = "n-rows";
    var fieldsSubQuery = {};
    fieldsSubQuery[Constants.Query.COLLECTION] = Constants.Admin.FIELDS;
//    fieldsSubQuery[Constants.Query.FIELDS] = {field:1, type:1, mandatory:1, collection:1, set:1, multiple:1, parentfieldid:1};
    var innerFieldsFilter = {};
    innerFieldsFilter[Constants.Admin.Fields.PARENT_FIELD_ID] = null;
    fieldsSubQuery[Constants.Query.FILTER] = innerFieldsFilter;
    var innerFieldsRecursion = {};
    innerFieldsRecursion[Constants.Admin.Fields.PARENT_FIELD_ID ] = "_id";
    innerFieldsRecursion[Constants.Query.Recursion.ALIAS] = Constants.Admin.Collections.FIELDS;
    fieldsSubQuery[Constants.Query.RECURSION] = innerFieldsRecursion;

    fieldsQuery[Constants.Query.Fields.QUERY] = fieldsSubQuery;
    fieldsQuery[Constants.Query.Fields.FK] = Constants.Admin.Fields.COLLECTION_ID;
    fieldsQuery[Constants.Query.Fields.PARENT] = "_id";


    var query = {};
    query[Constants.Admin.Collections.COLLECTION] = Constants.Admin.COLLECTIONS;
    var filter = {};
    filter[Constants.Admin.Collections.COLLECTION] = collectionName;
    var collectionFields = {};
    collectionFields[Constants.Admin.Collections.COLLECTION] = 1;
    collectionFields[Constants.Admin.Collections.FIELDS] = fieldsQuery;

    var collection = {};
    collection[Constants.Query.COLLECTION] = query;
    collection[Constants.Query.FILTER] = filter;
    collection[Constants.Query.FIELDS] = collectionFields;
    return collection;
}

DB.prototype.dropDatabase = function (callback) {
    this.db.dropDatabase(callback);
}

DB.prototype.invokeFunction = function (functionName, parameters, callback) {
    var that = this;
    console.log(functionName);
    loadFunction.call(this, functionName, function (err, functionObject) {
        if (err) {
            callback(err);
            return;
        }
        if (functionObject) {
            var funParmeters = [];
            if (parameters) {
                parameters.forEach(function (parameter) {
                    funParmeters.push(parameter);
                });
            }
            funParmeters.push(that);
            funParmeters.push(callback);
            functionObject.apply(null, funParmeters);
        } else {
            callback(new Error("Function " + functionName + " not load."));
        }
    })
}

function loadFunction(functionName, callback) {
    if (require("ApplaneCore/apputil/util.js").isJSONObject(functionName)) {
        var source = functionName[Constants.Admin.Functions.SOURCE];
        callback(null, require(source)[functionName[Constants.Admin.Functions.CODE]]);
    } else if (systemFunctions[functionName]) {
        var source = systemFunctions[functionName][Constants.Admin.Functions.SOURCE];
        var requireModule = undefined;
        try {
            requireModule = require(source);
        } catch (e) {
            var newSource = process.cwd() + "/" + source;
            requireModule = require(newSource);
        }
        callback(null, requireModule[systemFunctions[functionName][Constants.Admin.Functions.CODE]]);
    } else {
        var query = {};
        query[Constants.Query.COLLECTION] = Constants.Admin.FUNCTIONS;
        var filter = {};
        filter[Constants.Admin.Functions.NAME] = functionName;
        query[Constants.Query.FILTER] = filter;
        this.query(query, function (err, functionInfo) {
            if (err) {
                callback(err);
                return;
            }
            if (functionInfo.result && functionInfo.result.length > 0) {
                var source = functionInfo.result[0][Constants.Admin.Functions.SOURCE];
                callback(null, require(source)[functionInfo.result[0][Constants.Admin.Functions.CODE]]);
            } else {
                callback(new Error("Function " + functionName + " not found."));
            }
        });
    }

}

DB.prototype.uploadFile = function (fileName, dataArray, callback) {
    var objectId = new ObjectID();
    var gridStore = new GridStore(this.db, objectId, fileName, "w");
    gridStore.open(function (err) {
        if (err) {
            callback(err);
            return;
        }
        Utility.iterateArray(dataArray, function (err) {
            if (err) {
                callback(err);
                return;
            }
            gridStore.close(function (err) {
                callback(err, objectId.toString());
            })
        }, function (buffer, callback) {
            gridStore.write(buffer, callback);
        })
    })
};

DB.prototype.downloadFile = function (fileKey, callback) {
    fileKey = new ObjectID(fileKey.toString());
    var gridStore = new GridStore(this.db, fileKey, "r");
    gridStore.open(function (err) {
        if (err) {
            callback(err);
            return;
        }
        gridStore.seek(0, 0, function (err) {
            if (err) {
                callback(err);
                return;
            }
            gridStore.read(function (err, data) {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, {metadata:{filename:gridStore.filename, contentType:gridStore.contentType}, data:data});
            });
        });
    });
};

exports.getDBFromCode = function (dbCode, callback) {
    if (!dbCode) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[dbcode]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }

    if (!DBCodes || !DBCodes[dbCode]) {

        callback(new ApplaneDBError(Constants.ErrorCode.INVALID_DB_CODE.MESSAGE, Constants.ErrorCode.INVALID_DB_CODE.CODE))
        return;
    }

    callback(null, DBCodes[dbCode]);
}
exports.configure = function (options, callback) {
    if (!options) {
        callback();
        return;
    }
    if (options.url) {
        Config.URL = options.url;
    }
    if (options.admin) {
        Config.Admin.DB = options.admin.db;
        Config.Admin.USER_NAME = options.admin.username;
        Config.Admin.PASSWORD = options.admin.password;
    }
    if (options.dbcode) {
        DBCodes[options.dbcode.code] = options.dbcode.db;
    }
    callback();
}
exports.addUserWithCode = function (url, dbCode, user, callback) {

    //check if current user is admin or not


    if (!dbCode) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[dbcode]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }
    if (!user || !user.username) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[username]", Constants.ErrorCode.MANDATORY_FIELDS.CODE))
        return;
    }

    if (!DBCodes || !DBCodes[dbCode]) {
        callback(new ApplaneDBError(Constants.ErrorCode.INVALID_DB_CODE.MESSAGE, Constants.ErrorCode.INVALID_DB_CODE.CODE))
        return;
    }
    delete user.admin;
    var db = DBCodes[dbCode];
    url += "/" + db + "/";

    connectToMongo(url, function (err, mongoDB) {
        if (err) {
            callback(err);
            return;
        }
        var that = this;
        var userCollection = mongoDB.collection(Constants.Admin.USERS);
        userCollection.find().count(function (err, count) {
            if (err) {
                callback(err);
                return;
            }
            var userExists = count > 0;
            if (!userExists) {
                callback(new ApplaneDBError(Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.MESSAGE, Constants.ErrorCode.ONLY_ADMIN_CAN_ADD_USER.CODE))
                return;
            }
            var applaneDB = new DB(mongoDB);
            //check user
            var userQuery = {$collection:Constants.Admin.USERS, $filter:{username:user.username}};

            applaneDB.query(userQuery, function (err, result) {
                if (err) {
                    callback(err);
                    return;
                }

                if (result && result.result && result.result.length > 0) {
                    callback(new ApplaneDBError(Constants.ErrorCode.USER_ALREADY_EXISTS.MESSAGE, Constants.ErrorCode.USER_ALREADY_EXISTS.CODE));
                    return;
                }
                applaneDB.batchUpdateById({$collection:Constants.Admin.USERS, $insert:user}, function (err, userResult) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    userResult = userResult[Constants.Admin.USERS].$insert[0];
                    delete userResult.password;
                    callback(null, userResult);
                })


            });
        });
    })


}
exports.addCollection = function (collections, callback) {
    if (!collections) {
        callback();
    }
    if (Array.isArray(collections)) {
        for (var i = 0; i < collections.length; i++) {
            var collection = collections[i].collection;
            globalCollections[collection] = collections[i];
        }

    } else if (collections.collection) {
        globalCollections[collections.collection] = collections;
    } else {
        for (var k in collections) {
            var collection = collections[k];
            globalCollections[collection.collection] = collection;
        }
    }
    callback();

}


exports.addFunction = function (functions, callback) {
    if (!functions) {
        callback();
    }
    if (Array.isArray(functions)) {
        for (var i = 0; i < functions.length; i++) {
            var fn = functions[i].name;
            systemFunctions[fn] = functions[i];
        }
    } else if (functions.name) {
        systemFunctions[functions.name] = functions;
    } else {
        for (var k in functions) {
            var fn = functions[k];
            systemFunctions[fn.name] = fn;
        }
    }
    callback();

}


DB.prototype.startTransaction = function (callback) {
    if (this.txid !== undefined) {
        throw new Error("Cannot start a new transaction until the transaction in progress is completed");
    }
    var txid = Utility.getUnique();
    this.txid = txid;
    /*
     * insert into the __txs__ collection on start a transaction
     * */
    var updates = [
        {$collection:Constants.TRANSACTIONS, $insert:[
            {_id:txid, status:"pending", txid:txid, updates:[]}
        ]}
    ];
    this.batchUpdate(updates, function (err, result) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, txid);
    });


}

DB.prototype.commitTransaction = function (callback) {
    var that = this;
    var updates = [
        {$collection:Constants.TRANSACTIONS, $update:[
            {$query:{_id:that.txid}, $set:{status:"commit"}}
        ]}
    ];
    that.batchUpdate(updates, function (err, result) {
        if (err) {
            callback(err);
            return;
        }
        var ModuleManager = require("./ModuleManager.js");
        ModuleManager.onCommit(that, function (err) {
            if (err) {
                callback(err);
                return;
            }
            that.txid = undefined;
            callback();
        });
    });
}

DB.prototype.rollbackTransaction = function (callback) {
    var that = this;
    var updates = [
        {$collection:Constants.TRANSACTIONS, $update:[
            {$query:{_id:that.txid}, $set:{status:"rollback"}}
        ]}
    ];
    that.batchUpdate(updates, function (err, result) {
        if (err) {
            callback(err);
            return;
        }
        var ModuleManager = require("./ModuleManager.js");
        ModuleManager.onRollback(that, function (err) {
            if (err) {
                callback(err);
                return;
            }
            that.txid = undefined;
            callback();
        });
    });
}


