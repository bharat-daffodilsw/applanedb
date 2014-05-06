var ObjectId = require("mongodb").ObjectID;
var expect = require('chai').expect;
var ApplaneDB = require("ApplaneDB");
var NorthwindDb = require("./test/NorthwindDb.js");
var Utils = require("ApplaneCore/apputil/util.js");
var Constants = require("./lib/Constants.js");
var TEST_UTILITY = require("./test/Utility.js");
var OPTIONS = {username:"rohit", password:"daffodil"};

var Config = {};
Config.URL = "mongodb://192.168.100.11:27027";
Config.DB = "amitsingh";
Config.ADMIN_DB = "amitsinghadmin";
//cash account allready esists


ApplaneDB.connect(Config.URL, Config.DB, OPTIONS, function (err, db) {
    if (err) {
        console.log("Error>>>>" + err)
        return;
    }

    var query = {"$collection":"__collections__", "$fields":{}, "$filter":{}};
//    var query = {"$collection":"__fields__", "$fields":{"field":1, "type":1, "mandatory":1, "collection":1, "set":1, "multiple":1, "parentfieldid":1, "collectionid._id":1, "_id":1}, "$filter":{ "collectionid._id":new ObjectId("53551335f7d77f6c1b0000da")}};
    db.query(query, function (err, result) {
        if (err) {
            console.log("Error in query>>>" + err)
            return;
        }
        console.log("result>>>" + JSON.stringify(result));
    })


    return;


    var batchUpdates = [
//        {
//            $collection:{collection:"vouchers", fields:[
//                {field:"vlis", type:"object", multiple:true, fields:[
//                    {field:"accountid", type:"fk", collection:"accounts", upsert:true, set:["account"]}
//                ]}
//            ]},
//            $insert:[
//                {
//                    _id:"1",
//                    voucherno:"001",
//                    vlis:[
//                        {_id:"3", accountid:{$query:{_id:"salary"}, $set:{account:"salary"}}, amount:100}
//                    ]
//                }
//            ]
//
//        } ,
        {
            $collection:{collection:"vouchers", fields:[
                {field:"vlis", type:"object", multiple:true, fields:[
                    {field:"accountid", type:"fk", collection:"accounts", upsert:true, set:["account"]}
                ]}
            ]},
            $update:[
                {
                    _id:"1",
                    $set:{
                        voucherno:"002",
                        vlis:{
                            $update:[
                                {_id:"3", $set:{amount:400, accountid:{$query:{_id:"profit"}, $set:{account:"profit"}}}}
                            ]
                        }
                    }
                }
            ]
        }
    ];

    db.batchUpdateById(batchUpdates, function (err, res) {
        if (err) {
            console.log("error>>>" + err)
            return;
        }
        db.query({$collection:"vouchers", $sort:{voucherno:1}}, function (err, data) {
            if (err) {
                console.log("error>>>" + err)
                return;
            }
            console.log("data>>>" + JSON.stringify(data));
            db.query({$collection:"accounts", $sort:{account:1}}, function (err, data) {
                if (err) {
                    console.log("error>>>" + err)
                    return;
                }
                console.log("data>>>" + JSON.stringify(data));

            })

        })
    })


})
