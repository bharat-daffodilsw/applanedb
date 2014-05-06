/**
 * Created with IntelliJ IDEA.
 * User: daffodil
 * Date: 8/4/14
 * Time: 10:59 AM
 * To change this template use File | Settings | File Templates.
 */


exports.Query = {
    COLLECTION:"$collection",
    _ID:"_id",
    FIELDS:"$fields",
    Fields:{
        TYPE:"$type",
        QUERY:"$query",
        FK:"$fk",
        PARENT:"$parent",
        ENSURE:"$ensure"
    },
    FILTER:"$filter",
    Filter:{
        OR:"$or",
        AND:"$and",
        IN:"$in",
        GT:"$gt",
        LT:"$lt"
    },
    PARAMETERS:"$parameters",
    CHILDS:"$childs",
    SORT:"$sort",
    GROUP:"$group",
    LIMIT:"$limit",
    SKIP:"$skip",
    UNWIND:"$unwind",
    RECURSION:"$recursion",
    Recursion:{
        LEVEL:"$level",
        ALIAS:"$alias",
        COUNTER:"$counter",
        ENSURE:"$ensure"
    },
    DATA:"$data",
    MODULES:"$modules"
};

exports.Update = {
    COLLECTION:"$collection",

    INSERT:"$insert",
    UPDATE:"$update",
    Update:{
        SET:"$set",
        UNSET:"$unset",
        QUERY:"$query",
        INC:"$inc"

    },
    DELETE:"$delete",
    QUERY:"$query",
    UPSERT:"$upsert",
    Upsert:{
        QUERY:"$query",
        FIELDS:"$fields"
    }
}
exports.Admin = {
    CONNECTIONS:"__connections__",
    Conncetions:{
        TOKEN:"token",
        DB:"db",
        OPTIONS:"options"
    },
    USERS:"__users__",
    Users:{
        USER_NAME:"username",
        PASSWORD:"password",
        ADMIN:"admin"
    },
    FUNCTIONS:"__functions__",
    Functions:{
        NAME:"name",
        SOURCE:"source",
        CODE:"code"
    },
    Roles:{
        TABLE:"__roles__",
        ROLE:"role",
        RIGHTS:"rights"
    },
    COLLECTIONS:"__collections__",
    Collections:{
        COLLECTION:"collection",
        FIELDS:"fields",
        REFERRED_FKS:"referredfks",
        CHILDS:"childs",
        MERGE:"merge",
        Merge:{
            COLLECTION:"collection",
            FIELDS:"fields"
        },
        MergeType:{
            UNION:"union",
            OVERRIDE:"override"
        }
    },
    REFERRED_FKS:"__referredfks__",
    /**  {collection:"persons",fields:[{_id:"cityid","field":"cityid","type":fk,collection:"cities","set":["city"]}]}
     */
    ReferredFks:{
        COLLECTION_ID:"collectionid", //persons
        FIELD:"field", //cityid
        SET:"set", //["city"]
        REFERRED_COLLECTION_ID:"referredcollectionid", //cities
        REFERRED_FIELD_ID:"referredfieldid"               //cityid
    },
    FIELDS:"__fields__",
    Fields:{
        FIELD:"field",
        TYPE:"type",
        Type:{
            STRING:"string",
            FK:"fk",
            OBJECT:"object",
            NUMBER:"number",
            DECIMAL:"decimal",
            BOOLEAN:"boolean",
            DATE:"date",
            JSON:"json"
        },
        MULTIPLE:"multiple",
        SET:"set", // Array of string
        COLLECTION:"collection", // can be object or string
        MANDATORY:"mandatory",
        UPSERT:"upsert",
        PARENT_FIELD_ID:"parentfieldid",
        COLLECTION_ID:"collectionid"
    }
};

exports.Trigger = {
    TRIGGERS:"triggers",
    Triggers:{
        FUNCTIONNAME:"functionName",
        OPERATIONS:"operations",
        WHEN:"when",
        REQUIREDFIELDS:"requiredfields"
    }
}

exports.TRANSACTIONS = "__txs__";


//exports.Collections = {
//    TABLE:"__collections__",
//    COLLECTION:"collection", /*could not be changed*/
//    FIELDS:"fields",
//    Fields:{
//        FIELD:"field",
//        TYPE:"type",
//        Type:{
//            STRING:"string",
//            FK:"fk",
//            OBJECT:"object",
//            NUMBER:"number",
//            DECIMAL:"decimal",
//            BOOLEAN:"boolean",
//            DATE:"date"
//        },
//        MULTIPLE:"multiple",
//        PUSH:"push", // Array of string
//        COLLECTION:"collection", // can be object or string
//        MANDATORY:"mandatory",
//        UPSERT:"upsert",
//        PARENT_FIELD:"parentfield",
//        COLLECTIONID:"collectionid"
//
//    },
//    REFERRED_FKS:"referredfks"
//}

exports.ErrorCode = {
    USER_NOT_FOUND:{CODE:1, MESSAGE:"User Not Found."},
    CREDENTIAL_MISSMATCH:{CODE:3, MESSAGE:"Username/Password did not match."},
    USER_ALREADY_EXISTS:{CODE:29, MESSAGE:"User already exists"},
    INVALID_DB_CODE:{CODE:30, MESSAGE:"Invalid db code"},
    MANDATORY_FIELDS:{CODE:31, MESSAGE:"Mandatory fields can not be left blank"},
    ONLY_ADMIN_CAN_ADD_USER:{CODE:32, MESSAGE:"Only admin can add user"}

}
