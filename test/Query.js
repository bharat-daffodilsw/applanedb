/**
 *  mocha --recursive --timeout 150000 -g "Querytestcase" --reporter spec
 *  mocha --recursive --timeout 150000 -g "batchQueries testcase" --reporter spec
 */
var expect = require('chai').expect;
var ApplaneDB = require("ApplaneDB");
var Config = require("./config.js");
var NorthwindDb = require('./NorthwindDb.js');

describe("batchQueries testcase ", function () {

    beforeEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                console.log("Err in Conn");
                done(err);
                return;
            }
            NorthwindDb.insertData(db, NorthwindDb.EMPLOYEES_TABLE, NorthwindDb.Emps, function (err) {
                if (err) {
                    console.log("Err in insert");
                    done(err);
                    return;
                }
                NorthwindDb.insertData(db, NorthwindDb.TASK_TABLE, NorthwindDb.Tasks, function (err) {
                    if (err) {
                        console.log("Err in insert");
                        done(err);
                        return;
                    }
                    console.log("Data Inserted");
                    done();
                })
            })
        })
    });

    afterEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            NorthwindDb.removeData(db, NorthwindDb.EMPLOYEES_TABLE, {}, function (err) {
                if (err) {
                    done(err);
                    return;
                }
                NorthwindDb.removeData(db, NorthwindDb.TASK_TABLE, {}, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("Data Removed");
                    done();
                })
            })
        })
    });

    it("batch queries", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var batchQueries = {
                "employees":{
                    $collection:NorthwindDb.EMPLOYEES_TABLE,
                    $fields:{employee:1, code:1},
                    $sort:{employee:1}
                },
                "tasks":{
                    $collection:NorthwindDb.TASK_TABLE,
                    $fields:{task:1, status:1},
                    $sort:{task:1}
                }
            }
            console.log("batchQueries :: ---------" + JSON.stringify(batchQueries));
            db.batchQuery(batchQueries, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                console.log("Data :: ---------" + JSON.stringify(data));
                expect(data.employees.result).to.have.length(7);
                expect(data.employees.result[0]._id).to.eql("Ashish");
                expect(data.employees.result[1]._id).to.eql("Ashu");
                expect(data.employees.result[2]._id).to.eql("Nitin");
                expect(data.employees.result[3]._id).to.eql("Pawan");
                expect(data.employees.result[4]._id).to.eql("Rohit");
                expect(data.employees.result[5]._id).to.eql("Sachin");
                expect(data.employees.result[6]._id).to.eql("Yogesh");
                expect(data.employees.result[0].code).to.eql("DFG-1014");
                expect(data.employees.result[1].code).to.eql("DFG-1019");
                expect(data.employees.result[2].code).to.eql("DFG-1018");
                expect(data.employees.result[3].code).to.eql("DFG-1012");
                expect(data.employees.result[4].code).to.eql("DFG-1015");
                expect(data.employees.result[5].code).to.eql("DFG-1013");
                expect(data.employees.result[6].code).to.eql("DFG-1011");
                expect(data.tasks.result).to.have.length(12);
                expect(data.tasks.result[0]._id).to.eql("task01");
                expect(data.tasks.result[1]._id).to.eql("task02");
                expect(data.tasks.result[2]._id).to.eql("task03");
                expect(data.tasks.result[3]._id).to.eql("task04");
                expect(data.tasks.result[4]._id).to.eql("task05");
                expect(data.tasks.result[5]._id).to.eql("task06");
                expect(data.tasks.result[6]._id).to.eql("task07");
                expect(data.tasks.result[7]._id).to.eql("task08");
                expect(data.tasks.result[8]._id).to.eql("task09");
                expect(data.tasks.result[9]._id).to.eql("task10");
                expect(data.tasks.result[10]._id).to.eql("task11");
                expect(data.tasks.result[11]._id).to.eql("task12");
                done();
            })

            var expectedResults = {"employees":{"result":[
                {"_id":"Ashish", "employee":"Ashish", "code":"DFG-1014"},
                {"_id":"Ashu", "employee":"Ashu", "code":"DFG-1019"},
                {"_id":"Nitin", "employee":"Nitin", "code":"DFG-1018"},
                {"_id":"Pawan", "employee":"Pawan", "code":"DFG-1012"},
                {"_id":"Rohit", "employee":"Rohit", "code":"DFG-1015"},
                {"_id":"Sachin", "employee":"Sachin", "code":"DFG-1013"} ,
                {"_id":"Yogesh", "employee":"Yogesh", "code":"DFG-1011"}
            ]}, "tasks":{"result":[
                {"_id":"task01", "task":"task01", "status":"New"},
                {"_id":"task02", "task":"task02", "status":"New"},
                {"_id":"task03", "task":"task03", "status":"InProgress"},
                {"_id":"task 04", "task":"task04", "status":"InProgress"},
                {"_id":"task05", "task":"task05", "status":"New"},
                {"_id":"task06", "task":"task06", "status":"InProgress"},
                {"_id":"task07", "task":"task07", "status":"New"},
                {"_id":"task08", "task":"task08", "status":"New" },
                {"_id":"task09", "task":"task09", "status":"Completed"},
                {"_id":"task10", "task":"task10", "status":"Completed"},
                {"_id":"ta sk11", "task":"task11", "status":"Completed"},
                {"_id":"task12", "task":"task12", "status":"Completed"}
            ]}}
        })
    })
})


describe("Querytestcase", function () {

    beforeEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                console.log("Err in Conn");
                done(err);
                return;
            }
            NorthwindDb.insertData(db, NorthwindDb.TASK_TABLE, [
                {_id:"task1", task:"task1", status:"Completed", priority:1, estHrs:2}     ,
                {_id:"task2", task:"task2", status:"New", priority:2, estHrs:3} ,
                {_id:"task3", task:"task3", status:"Inprogress", priority:3, estHrs:4}
            ], function (err) {
                if (err) {
                    console.log("Err in insert");
                    done(err);
                    return;
                }
                console.log("Data Inserted");
                done();
            });
        })
    });

    afterEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            NorthwindDb.removeData(db, NorthwindDb.TASK_TABLE, {}, function (err) {
                if (err) {
                    done(err);
                    return;
                }
                console.log("Data Removed");
                done();
            })
        })
    });

    it("Find All data Fields will not be passed", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks"};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(3);

                expect(data.result[0].task).to.eql("task1");
                expect(data.result[0].status).to.eql("Completed");
                expect(data.result[0].priority).to.eql(1);
                expect(data.result[0].estHrs).to.eql(2);


                expect(data.result[1].task).to.eql("task2");
                expect(data.result[1].status).to.eql("New");
                expect(data.result[1].priority).to.eql(2);
                expect(data.result[1].estHrs).to.eql(3);

                expect(data.result[2].task).to.eql("task3");
                expect(data.result[2].status).to.eql("Inprogress");
                expect(data.result[2].priority).to.eql(3);
                expect(data.result[2].estHrs).to.eql(4);

                done();
            });
        })
    })

    it("Find All data if Fields is passed as 1", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $fields:{task:1, priority:1}};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(3);

                expect(data.result[0].task).to.eql("task1");
                expect(data.result[0].status).to.eql(undefined);
                expect(data.result[0].priority).to.eql(1);
                expect(data.result[0].estHrs).to.eql(undefined);

                expect(data.result[1].task).to.eql("task2");
                expect(data.result[1].status).to.eql(undefined);
                expect(data.result[1].priority).to.eql(2);
                expect(data.result[1].estHrs).to.eql(undefined);

                expect(data.result[2].task).to.eql("task3");
                expect(data.result[2].status).to.eql(undefined);
                expect(data.result[2].priority).to.eql(3);
                expect(data.result[2].estHrs).to.eql(undefined);

                done();
            });
        })
    })


    it("Find All data if Fields is passed as 0", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $fields:{status:0, estHrs:0}};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(3);

                expect(data.result[0].task).to.eql("task1");
                expect(data.result[0].status).to.eql(undefined);
                expect(data.result[0].priority).to.eql(1);
                expect(data.result[0].estHrs).to.eql(undefined);

                expect(data.result[1].task).to.eql("task2");
                expect(data.result[1].status).to.eql(undefined);
                expect(data.result[1].priority).to.eql(2);
                expect(data.result[1].estHrs).to.eql(undefined);

                expect(data.result[2].task).to.eql("task3");
                expect(data.result[2].status).to.eql(undefined);
                expect(data.result[2].priority).to.eql(3);
                expect(data.result[2].estHrs).to.eql(undefined);

                done();
            });
        })
    })


    it("Filter simple eq", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $filter:{status:"Completed"}};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(1);

                expect(data.result[0].task).to.eql("task1");
                expect(data.result[0].status).to.eql("Completed");
                expect(data.result[0].priority).to.eql(1);
                expect(data.result[0].estHrs).to.eql(2);

                done();
            });
        })
    })

    it("Filter gt or lt", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $filter:{estHrs:{$lt:3}}};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(1);

                expect(data.result[0].task).to.eql("task1");
                expect(data.result[0].status).to.eql("Completed");
                expect(data.result[0].priority).to.eql(1);
                expect(data.result[0].estHrs).to.eql(2);

                done();
            });
        })
    })

    it("Sort", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $sort:{task:-1}};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(3);

                expect(data.result[2].task).to.eql("task1");
                expect(data.result[2].status).to.eql("Completed");
                expect(data.result[2].priority).to.eql(1);
                expect(data.result[2].estHrs).to.eql(2);


                expect(data.result[1].task).to.eql("task2");
                expect(data.result[1].status).to.eql("New");
                expect(data.result[1].priority).to.eql(2);
                expect(data.result[1].estHrs).to.eql(3);

                expect(data.result[0].task).to.eql("task3");
                expect(data.result[0].status).to.eql("Inprogress");
                expect(data.result[0].priority).to.eql(3);
                expect(data.result[0].estHrs).to.eql(4);

                done();
            });
        })
    })

    it("limit", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $sort:{task:1}, $limit:1};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }
                expect(data.result).to.have.length(1);

                expect(data.result[0].task).to.eql("task1");
                expect(data.result[0].status).to.eql("Completed");
                expect(data.result[0].priority).to.eql(1);
                expect(data.result[0].estHrs).to.eql(2);


                done();
            });
        })
    })


    it.skip("other built in data type(date,boolean,array,object)", function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }

            var query = {$collection:"tasks", $sort:{task:"asc"}, $group:{_id:null, count:{$sum:1}}};
            db.query(query, function (err, data) {
                if (err) {
                    done(err);
                    return;
                }

                done();
            });
        })
    })


})