/**
 *
 *  mocha --recursive --timeout 150000 -g "ChildModuleSaving" --reporter spec
 *  mocha --recursive --timeout 150000 -g "ChildModuleQuery" --reporter spec
 *
 *
 */

var expect = require('chai').expect;
var ApplaneDB = require("ApplaneDB");
var Config = require("./config.js");
var NorthwindDb = require("./NorthwindDb.js");
var Utils = require("ApplaneCore/apputil/util.js");
var Constants = require("../lib/Constants.js");


describe("ChildModuleSaving", function () {

    afterEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            db.dropDatabase(function (err) {
                done(err);
            })
        });
    })

    it("Orders and Deliveries with override deliveries", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var orderUpdates = [
                {$collection:{
                    collection:"orders",
                    fields:[
                        {field:"order_no", type:"string"}
                    ],
                    childs:[
                        {
                            collection:{
                                collection:"deliveries",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"deliveries",
                            fk:"orderid"
                        }
                    ]
                }, $insert:[
                    {_id:1, order_no:"123",
                        deliveries:[
                            {code:"xx1", amount:100},
                            {code:"xx2", amount:200}
                        ]
                    }
                ]
                }
            ];

            db.batchUpdateById(orderUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection:"orders", $sort:{order_no:1}}, function (err, orders) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("orders >>>>>>>>>>>>>>>>>" + JSON.stringify(orders));
                    expect(orders.result).to.have.length(1);
                    expect(orders.result[0].order_no).to.eql("123");
                    expect(orders.result[0].deliveries).to.eql(undefined);
                    db.query({$collection:"deliveries", $sort:{code:1}}, function (err, deliveries) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("deliveries >>>>>>>>>>>>>>>>>" + JSON.stringify(deliveries));
                        expect(deliveries.result).to.have.length(2);
                        expect(deliveries.result[0].code).to.eql("xx1");
                        expect(deliveries.result[0].amount).to.eql(100);
                        expect(deliveries.result[0].orderid._id).to.eql(1);
                        expect(deliveries.result[1].code).to.eql("xx2");
                        expect(deliveries.result[1].amount).to.eql(200);
                        expect(deliveries.result[1].orderid._id).to.eql(1);
                        done();
                    })
                })
            })
        })
    })

    it("Orders and Deliveries", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var orderUpdates = [
                {$collection:{
                    collection:"orders",
                    fields:[
                        {field:"order_no", type:"string"}
                    ],
                    childs:[
                        {
                            collection:{
                                collection:"deliveries",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"deliveries",
                            fk:"orderid"
                        }
                    ]
                }, $insert:[
                    {_id:1, order_no:"123",
                        deliveries:{
                            $insert:[
                                {_id:"xx1", code:"xx1", amount:100},
                                {_id:"xx2", code:"xx2", amount:200} ,
                                {_id:"xx3", code:"xx3", amount:300}
                            ]
                        }
                    }
                ]
                }
            ];

            db.batchUpdateById(orderUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection:"orders", $sort:{order_no:1}}, function (err, orders) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("orders >>>>>>>>>>>>>>>>>" + JSON.stringify(orders));
                    expect(orders.result).to.have.length(1);
                    expect(orders.result[0].order_no).to.eql("123");
                    expect(orders.result[0].deliveries).to.eql(undefined);
                    db.query({$collection:"deliveries", $sort:{code:1}}, function (err, deliveries) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("deliveries >>>>>>>>>>>>>>>>>" + JSON.stringify(deliveries));
                        expect(deliveries.result).to.have.length(3);
                        expect(deliveries.result[0].code).to.eql("xx1");
                        expect(deliveries.result[0].amount).to.eql(100);
                        expect(deliveries.result[0].orderid._id).to.eql(1);
                        expect(deliveries.result[1].code).to.eql("xx2");
                        expect(deliveries.result[1].amount).to.eql(200);
                        expect(deliveries.result[1].orderid._id).to.eql(1);
                        expect(deliveries.result[2].code).to.eql("xx3");
                        expect(deliveries.result[2].amount).to.eql(300);
                        expect(deliveries.result[2].orderid._id).to.eql(1);
                        done();
                    })
                })
            })
        })
    })

    it("Orders and Deliveries and invoices and accounts", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var orderUpdates = [
                {$collection:{
                    collection:"orders",
                    fields:[
                        {field:"order_no", type:"string"}
                    ],
                    childs:[
                        {
                            collection:{
                                collection:"deliveries",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"deliveries",
                            fk:"orderid"
                        },
                        {
                            collection:{
                                collection:"invoices",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"invoices",
                            fk:"orderid"
                        },
                        {
                            collection:{
                                collection:"accounts",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"accounts",
                            fk:"orderid"
                        }
                    ]
                }, $insert:[
                    {_id:1, order_no:"123",
                        deliveries:{
                            $insert:[
                                {_id:"xx1", code:"xx1", amount:100},
                                {_id:"xx2", code:"xx2", amount:200},
                                {_id:"xx3", code:"xx3", amount:300}
                            ]
                        }, invoices:{
                        $insert:[
                            {_id:"xx1", code:"xx1", amount:100},
                            {_id:"xx2", code:"xx2", amount:200},
                            {_id:"xx3", code:"xx3", amount:300}
                        ]
                    }, accounts:{
                        $insert:[
                            {_id:"xx1", code:"xx1", amount:100},
                            {_id:"xx2", code:"xx2", amount:200},
                            {_id:"xx3", code:"xx3", amount:300}
                        ]
                    }
                    }
                ]
                }
            ];
            db.batchUpdateById(orderUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection:"orders"}, function (err, orders) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("orders >>>>>>>>>>>>>>>>>" + JSON.stringify(orders));
                    expect(orders.result).to.have.length(1);
                    expect(orders.result[0].order_no).to.eql("123");
                    expect(orders.result[0].deliveries).to.eql(undefined);
                    expect(orders.result[0].invoices).to.eql(undefined);
                    expect(orders.result[0].accounts).to.eql(undefined);
                    db.query({$collection:"deliveries"}, function (err, deliveries) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("deliveries >>>>>>>>>>>>>>>>>" + JSON.stringify(deliveries));
                        expect(deliveries.result).to.have.length(3);
                        expect(deliveries.result[0].code).to.eql("xx1");
                        expect(deliveries.result[0].amount).to.eql(100);
                        expect(deliveries.result[0].orderid._id).to.eql(1);
                        expect(deliveries.result[1].code).to.eql("xx2");
                        expect(deliveries.result[1].amount).to.eql(200);
                        expect(deliveries.result[1].orderid._id).to.eql(1);
                        expect(deliveries.result[2].code).to.eql("xx3");
                        expect(deliveries.result[2].amount).to.eql(300);
                        expect(deliveries.result[2].orderid._id).to.eql(1);
                        db.query({$collection:"invoices"}, function (err, invoices) {
                            if (err) {
                                done(err);
                                return;
                            }
                            console.log("invoices >>>>>>>>>>>>>>>>>" + JSON.stringify(invoices));
                            expect(invoices.result).to.have.length(3);
                            expect(invoices.result[0].code).to.eql("xx1");
                            expect(invoices.result[0].amount).to.eql(100);
                            expect(invoices.result[0].orderid._id).to.eql(1);
                            expect(invoices.result[1].code).to.eql("xx2");
                            expect(invoices.result[1].amount).to.eql(200);
                            expect(invoices.result[1].orderid._id).to.eql(1);
                            expect(invoices.result[2].code).to.eql("xx3");
                            expect(invoices.result[2].amount).to.eql(300);
                            expect(invoices.result[2].orderid._id).to.eql(1);
                            db.query({$collection:"accounts"}, function (err, accounts) {
                                if (err) {
                                    done(err);
                                    return;
                                }
                                console.log("accounts >>>>>>>>>>>>>>>>>" + JSON.stringify(accounts));
                                expect(accounts.result).to.have.length(3);
                                expect(accounts.result[0].code).to.eql("xx1");
                                expect(accounts.result[0].amount).to.eql(100);
                                expect(accounts.result[0].orderid._id).to.eql(1);
                                expect(accounts.result[1].code).to.eql("xx2");
                                expect(accounts.result[1].amount).to.eql(200);
                                expect(accounts.result[1].orderid._id).to.eql(1);
                                expect(accounts.result[2].code).to.eql("xx3");
                                expect(accounts.result[2].amount).to.eql(300);
                                expect(accounts.result[2].orderid._id).to.eql(1);
                                done();
                            })
                        })
                    })
                })
            })
        })
    })

    it("Orders and Deliveries Update", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var orderUpdates = [
                {$collection:{
                    collection:"orders",
                    fields:[
                        {field:"order_no", type:"string"}
                    ],
                    childs:[
                        {
                            collection:{
                                collection:"deliveries",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"deliveries",
                            fk:"orderid"
                        }
                    ]
                }, $insert:[
                    {_id:1, order_no:"123",
                        deliveries:{
                            $insert:[
                                {_id:"xx1", code:"xx1", amount:100},
                                {_id:"xx2", code:"xx2", amount:200} ,
                                {_id:"xx3", code:"xx3", amount:300}
                            ]
                        }
                    }
                ]
                }
            ];

            db.batchUpdateById(orderUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                var update = [
                    {$collection:{
                        collection:"orders",
                        fields:[
                            {field:"order_no", type:"string"}
                        ],
                        childs:[
                            {
                                collection:{
                                    collection:"deliveries",
                                    fields:[
                                        {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                    ]
                                },
                                alias:"deliveries",
                                fk:"orderid"
                            }
                        ]
                    }, $update:[
                        {_id:1,
                            $set:{deliveries:{
                                $insert:[
                                    {_id:"xx4", code:"xx4", amount:400}
                                ],
                                $update:[
                                    {_id:"xx1", $set:{code:"XX1"}}
                                ], $delete:[
                                    {_id:"xx2"}
                                ]
                            }}
                        }
                    ]
                    }
                ];
                db.batchUpdateById(update, function (err, res) {
                    if (err) {
                        done(err);
                        return;
                    }
                    db.query({$collection:"orders", $sort:{order_no:1}}, function (err, orders) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("orders >>>>>>>>>>>>>>>>>" + JSON.stringify(orders));
                        expect(orders.result).to.have.length(1);
                        expect(orders.result[0].order_no).to.eql("123");
                        expect(orders.result[0].deliveries).to.eql(undefined);
                        db.query({$collection:"deliveries", $sort:{code:1}}, function (err, deliveries) {
                            if (err) {
                                done(err);
                                return;
                            }
                            console.log("deliveries >>>>>>>>>>>>>>>>>" + JSON.stringify(deliveries));
                            expect(deliveries.result).to.have.length(3);
                            expect(deliveries.result[0].code).to.eql("XX1");
                            expect(deliveries.result[0].amount).to.eql(100);
                            expect(deliveries.result[0].orderid._id).to.eql(1);
                            expect(deliveries.result[1].code).to.eql("xx3");
                            expect(deliveries.result[1].amount).to.eql(300);
                            expect(deliveries.result[1].orderid._id).to.eql(1);
                            expect(deliveries.result[2].code).to.eql("xx4");
                            expect(deliveries.result[2].amount).to.eql(400);
                            expect(deliveries.result[2].orderid._id).to.eql(1);
                            done();
                        })
                    })
                })
            })
        })
    })

    it("Orders and Deliveries unset deliveries", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var orderUpdates = [
                {$collection:{
                    collection:"orders",
                    fields:[
                        {field:"order_no", type:"string"}
                    ],
                    childs:[
                        {
                            collection:{
                                collection:"deliveries",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"deliveries",
                            fk:"orderid"
                        }
                    ]
                }, $insert:[
                    {_id:1, order_no:"123",
                        deliveries:{
                            $insert:[
                                {_id:"xx1", code:"xx1", amount:100},
                                {_id:"xx2", code:"xx2", amount:200} ,
                                {_id:"xx3", code:"xx3", amount:300}
                            ]
                        }
                    }
                ]
                }
            ];

            db.batchUpdateById(orderUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                var update = [
                    {$collection:{
                        collection:"orders",
                        fields:[
                            {field:"order_no", type:"string"}
                        ],
                        childs:[
                            {
                                collection:{
                                    collection:"deliveries",
                                    fields:[
                                        {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                    ]
                                },
                                alias:"deliveries",
                                fk:"orderid"
                            }
                        ]
                    }, $update:[
                        {_id:1,
                            $unset:{deliveries:1}
                        }
                    ]
                    }
                ];
                db.batchUpdateById(update, function (err, res) {
                    if (err) {
                        done(err);
                        return;
                    }
                    db.query({$collection:"orders", $sort:{order_no:1}}, function (err, orders) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("orders >>>>>>>>>>>>>>>>>" + JSON.stringify(orders));
                        expect(orders.result).to.have.length(1);
                        expect(orders.result[0].order_no).to.eql("123");
                        expect(orders.result[0].deliveries).to.eql(undefined);
                        db.query({$collection:"deliveries", $sort:{code:1}}, function (err, deliveries) {
                            if (err) {
                                done(err);
                                return;
                            }
                            console.log("deliveries >>>>>>>>>>>>>>>>>" + JSON.stringify(deliveries));
                            expect(deliveries.result).to.have.length(0);
                            done();
                        })
                    })
                })
            })
        })
    })

    it("Collection and fields(recursive)", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var batchUpdates = [
                {
                    $collection:{
                        collection:"__collections__",
                        fields:[
                            {field:"collection", type:"string", mandatory:true}
                        ],
                        childs:[
                            {collection:{
                                collection:"__fields__",
                                fields:[
                                    {field:"collectionid", collection:"__collections__", type:"fk", set:["collection"]},
                                    {field:"parentfieldid", collection:"__fields__", type:"fk", set:["field"]}
                                ],
                                childs:[
                                    {collection:"__fields__", alias:"fields", fk:"parentfieldid"}
                                ]
                            }, alias:"fields", fk:"collectionid"}
                        ]
                    },
//                    $collection:"__collections__",
                    $insert:[
                        {_id:"vouchers", collection:"vouchers", fields:{$insert:[
                            {field:"voucherno", type:"string"},
                            {field:"voucherlineitems", type:"object", multiple:true, fields:[
                                {field:"amount", type:"decimal"},
                                {field:"accountid", type:"fk", collection:"accounts"},
                                {field:"ilis", type:"object", multiple:true, fields:[
                                    {"field":"id", type:"string"}
                                ]}
                            ]}
                        ]}}
                    ]

//                    $insert:[
//                        {_id:"vouchers", collection:"vouchers", fields:[
//                            {field:"voucherno", type:"string"},
//                            {field:"voucherlineitems", type:"object", multiple:true, fields:[
//                                {field:"amount", type:"decimal"},
//                                {field:"accountid", type:"fk", collection:"accounts"}
//                            ]}
//                        ]}
//                    ]
                }
            ];
            db.batchUpdateById(batchUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection:"__collections__", $sort:{collection:1}}, function (err, collections) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("collections >>>>>>>>>>>>>>>>>" + JSON.stringify(collections));
                    expect(collections.result).to.have.length(1);
                    expect(collections.result[0]._id).to.eql("vouchers");
                    expect(collections.result[0].collection).to.eql("vouchers");
                    expect(collections.result[0].fields).to.eql(undefined);
                    db.query({$collection:"__fields__", $sort:{field:1, parentfieldid:1}}, function (err, fields) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("fields >>>>>>>>>>>>>>>>>" + JSON.stringify(fields));
                        expect(fields.result).to.have.length(6);
                        expect(fields.result[0].field).to.eql("accountid");
                        expect(fields.result[0].collectionid.collection).to.eql("vouchers");
                        expect(fields.result[0].parentfieldid.field).to.eql("voucherlineitems");
                        expect(fields.result[1].field).to.eql("amount");
                        expect(fields.result[1].collectionid.collection).to.eql("vouchers");
                        expect(fields.result[1].parentfieldid.field).to.eql("voucherlineitems");
                        expect(fields.result[2].field).to.eql("id");
                        expect(fields.result[2].collectionid.collection).to.eql("vouchers");
                        expect(fields.result[2].parentfieldid.field).to.eql("ilis");
                        expect(fields.result[3].field).to.eql("ilis");
                        expect(fields.result[3].collectionid.collection).to.eql("vouchers");
                        expect(fields.result[3].parentfieldid.field).to.eql("voucherlineitems");
                        expect(fields.result[4].field).to.eql("voucherlineitems");
                        expect(fields.result[4].collectionid.collection).to.eql("vouchers");
                        expect(fields.result[4].parentfieldid).to.eql(undefined);
                        expect(fields.result[5].field).to.eql("voucherno");
                        expect(fields.result[5].collectionid.collection).to.eql("vouchers");
                        expect(fields.result[5].parentfieldid).to.eql(undefined);
                        done();

                        var expResult = {"result":[
                            {"field":"accountid", "type":"fk", "collection":"accounts", "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "parentfieldid":{"field":"voucherlineitems", "_id":"535e2a9c7cd7c3c41c1e6edd"}, "_id":"535e2a9c7cd7c3c41c1e6ee5"},
                            {"field":"amount", "type":"decimal", "co llectionid":{"_id":"vouchers", "collection":"vouchers"}, "parentfieldid":{"field":"voucherlineitems", "_id":"535e2a9c7cd7c3c41c1e6edd"}, "_id":"535e2a9c7cd7c3c41c1e6ee1"},
                            {"field":"id", "type":"string", "parentfieldid":{"field":"ilis", "_id":"535e2a9c7cd7c3c41c1e6ee9"}, "_id":"535e2a9c7cd7c3c41c1e6eee"},
                            {"f ield":"ilis", "type":"object", "multiple":true, "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "parentfieldid":{"field":"voucherlineitems", "_id":"535e2a9c7cd7c3c41c1e6edd"}, "_id":"535e2a9c7cd7c3c41c1e6ee9"},
                            {"field":"voucherlineitems", "type":"object", "multiple":true, "collectionid":{"_id":"vo uchers", "collection":"vouchers"}, "_id":"535e2a9c7cd7c3c41c1e6edd"},
                            {"field":"voucherno", "type":"string", "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "_id":"535e2a9c7cd7c3c41c1e6eda"}
                        ]};
                    })
                })
            })
        })
    })
})

describe("ChildModuleQuery", function () {

    afterEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            db.dropDatabase(function (err) {
                done(err);
            })
        });
    })

    it("Orders and Deliveries", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var orderUpdates = [
                {$collection:{
                    collection:"orders",
                    fields:[
                        {field:"order_no", type:"string"}
                    ],
                    childs:[
                        {
                            collection:{
                                collection:"deliveries",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"deliveries",
                            fk:"orderid"
                        },
                        {
                            collection:{
                                collection:"invoices",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"invoices",
                            fk:"orderid"
                        },
                        {
                            collection:{
                                collection:"accounts",
                                fields:[
                                    {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                ]
                            },
                            alias:"accounts",
                            fk:"orderid"
                        }
                    ]
                }, $insert:[
                    {_id:1, order_no:"123",
                        deliveries:{
                            $insert:[
                                {_id:"xx1", code:"xx1", amount:100},
                                {_id:"xx2", code:"xx2", amount:200},
                                {_id:"xx3", code:"xx3", amount:300}
                            ]
                        }, invoices:{
                        $insert:[
                            {_id:"xx1", code:"xx1", amount:100},
                            {_id:"xx2", code:"xx2", amount:200},
                            {_id:"xx3", code:"xx3", amount:300}
                        ]
                    }, accounts:{
                        $insert:[
                            {_id:"xx1", code:"xx1", amount:100},
                            {_id:"xx2", code:"xx2", amount:200},
                            {_id:"xx3", code:"xx3", amount:300}
                        ]
                    }
                    }
                ]
                }
            ];
            db.batchUpdateById(orderUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }
                ApplaneDB.addCollection({
                    collection:"invoices",
                    fields:[
                        {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                    ]
                }, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    var orderQuery = {
                        $collection:{
                            collection:"orders",
                            fields:[
                                {field:"order_no", type:"string"}
                            ],
                            childs:[
                                {
                                    collection:{
                                        collection:"deliveries",
                                        fields:[
                                            {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                        ]
                                    },
                                    alias:"deliveries",
                                    fk:"orderid"
                                } ,
                                {
                                    collection:"invoices",
                                    alias:"invoices",
                                    fk:"orderid",
                                    query:{$collection:{
                                        collection:"invoices",
                                        fields:[
                                            {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                        ]
                                    }, $fields:{code:1}}
                                } ,
                                {
                                    collection:{
                                        collection:"invoices",
                                        fields:[
                                            {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                        ]
                                    },
                                    alias:"invoices1",
                                    fk:"orderid",
                                    query:{$collection:"invoices", $fields:{amount:1}}
                                }
                            ]
                        },
                        $childs:{
                            deliveries:1,
                            invoices:1,
                            invoices1:1,
                            accounts:{
                                collection:{
                                    collection:"accounts",
                                    fields:[
                                        {field:"orderid", collection:"orders", type:"fk", set:["order_no"]}
                                    ]
                                },
                                fk:"orderid"
                            }
                        }
                    };
                    var query = {collection:"orders", fields:{
                        deliveries:{
                            $query:{},
                            $fk:"orderid",
                            $parent:"_id"
                        }
                    }}
                    db.query(orderQuery, function (err, orders) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("orders >>>>>>>>>>>>>>>>>" + JSON.stringify(orders));
                        expect(orders.result).to.have.length(1);
                        expect(orders.result[0].order_no).to.eql("123");

                        expect(orders.result[0].deliveries).to.have.length(3);
                        expect(orders.result[0].deliveries[0].code).to.eql("xx1");
                        expect(orders.result[0].deliveries[0].amount).to.eql(100);
                        expect(orders.result[0].deliveries[0].orderid._id).to.eql(1);
                        expect(orders.result[0].deliveries[1].code).to.eql("xx2");
                        expect(orders.result[0].deliveries[1].amount).to.eql(200);
                        expect(orders.result[0].deliveries[1].orderid._id).to.eql(1);
                        expect(orders.result[0].deliveries[2].code).to.eql("xx3");
                        expect(orders.result[0].deliveries[2].amount).to.eql(300);
                        expect(orders.result[0].deliveries[2].orderid._id).to.eql(1);

                        expect(orders.result[0].invoices).to.have.length(3);
                        expect(orders.result[0].invoices[0].code).to.eql("xx1");
                        expect(orders.result[0].invoices[0].amount).to.eql(undefined);
                        expect(orders.result[0].invoices[0].orderid._id).to.eql(1);
                        expect(orders.result[0].invoices[1].code).to.eql("xx2");
                        expect(orders.result[0].invoices[1].amount).to.eql(undefined);
                        expect(orders.result[0].invoices[1].orderid._id).to.eql(1);
                        expect(orders.result[0].invoices[2].code).to.eql("xx3");
                        expect(orders.result[0].invoices[2].amount).to.eql(undefined);
                        expect(orders.result[0].invoices[2].orderid._id).to.eql(1);

                        expect(orders.result[0].invoices1).to.have.length(3);
                        expect(orders.result[0].invoices1[0].code).to.eql(undefined);
                        expect(orders.result[0].invoices1[0].amount).to.eql(100);
                        expect(orders.result[0].invoices1[0].orderid._id).to.eql(1);
                        expect(orders.result[0].invoices1[1].code).to.eql(undefined);
                        expect(orders.result[0].invoices1[1].amount).to.eql(200);
                        expect(orders.result[0].invoices1[1].orderid._id).to.eql(1);
                        expect(orders.result[0].invoices1[2].code).to.eql(undefined);
                        expect(orders.result[0].invoices1[2].amount).to.eql(300);
                        expect(orders.result[0].invoices1[2].orderid._id).to.eql(1);

                        expect(orders.result[0].accounts).to.have.length(3);
                        expect(orders.result[0].accounts[0].code).to.eql("xx1");
                        expect(orders.result[0].accounts[0].amount).to.eql(100);
                        expect(orders.result[0].accounts[0].orderid._id).to.eql(1);
                        expect(orders.result[0].accounts[1].code).to.eql("xx2");
                        expect(orders.result[0].accounts[1].amount).to.eql(200);
                        expect(orders.result[0].accounts[1].orderid._id).to.eql(1);
                        expect(orders.result[0].accounts[2].code).to.eql("xx3");
                        expect(orders.result[0].accounts[2].amount).to.eql(300);
                        expect(orders.result[0].accounts[2].orderid._id).to.eql(1);
                        done();

                    })
                })
            })
        })
    })

    it("Collection and fields(recursive)", function (done) {

        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var batchUpdates = [
                {
                    $collection:{
                        collection:"__collections__",
                        fields:[
                            {field:"collection", type:"string", mandatory:true}
                        ],
                        childs:[
                            {collection:{
                                collection:"__fields__",
                                fields:[
                                    {field:"collectionid", collection:"__collections__", type:"fk", set:["collection"]},
                                    {field:"parentfieldid", collection:"__fields__", type:"fk", set:["field"]}
                                ],
                                childs:[
                                    {collection:"__fields__", alias:"fields", fk:"parentfieldid"}
                                ]
                            }, alias:"fields", fk:"collectionid"}
                        ]
                    },
                    $insert:[
                        {_id:"vouchers", collection:"vouchers", fields:{$insert:[
                            {field:"voucherno", type:"string"},
                            {field:"voucherlineitems", type:"object", multiple:true, fields:[
                                {field:"amount", type:"decimal"},
                                {field:"accountid", type:"fk", collection:"accounts"},
                                {field:"ilis", type:"object", multiple:true, fields:[
                                    {"field":"id", type:"string"}
                                ]}
                            ]}
                        ]}}
                    ]
                }
            ];
            db.batchUpdateById(batchUpdates, function (err, res) {
                if (err) {
                    done(err);
                    return;
                }

                var collectionQuery = {
                    $collection:{
                        collection:"__collections__",
                        fields:[
                            {field:"collection", type:"string", mandatory:true}
                        ],
                        childs:[
                            {collection:{
                                collection:"__fields__",
                                fields:[
                                    {field:"collectionid", collection:"__collections__", type:"fk", set:["collection"]},
                                    {field:"parentfieldid", collection:"__fields__", type:"fk", set:["field"]}
                                ],
                                childs:[
                                    {collection:"__fields__", alias:"parentfields", fk:"parentfieldid"} ,
                                    {collection:{collection:"fieldtypes", fields:[
                                        {field:"fieldid", type:"fk", collection:"__fields__"}
                                    ]}, alias:"fieldtypes", fk:"fieldid"}
                                ]
                            }, alias:"fields", fk:"collectionid", query:{$collection:{
                                collection:"__fields__",
                                fields:[
                                    {field:"collectionid", collection:"__collections__", type:"fk", set:["collection"]},
                                    {field:"parentfieldid", collection:"__fields__", type:"fk", set:["field"]}
                                ],
                                childs:[
                                    {collection:"__fields__", alias:"parentfields", fk:"parentfieldid"},
                                    {collection:{collection:"fieldtypes", fields:[
                                        {field:"fieldid", type:"fk", collection:"__fields__"}
                                    ]}, alias:"fieldtypes", fk:"fieldid"}
                                ]
                            }, "$childs":{parentfields:1, fieldtypes:1}}}
                        ]
                    },
                    $fields:{_id:1},
                    $childs:{fields:1}
                };
                db.query(collectionQuery, function (err, collections) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("collections >>>>>>>>>>>>>>>>>" + JSON.stringify(collections));
                    expect(collections.result).to.have.length(1);
                    expect(collections.result[0]._id).to.eql("vouchers");
                    expect(collections.result[0].collection).to.eql(undefined);
                    expect(collections.result[0].fields).to.have.length(2);
                    expect(collections.result[0].fields[0].field).to.eql("voucherno");
                    expect(collections.result[0].fields[0].collectionid.collection).to.eql("vouchers");
                    expect(collections.result[0].fields[1].field).to.eql("voucherlineitems");
                    expect(collections.result[0].fields[1].collectionid.collection).to.eql("vouchers");
                    expect(collections.result[0].fields[1].parentfields).to.have.length(3);
                    expect(collections.result[0].fields[1].parentfields[0].field).to.eql("amount");
                    expect(collections.result[0].fields[1].parentfields[0].collectionid.collection).to.eql("vouchers");
                    expect(collections.result[0].fields[1].parentfields[0].parentfieldid.field).to.eql("voucherlineitems");
                    expect(collections.result[0].fields[1].parentfields[1].field).to.eql("accountid");
                    expect(collections.result[0].fields[1].parentfields[1].collectionid.collection).to.eql("vouchers");
                    expect(collections.result[0].fields[1].parentfields[1].parentfieldid.field).to.eql("voucherlineitems");
                    expect(collections.result[0].fields[1].parentfields[2].field).to.eql("ilis");
                    expect(collections.result[0].fields[1].parentfields[2].collectionid.collection).to.eql("vouchers");
                    expect(collections.result[0].fields[1].parentfields[2].parentfieldid.field).to.eql("voucherlineitems");
                    expect(collections.result[0].fields[1].parentfields[2].parentfields).to.have.length(1);
                    expect(collections.result[0].fields[1].parentfields[2].parentfields[0].field).to.eql("id");
                    expect(collections.result[0].fields[1].parentfields[2].parentfields[0].collectionid.collection).to.eql("vouchers");
                    expect(collections.result[0].fields[1].parentfields[2].parentfields[0].parentfieldid.field).to.eql("ilis");

                    var expectedResult = {"result":[
                        {"_id":"vouchers", "fields":[
                            {"field":"voucherno", "type":"string", "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "_id":"535e59a50989170c1f5f971a"},
                            {"field":"voucherlineitems", "type":"object", "multiple":true, "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "_id":"535e59a50989170c1f5f971d", "parentfields":[
                                {"field":"amount", "type":"decimal", "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "parentfieldid":{"field":"voucherlineitems", "_id":"535e59a50989170c1f5f971d"}, "_id":"535e59a50989170c1f5f9721"},
                                {"field":"accountid", "type":"fk ", "collection":"accounts", "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "parentfieldid":{"field":"voucherlineitems", "_id":"535e59a50989170c1f5f971d"}, "_id":"535e59a50989170c1f5f9725"},
                                {"field":"ilis", "type":"object", "multiple":true, "collectionid":{"_id":"vouchers", "collection":"vouchers" }, "parentfieldid":{"field":"voucherlineitems", "_id":"535e59a50989170c1f5f971d"}, "_id":"535e59a50989170c1f5f9729", "parentfields":[
                                    {"field":"id", "type":"string", "collectionid":{"_id":"vouchers", "collection":"vouchers"}, "parentfieldid":{"field":"ilis", "_id":"535e59a50989170c1f5f9729"}, "_id":"535e59a609 89170c1f5f972e"}
                                ]}
                            ]}
                        ]}
                    ]};
                    done();
                })
            })
        })

    })

})
