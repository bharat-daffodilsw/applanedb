/**
 * Created with IntelliJ IDEA.
 * User: daffodil
 * Date: 22/4/14
 * Time: 4:17 PM
 * To change this template use File | Settings | File Templates.
 */

var Utils = require("ApplaneCore/apputil/util.js");
var Constants = require("../Constants.js");

exports.populateRefferedFks = function (document, db, callback) {
    var type = document.type;
    if (!document.get(Constants.Admin.Fields.COLLECTION_ID) && type != "delete") {
        callback();
        return;
    }
    if (type == "insert") {
        populateData(document, db, callback);
    } else if (type == "update") {
        var updatedFields = document.getUpdatedFields();
        var updateRequired = false;
        for (var i = 0; i < updatedFields.length; i++) {
            var updatedField = updatedFields[i];
            if (updatedField == Constants.Admin.Fields.FIELD || updatedField == Constants.Admin.Fields.TYPE || updatedField == Constants.Admin.Fields.MULTIPLE || updatedField == Constants.Admin.Fields.COLLECTION || updatedField == Constants.Admin.Fields.SET || updatedField == Constants.Admin.Fields.PARENT_FIELD_ID) {
                updateRequired = true;
                break;
            }
        }
        if (!updateRequired) {
            callback();
            return;
        }
        var oldRecord = document.oldRecord;
        removeReferredFk(oldRecord._id, db, function (err) {
            if (err) {
                callback(err);
                return;
            }
            populateData(document, db, callback);
        });
    } else if (type == "delete") {
        var oldRecord = document.oldRecord;
        removeReferredFk(oldRecord._id, db, callback);
    } else {
        callback();
    }
}

function populateData(document, db, callback) {
    if (document.get(Constants.Admin.Fields.TYPE) != Constants.Admin.Fields.Type.FK || !document.get(Constants.Admin.Fields.SET) || document.get(Constants.Admin.Fields.SET).length == 0) {
        callback();
        return;
    }
    var field = document.get(Constants.Admin.Fields.FIELD);
    var parentFieldId = document.get(Constants.Admin.Fields.PARENT_FIELD_ID);
    if (document.get(Constants.Admin.Fields.MULTIPLE)) {
        field = field + ".$";
    }
    populateReferredField(field, parentFieldId, db, function (err, referredField) {
        if (err) {
            callback(err);
            return;
        }
        var fieldsToSet = document.get(Constants.Admin.Fields.SET);
        var insert = {};
        insert[Constants.Admin.ReferredFks.COLLECTION_ID] = document.get(Constants.Admin.Fields.COLLECTION_ID);
        insert[Constants.Admin.ReferredFks.FIELD] = referredField;
        insert[Constants.Admin.ReferredFks.SET] = fieldsToSet;
        insert[Constants.Admin.ReferredFks.REFERRED_COLLECTION_ID] = {$query:{collection:document.get(Constants.Admin.Fields.COLLECTION)}};
        insert[Constants.Admin.ReferredFks.REFERRED_FIELD_ID] = {_id:document.get("_id")};
        var updates = {};
        updates[Constants.Update.COLLECTION] = Constants.Admin.REFERRED_FKS;
        updates[Constants.Update.INSERT] = [insert];
        db.batchUpdateById([updates], callback);
    })
}

function populateReferredField(field, parentFieldId, db, callback) {
    if (!parentFieldId) {
        callback(null, field);
        return;
    }
    var parentFieldQuery = {};
    parentFieldQuery[Constants.Query.COLLECTION] = Constants.Admin.FIELDS;
    parentFieldQuery[Constants.Query.FIELDS] = {field:1, parentfieldid:1, multiple:1};
    parentFieldQuery[Constants.Query.FILTER] = {_id:parentFieldId._id};
    db.query(parentFieldQuery, function (err, parentFieldRes) {
        if (err) {
            callback(err);
            return;
        }
        var parentField = parentFieldRes.result && parentFieldRes.result.length > 0 ? parentFieldRes.result[0] : undefined;
        if (!parentField) {
            throw new Error("Parent Field does not exists.");
        }
        field = parentField[Constants.Admin.Fields.FIELD] + (parentField[Constants.Admin.Fields.MULTIPLE] ? ".$." : ".") + field;
        populateReferredField(field, parentField[Constants.Admin.Fields.PARENT_FIELD_ID], db, callback);
    })
}

function removeReferredFk(referredFieldId, db, callback) {
    var deleteQuery = {};
    deleteQuery[Constants.Admin.ReferredFks.REFERRED_FIELD_ID + "._id"] = referredFieldId;
    var updates = {};
    updates[Constants.Update.COLLECTION] = Constants.Admin.REFERRED_FKS;
    updates[Constants.Update.DELETE] = [deleteQuery];
    db.batchUpdate([updates], callback);
}

