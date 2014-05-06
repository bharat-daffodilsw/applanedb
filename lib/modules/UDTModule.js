/**
 * Created with IntelliJ IDEA.
 * User: Administrator
 * Date: 4/18/14
 * Time: 10:07 AM
 * To change this template use File | Settings | File Templates.
 */


var Constants = require("../Constants.js");
var Utils = require("ApplaneCore/apputil/util.js");


exports.doQuery = function (query, collection, db, callback) {
//    collection.get(Constants.Admin.Collections.FIELDS, function (err, fields) {
//        if (err) {
//            callback(err);
//            return;
//        }
//        var queryKeys = Object.keys(query);
//        if (queryKeys.indexOf(Constants.Query.GROUP) != -1) {
//            var group = query[Constants.Query.GROUP];
//            if (Array.isArray(group)) {
//                for (var i = 0; i < group.length; i++) {
//                    handleEachGroup(group[i], fields);
//                }
//            }
//            if (Utils.isJSONObject(group)) {
//                handleEachGroup(group, fields);
//                callback();
//            } else {
//                callback();
//            }
//        } else {
//            callback();
//        }
//    });
    callback();
}

exports.doResult = function (query, result, collection, db, callback) {
//    collection.get(Constants.Admin.Collections.FIELDS, function (err, fields) {
//        if (err) {
//            callback(err);
//            return;
//        }
//        var queryKeys = Object.keys(query);
//        if (queryKeys.indexOf(Constants.Query.GROUP) != -1) {
//            var group = query[Constants.Query.GROUP];
//            if (Array.isArray(group)) {
//                for (var i = 0; i < group.length; i++) {
//                    handleEachGroupResult(group[i], fields, result.result);
//                }
//            }
//            if (Utils.isJSONObject(group)) {
//                handleEachGroupResult(group, fields, result.result);
//                callback();
//            } else {
//                callback();
//            }
//        } else {
//            callback();
//        }
//    });
    callback();

}

exports.preUpdate = function (document, collection, db, callback) {
    this.preInsert(document, collection, db, callback);
}

exports.preInsert = function (document, collection, db, callback) {
    collection.get(Constants.Admin.Collections.FIELDS, function (err, fields) {
        try {
            handleUDTType(document, fields);
            callback();
        } catch (e) {
            callback(e);
            return;
        }
    });
}

exports.postInsert = function (document, collection, db, callback) {
    callback();
}

exports.preCommit = function (document, collection, db, callback) {
    callback();
}


exports.postCommit = function (document, collection, db, callback) {
    callback();
}

function handleUDTType(document, fields) {
    if (document === undefined) {
        return;
    }
    fields = fields || [];
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var type = field.type;
        if (type == "duration") {
            field.type = "object";
            field.fields = [
                {field: "time", type: "decimal"},
                {field: "timeunit", type: "string"},
                {field: "convertedvalue", type: "number"}
            ];
            insertConvertedValue(document, field);
        } else if (type == "currency") {
            field.type = "object";
            field.fields = [
                {field: "amount", type: "decimal"},
                {field: "type", type: "fk", set: ["currency"], upsert: true, collection: {"collection": "currency", "fields": [
                    {field: "currency", type: "string"}
                ]}}
            ];
            validateValue(document, field);
        } else if (type == 'file') {
            field.type = "object";
            field.fields = [
                {field: "key", type: "string"},
                {field: "name", type: "string"}
            ];
        } else if (type === "object") {
            var innerFields = field[Constants.Admin.Collections.FIELDS];
            var fieldDocs = document.getDocuments(field.field);
            if (Array.isArray(fieldDocs)) {
                for (var j = 0; j < fieldDocs.length; j++) {
                    if (j == fieldDocs.length - 1) {
                        handleUDTType(fieldDocs[j], innerFields);
                    } else {
                        var innerFieldsClone = Utils.deepClone(innerFields);
                        handleUDTType(fieldDocs[j], innerFieldsClone);
                    }
                }
            } else {
                handleUDTType(fieldDocs, innerFields);
            }
        }
    }
}

function validateValue(document, field) {
    var value = document.get(field.field);
    if (document.type === "insert") {
        if (value !== null && value !== undefined && Utils.isJSONObject(value)) {
            if (value.amount === undefined) {
                throw new Error("value is mandatory for expression [" + field.field + ".amount]");
            }
            if (Utils.isJSONObject(value.type)) {
                //TODO check for the null value
            } else {
                throw new Error("value expected is object for expression [" + field.field + ".type]");
            }
        }
    }
}

function insertConvertedValue(document, field) {
    var value = document.getDocuments(field.field);
    if (value) {
        var time = value.get("time");
        var timeunit = value.get("timeunit");
        if (time === undefined) {
            throw new Error("value is mandatory for expression [" + field.field + ".time ]");
        }
        if (timeunit === undefined) {
            throw new Error("value is mandatory for expression [" + field.field + ".timeunit ]");
        }
        var convertedValue = 0;
        if (timeunit == "days") {
            convertedValue = time * 8 * 60;
        } else if (timeunit == "hrs") {
            convertedValue = time * 60;
        } else if (timeunit == "minutes") {
            convertedValue = time;
        }
        value.set("convertedvalue", convertedValue);
    }
}

function handleEachGroup(group, fields) {
    for (var key in group) {
        if (Utils.isJSONObject(group[key])) {
            for (var innerKey in group[key]) {
                if (innerKey === "$sum") {
                    var aggregateExpression = group[key][innerKey];
                    aggregateExpression = aggregateExpression.substr(aggregateExpression.indexOf("$") + 1)
                    var fieldInfo = getField(aggregateExpression, fields);
                    if (fieldInfo && fieldInfo.type === "duration") {
                        group[key][innerKey] = "$" + aggregateExpression + ".convertedvalue";
                    }
                }
            }
        }
    }
}

function handleEachGroupResult(group, fields, result) {
    for (var key in group) {
        if (Utils.isJSONObject(group[key])) {
            for (var innerKey in group[key]) {
                if (innerKey === "$sum") {
                    var aggregateExpression = group[key][innerKey];
                    aggregateExpression = aggregateExpression.substr(aggregateExpression.indexOf("$") + 1)
                    var fieldInfo = getField(aggregateExpression, fields);
                    if (fieldInfo && fieldInfo.type === "duration") {
                        for (var i = 0; i < result.length; i++) {
                            var value = result[i][key];
                            result[i][key] = {"time": value / 60, timeunit: "hrs"};
                        }
                    }
                }
            }
        }
    }
}

function getField(expression, fields) {
    if (fields && fields.length > 0) {
        var index = expression.indexOf(".");
        if (index !== -1) {
            var firstPart = expression.substr(0, index);
            var rest = expression.substr(index + 1);
            var firstPartFields = get(firstPart, fields);
            return getField(rest, firstPartFields.fields);
        } else {
            return get(expression, fields);
        }
    }
}

function get(expression, fields) {
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        if (field.field === expression) {
            return field;
        }
    }
}


