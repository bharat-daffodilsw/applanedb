/**
 *
 *  mocha --recursive --timeout 150000 -g "Updatetestcase" --reporter spec
 */
var expect = require('chai').expect;
var ApplaneDB = require("ApplaneDB");
var Config = require("./config.js");


describe("Updatetestcase", function () {

    afterEach(function (done) {
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            db.dropDatabase(function (err) {
                done(err);
            })
        });
    })

    it("simple insert", function (done) {
        var COUNTRIES = "countries";
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var updates = [
                {$collection: COUNTRIES, $insert: [
                    {country: "India", code: "91"},
                    {country: "USA", code: "01"}

                ]}
            ]
            db.batchUpdate(updates, function (err, result) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection: COUNTRIES, $sort: {country: 1}}, function (err, data) {
                    if (err) {
                        done(err);
                        return;
                    }
                    console.log("data>>>" + JSON.stringify(data));
                    expect(data.result).to.have.length(2);
                    done();

                })

            })


        })


    })

    it("simple update", function (done) {
        var COUNTRIES = "countries";
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var updates = [
                {$collection: COUNTRIES, $insert: [
                    {country: "India", code: "91"},
                    {country: "USA", code: "01"}

                ]}
            ]
            db.batchUpdate(updates, function (err, result) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection: COUNTRIES, $sort: {country: 1}}, function (err, data) {
                    if (err) {
                        done(err);
                        return;
                    }


                    var updates = [
                        {$collection: COUNTRIES, $update: [
                            {$query: {_id: data.result[0]._id}, $set: {code: "+91"}},
                            {$query: {_id: data.result[1]._id}, $set: {code: "+01"}}

                        ]}
                    ]
                    db.batchUpdate(updates, function (err, updateResult) {
                        if (err) {
                            done(err);
                            return;
                        }
                        console.log("update result>>>" + JSON.stringify(updateResult));
                        db.query({$collection: COUNTRIES, $sort: {country: 1}}, function (err, queryResult) {
                            expect(queryResult.result).to.have.length(2);
                            expect(queryResult.result[0].code).to.eql("+91");
                            expect(queryResult.result[1].code).to.eql("+01");
                            done();
                        })


                    })


                })

            })


        })


    })

    it("simple delete", function (done) {
        var COUNTRIES = "countries";
        ApplaneDB.connect(Config.URL, Config.DB, function (err, db) {
            if (err) {
                done(err);
                return;
            }
            var updates = [
                {$collection: COUNTRIES, $insert: [
                    {country: "India", code: "91"},
                    {country: "USA", code: "01"}

                ]}
            ]
            db.batchUpdate(updates, function (err, result) {
                if (err) {
                    done(err);
                    return;
                }
                db.query({$collection: COUNTRIES, $sort: {country: 1}}, function (err, data) {
                    if (err) {
                        done(err);
                        return;
                    }


                    var updates = [
                        {$collection: COUNTRIES, $delete: [
                            {_id: data.result[0]._id}

                        ]}
                    ]
                    db.batchUpdate(updates, function (err, deleteResult) {
                        if (err) {
                            done(err);
                            return;
                        }
                        db.query({$collection: COUNTRIES, $sort: {country: 1}}, function (err, queryResult) {
                            if (err) {
                                done(err);
                                return;
                            }
                            expect(queryResult.result).to.have.length(1);
                            expect(queryResult.result[0].code).to.eql("01");
                            done();
                        })


                    })


                })

            })


        })


    })

    it("simple upsert", function (done) {
        var collection = {}
        done();

    })


});