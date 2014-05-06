/*
 * name
 * address not valid
 * address.cityname valid
 * getDocumnet(adddress) valid
 * isUpdated(address) not valid
 *
 * */
var Utility = require("ApplaneCore/apputil/util.js")
var Constants = require("./Constants.js")

/**
 *
 * updates --> only $set, $unset, $inc, _id can be occur only otherise error throw  incase of update
 * insert--> no $set, $unset, $inc is there*
 * Also need to support required columns ------------------------------------>
 */



var Document = function (updates, oldRecord, type, requiredValues) {
//    if (type == "update" && updates) {
//        validateUpdates(updates);
//    }
    this.updates = updates;
    this.oldRecord = oldRecord;
    this.type = type;
    this.requiredValues = requiredValues;
}

function validateUpdates(updates) {
    var validKeys = ["$set", "$unset", "$inc", "_id", "$query"];
    var keys = Object.keys(updates);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (validKeys.indexOf(key) === -1) {
            throw Error("Invalid Key [" + key + "] in updates");
        }
    }
}
function validateProperty(property) {
    if (property.indexOf(".") > 0) {
        throw Error("Dotted Expression Not Supported");
    }
}

Document.prototype.getUpdatedFields = function () {
    if (this.type == "insert") {
        return Object.keys(this.updates);
    } else if (this.type == "update") {
        var keys = [];
        if (this.updates.$set) {
            pushFields(Object.keys(this.updates.$set), keys);
        }
        if (this.updates.$unset) {
            pushFields(Object.keys(this.updates.$unset), keys);
        }
        if (this.updates.$inc) {
            pushFields(Object.keys(this.updates.$inc), keys);
        }
        return keys;
    }
}

Document.prototype.isInInc = function (property) {
    return this.updates && this.updates.$inc && this.updates.$inc[property] ? true : false;
}

function pushFields(array, keys) {
    for (var i = 0; i < array.length; i++) {
        keys.push(array[i]);
    }
}

/*
 * if property is in $inc throw error
 * "addressinfo.city" --> error --> dotted --> error, as well as not supported in updates
 * first check in $set, $unset and if not then check in oldvalue and return
 * in
 * */
Document.prototype.get = function (property) {
    if (this.updates === null || this.updates === undefined) {
        return undefined;
    }
    else if (this.updates && this.updates[property] !== undefined) {
        return this.updates[property];
    }
    else if (this.updates && this.updates.$set && this.updates.$set[property] !== undefined) {
        return this.updates.$set[property];
    } else if (this.updates && this.updates.$unset && this.updates.$unset[property] !== undefined) {
        return null;
    }
    else if (this.updates && this.updates.$inc && this.updates.$inc[property] !== undefined) {
        return this.updates.$inc[property];
    } else if (this.updates && this.updates.$query && this.updates.$query[property] !== undefined) {
        return this.updates.$query[property];
    }
    else if (this.requiredValues && this.requiredValues[property] !== undefined) {
        return this.requiredValues[property];
    }
    else if (this.oldRecord && this.oldRecord[property] !== undefined) {
        return this.oldRecord[property];
    } else {
        return undefined;
    }

}

/*
 * return only from old values
 * */
Document.prototype.getOld = function (property) {
    validateProperty(property);
    if (this.oldRecord && this.oldRecord[property] !== undefined) {
        return this.oldRecord[property];
    } else {
        return null;
    }
}

/*
 * if property exists in unset --> throw error
 *  null and not exists in set
 *  lookup case
 * */


Document.prototype.getDocuments = function (property, operation) {
    if (!this.updates) {
        return;
    }
    validateProperty(property);
    var value = checkValue.call(this, property);
    if (Array.isArray(value)) {
        return handleArray(value, operation, this.oldRecord ? this.oldRecord[property] : null, null, this.requiredValues ? this.requiredValues[property] : null);
    } else if (Utility.isJSONObject(value)) {
        if (value.$insert || value.$update || value.$delete) {
            return handleArray(value, operation, this.oldRecord ? this.oldRecord[property] : null, null, this.requiredValues ? this.requiredValues[property] : null);
        } else {
            return handleObject(value, this.oldRecord ? this.oldRecord[property] : null, this.type, this.requiredValues ? this.requiredValues[property] : null, operation);
        }
    } else if (value !== null && value !== undefined) {
        return undefined;
    } else if (value === null) {
        /*
         * upsert case or value set==null in $set
         * */
        var oldValue = this.oldRecord ? this.oldRecord[property] : null;
        if (Array.isArray(oldValue)) {
            return handleArray(null, operation, oldValue, null, this.requiredValues ? this.requiredValues[property] : null)
        } else if (Utility.isJSONObject(oldValue)) {
            return handleObject(null, oldValue, "nochange", this.requiredValues ? this.requiredValues[property] : null, operation);
        } else {
            return undefined;
        }
    } else {
        var oldValue = this.oldRecord ? this.oldRecord[property] : null;
        if (Array.isArray(oldValue)) {
            return handleArray({}, operation, oldValue, "nochange", this.requiredValues ? this.requiredValues[property] : null)
        } else if (Utility.isJSONObject(oldValue)) {
            return handleObject({}, oldValue, "nochange", this.requiredValues ? this.requiredValues[property] : null, operation);
        } else {
            return undefined;
        }
    }
}

function handleObject(value, oldRecord, type, requiredValue, operation) {
    if (operation && operation.indexOf(type) === -1) {
        return undefined;
    } else {
        return new Document(value, oldRecord, type, requiredValue);
    }

}

function handleOperationInArray(documentArray, operation) {
    var newDocumentArray = [];
    for (var i = 0; i < documentArray.length; i++) {
        var document = documentArray[i];
        if (operation.indexOf(document.type) !== -1) {
            newDocumentArray.push(document);
        }
    }
    return newDocumentArray;
}
function handleArray(value, operation, oldRecord, isNoChange, requiredValue) {
    oldRecord = oldRecord || {};
    value = value || {};
    requiredValue = requiredValue || [];
    if (value.$insert || value.$update || value.$delete) {
        var documentArray = [];
        populateArray(value, oldRecord, documentArray, requiredValue);
        if (value.$insert) {
            for (var i = 0; i < value.$insert.length; i++) {
                documentArray.push(new Document(value.$insert[i], null, "insert", requiredValue[i]));
            }
        }
        if (operation) {
            return handleOperationInArray(documentArray, operation);
        } else {
            return documentArray;
        }
    } else {
        if ((value && value.length > 0 && Utility.isJSONObject(value[0])) || (oldRecord && oldRecord.length > 0 && Utility.isJSONObject(oldRecord[0]))) {
            var newDocumentArray = [];
            for (var i = 0; i < value.length; i++) {
                newDocumentArray.push(new Document(value[i], null, "insert", requiredValue[i]));
            }
            for (var i = 0; i < oldRecord.length; i++) {
                var type = isNoChange ? "nochange" : "delete";
                var updates = isNoChange ? {} : undefined;
                if (type === "nochange") {
                    var requiredIndex = fetchRequiredValueIndex(requiredValue, oldRecord[i].data);
                    var rValue = requiredIndex ? requiredValue[requiredIndex] : null;
                    newDocumentArray.push(new Document(updates, oldRecord[i], type, rValue));
                } else {
                    newDocumentArray.push(new Document(updates, oldRecord[i], type, null));
                }

            }
            if (operation) {
                return handleOperationInArray(newDocumentArray, operation);
            } else {
                return newDocumentArray;
            }
        } else {
            return undefined;
        }
    }
}

function checkValue(property) {
    if (this.updates && this.updates[property] !== undefined) {
        return this.updates[property];
    }
    if (this.updates && this.updates.$set && this.updates.$set[property] !== undefined) {
        return this.updates.$set[property];
    }
    if (this.updates && this.updates.$unset && this.updates.$unset[property] !== undefined) {
        return null;
    }
    if (this.updates && this.updates.$inc && this.updates.$inc[property] !== undefined) {
        return this.updates.$inc[property];
    }
    if (this.updates && this.updates.$query && this.updates.$query[property] !== undefined) {
        return this.updates.$query[property];
    }
    if (this.requiredValues && this.requiredValues[property] !== undefined) {
        return this.requiredValues[property];
    }
    return undefined;
}

function populateArray(updates, oldValue, documentArray, requiredValue) {
    oldValue = oldValue || [];
    requiredValue = requiredValue || [];
    updates.$update = updates.$update || [];
    updates.$delete = updates.$delete || [];
    for (var i = 0; i < oldValue.length; i++) {
        var value = oldValue[i];
        var found = false;
        for (var j = 0; j < updates.$update.length; j++) {
            var query = undefined;
            if (updates.$update[j].$query) {
                query = updates.$update[j].$query;
            } else {
                query = {"_id": updates.$update[j]._id};
            }
            if (Utility.evaluateFilter(query, value)) {
                var requiredIndex = fetchRequiredValueIndex(requiredValue, value);
                var rValue = requiredIndex ? requiredValue[requiredIndex] : null;
                documentArray.push(new Document(updates.$update[j], value, "update", rValue));
                found = true;
                break;
            }
        }
        if (!found) {
            for (var k = 0; k < updates.$delete.length; k++) {
                var query = undefined;
                if (updates.$delete[k].$query) {
                    query = updates.$delete[k].$query;
                } else {
                    query = {"_id": updates.$delete[k]._id};
                }
                if (Utility.evaluateFilter(query, value)) {
                    documentArray.push(new Document(query, value, "delete", null));
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            var requiredIndex = fetchRequiredValueIndex(requiredValue, value);
            var rValue = requiredIndex ? requiredValue[requiredIndex] : null;
            documentArray.push(new Document({}, value, "nochange", rValue));
        }
    }
}


function getValue(property, updates, old) {
    if (updates && updates.$set && updates.$set[property] !== undefined) {
        return updates.$set[property];
    } else if (updates && updates.$unset && updates.$unset[property] !== undefined) {
        return undefined;
    }
    else if (updates && updates.$inc && updates.$inc[property] !== undefined) {
        throw Error("property [" + property + "] found in $inc");
    }
    else if (old && old[property] !== undefined) {
        return old[property];
    } else {
        return updates[property];
    }
}

Document.prototype.insertDocument = function (property, setValue) {
    var value = this.updates.$set[property];
    if (value && value.$insert) {
        var insertArray = value.$insert;
        insertArray.push(setValue);
    } else {
        this.updates.$set[property] = {$insert: [setValue]};
    }
}

Document.prototype.deleteDocument = function (property, setValue) {
    var value = this.updates.$set[property];
    if (value && value.$delete) {
        var deleteArray = value.$delete;
        deleteArray.push(setValue);
    } else {
        this.updates.$set[property] = {$delete: [setValue]};
    }
}

Document.prototype.set = function (property, value) {
    validateProperty(property);
    if (value === undefined) {
        if (this.type == "insert") {
            delete this.updates[property];
        } else if (this.type == "update") {
            if (this.updates.$set) {
                delete this.updates.$set[property];
            }
        }
    } else {
        if (this.type == "insert") {
            this.updates[property] = value;
        } else if (this.type == "update") {
            this.updates.$set = this.updates.$set || {};
            this.updates.$set[property] = value;
        } else {
            throw new Error("$Set operation not permitted for type[" + this.type + "]");
        }
    }
}

Document.prototype.unset = function (property, value) {
    validateProperty(property);
    if (value === undefined) {
        if (this.type == "insert") {
            delete this.updates[property];
        } else if (this.type == "update") {
            if (this.updates.$unset) {
                delete this.updates.$unset[property];
            }
        }
    } else {
        if (this.type == "insert") {
            this.updates[property] = value;
        }
        else if (this.type == "update") {
            this.updates.$unset = this.updates.$unset || {};
            this.updates.$unset[ property] = value;
        }
        else {
            throw new Error("$unset operation not permitted for type[" + this.type + "]");
        }
    }


}

Document.prototype.inc = function (property, value) {
    validateProperty(property);
    this.updates.$inc = this.updates.$inc || {};
    this.updates.$inc[property] = value;
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

Document.prototype.convertToJSON = function () {
    if (this.updates === null || this.updates === undefined) {
        return undefined;
    }
    var jsonDocument = {};
    var fields = this.getFields();
    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var fieldDoc = this.getDocuments(field);
        if (fieldDoc !== undefined) {
            if (Array.isArray(fieldDoc)) {
                var fieldArray = [];
                for (var j = 0; j < fieldDoc.length; j++) {
                    var doc = fieldDoc[j];
                    if (doc.type !== "delete") {
                        var convertedJson = doc.convertToJSON();
                        fieldArray.push(convertedJson);
                    }
                }
                jsonDocument[field] = fieldArray;
            } else {
                jsonDocument[field] = fieldDoc.convertToJSON();
            }
        } else {
            jsonDocument[field] = this.get(field);
        }
    }
    return Object.keys(jsonDocument).length > 0 ? jsonDocument : undefined;
}


Document.prototype.getFields = function () {
    var keys = [];
    var updates = this.updates || {};
    for (var key in updates) {
        if (key !== "$query" && key !== "$set" && key !== "$unset" && key !== "$inc") {
            keys.push(key);
        }
    }
    for (var key in updates.$query) {
        if (keys.indexOf(key) === -1) {
            keys.push(key);
        }
    }
    for (var key in updates.$set) {
        if (keys.indexOf(key) === -1) {
            keys.push(key);
        }
    }
    for (var key in updates.$unset) {
        if (keys.indexOf(key) === -1) {
            keys.push(key);
        }
    }
    for (var key in updates.$inc) {
        if (keys.indexOf(key) === -1) {
            keys.push(key);
        }
    }
    var oldRecord = this.oldRecord;
    for (var key in oldRecord) {
        if (keys.indexOf(key) === -1) {
            keys.push(key);
        }
    }
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key === "$query" || key === "$set" || key === "$unset" || key === "$inc") {
            throw new Error("key cannot start with a $");
        }
    }
    return keys;
}

Document.prototype.setRequiredFieldsValues = function (requiredFieldValues) {
    this.requiredValues = requiredFieldValues;
}
module.exports = Document;


function fetchRequiredValueIndex(requiredValue, data) {
    data = data || {};
    var requiredIndex = undefined;
    for (var j = 0; j < requiredValue.length; j++) {
        if (requiredValue[j]._id === data._id) {
            requiredIndex = j;
            break;
        }
    }
    return requiredIndex;
}


Document.prototype.clone = function () {
    return new Document(Utility.deepClone(this.updates), this.oldRecord, this.type, this.requiredValues);
}

Document.prototype.setCancelUpdates = function () {
    this.cancelUpdates = true;
}
