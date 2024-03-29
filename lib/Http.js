var Constants = require("./Constants.js");
var Config = require("../Config.js");
var ApplaneDB = require("./DB.js");
var ApplaneDBError = require("./ApplaneDBError.js");
var domain = require("domain");
var express = require('express');
var Formidable = require("formidable");
var Utility = require("ApplaneCore/apputil/util.js");
var SELF = require("./Http.js");
var bodyParser = require('body-parser');
function runInDomain(req, res, next) {
    var reqd = domain.create();
    reqd.add(req);
    reqd.add(res);
    reqd.on('error', function (err) {
        writeJSONResponse(req, res, err);
    });
    reqd.run(function () {
        next();
    });
}
exports.connect = function (dbName, options, callback) {

    ApplaneDB.connect(Config.URL, dbName, options, function (err, db) {
        if (err) {
            callback(err);
            return;
        }
        var connectionToken = require("ApplaneCore/apputil/util.js").getUnique();
        saveConnection(connectionToken, dbName, options, function (err) {
            if (err) {
                callback(err);
                return;
            }
            callback(null, {token:connectionToken});
        })
    })
}

function saveConnection(connectionToken, dbName, options, callback) {
    ApplaneDB.connect(Config.URL, Config.Admin.DB, {username:Config.Admin.USER_NAME, password:Config.Admin.PASSWORD}, function (err, admindb) {
        if (err) {
            callback(err);
            return;
        }
        admindb.batchUpdateById([
            {$collection:Constants.Admin.CONNECTIONS, $insert:[
                {token:connectionToken, db:dbName, options:options}
            ]}
        ], callback)
    });
}

exports.configure = function (app) {

    app.use(function (req, res, next) {
        var urlParser = require('url');
        var url = urlParser.parse(req.url, true);
        if (url.pathname == "/rest/file/upload") {
            next();
        } else {
            bodyParser.urlencoded()(req, res, next);
        }
    });

    app.all("/rest/disconnect", function (req, res) {
        runInDomain(req, res, function () {
            var token = req.param("token");
            ApplaneDB.connect(Config.URL, Config.Admin.DB, {username:Config.Admin.USER_NAME, password:Config.Admin.PASSWORD}, function (err, admindb) {
                if (err) {
                    callback(err);
                    return;
                }
                admindb.batchUpdate([
                    {$collection:Constants.Admin.CONNECTIONS, $delete:[
                        {token:token}
                    ]}
                ], function (err) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback();
                });
            });
        })

    });


    app.all("/rest/connect", function (req, res) {
        runInDomain(req, res, function () {
            var dbName = req.param("db");
            var options = req.param("options");
            options = options ? JSON.parse(options) : {}
            var dbcode = req.param("dbcode");
            var callback = function (err, response) {
                console.log("response>>>>" + JSON.stringify(response));
                if (err) {
                    writeJSONResponse(req, res, err);
                    return;
                }
                writeJSONResponse(req, res, response);
            }
            if (dbcode) {
                ApplaneDB.getDBFromCode(dbcode, function (err, dbName) {
                    if (err) {
                        writeJSONResponse(req, res, err)
                        return;
                    }
                    options.dbcode = dbcode;
                    SELF.connect(dbName, options, callback);
                })
            } else {
                SELF.connect(dbName, options, callback);
            }
        })


    });

    app.all("/rest/query", function (req, res) {
        runInDomain(req, res, function () {
            var query = JSON.parse(req.param("query"));
            var token = req.param("token");
            getConnection(token, function (err, db) {
                if (err) {
                    writeJSONResponse(req, res, err);
                    return;
                }
                db.query(query, function (err, result) {
                    writeJSONResponse(req, res, err || result);
                })
            })
        })

    })

    app.all("/rest/batchupdatebyid", function (req, res) {
        runInDomain(req, res, function () {
            var batchUpdate = JSON.parse(req.param("batchupdate"));
            var token = req.param("token");
            getConnection(token, function (err, db) {
                if (err) {
                    writeJSONResponse(req, res, err);
                    return;
                }
                db.batchUpdateById(batchUpdate, function (err, result) {
                    writeJSONResponse(req, res, err || result);
                })

            })
        })

    })

    app.all("/rest/invoke", function (req, res) {
        runInDomain(req, res, function () {
            var token = req.param("token");
            getConnection(token, function (err, db) {
                if (err) {
                    writeJSONResponse(req, res, err);
                    return;
                }
                var functionName = req.param("function");
                var parameters = req.param("parameters");
                parameters = parameters ? JSON.parse(parameters) : [];
                db.invokeFunction(functionName, parameters, function (err, result) {
                    writeJSONResponse(req, res, err || result);
                })
            })
        })

    })
    app.all("/rest/adduser", function (req, res) {
        runInDomain(req, res, function () {
            var dbCode = req.param("dbcode");
            if (dbCode) {
                console.log("dbcode>>>" + dbCode)
                var user = req.param("user");
                user = user ? JSON.parse(user) : undefined;
                ApplaneDB.addUserWithCode(Config.URL, dbCode, user, function (err, result) {
                    writeJSONResponse(req, res, err || result);
                })
            } else {
                var token = req.param("token");
                getConnection(token, function (err, db) {
                    if (err) {
                        writeJSONResponse(req, res, err);
                        return;
                    }
                    var username = req.param("username");
                    var password = req.param("password");
                    var otherFields = req.param("otherfields");
                    otherFields = otherFields ? JSON.parse(otherFields) : undefined;
                    db.addUser(username, password, otherFields, function (err, result) {
                        writeJSONResponse(req, res, err || result);
                    })
                })
            }
        })


    })

    app.all("/rest/file/render", renderFile);
    app.all("/rest/file/download", fileDownload);
    app.all("/rest/file/upload", fileUpload);

}

function getConnection(token, callback) {
    if (!token) {
        callback(new ApplaneDBError(Constants.ErrorCode.MANDATORY_FIELDS.MESSAGE + "[token]", Constants.ErrorCode.MANDATORY_FIELDS.CODE));
        return;

    }
    ApplaneDB.connect(Config.URL, Config.Admin.DB, {username:Config.Admin.USER_NAME, password:Config.Admin.PASSWORD}, function (err, admindb) {
        if (err) {
            callback(err);
            return;
        }

        admindb.query(
            {$collection:Constants.Admin.CONNECTIONS, $filter:{token:token} }
            , function (err, result) {
                if (err) {
                    callback(err);
                    return;
                }

                var connection = result && result.result && result.result.length == 1 ? result.result[0] : undefined;

                ApplaneDB.connect(Config.URL, connection[Constants.Admin.Conncetions.DB], connection[Constants.Admin.Conncetions.OPTIONS], callback);
            })

    })
}


function writeJSONResponse(req, res, result) {
    var jsonResponseType = {"Content-Type":"application/json"};
    if (result instanceof ApplaneDBError) {
        res.writeHead(417, jsonResponseType);
        res.write(JSON.stringify({response:result.message, status:"error", code:result.code}));
        res.end();
    } else if (result instanceof Error) {
        res.writeHead(417, jsonResponseType);
        res.write(JSON.stringify({response:result.message, status:"error", code:result.code, stack:result.stack}));
        res.end();
    } else {
        var jsonResponse = JSON.stringify({response:result, status:"ok", code:200});
        if (req.acceptedEncodings && req.acceptedEncodings.indexOf("gzip") >= 0) {
            require("zlib").gzip(jsonResponse, function (err, buffer) {
                jsonResponseType["Content-Encoding"] = "gzip";
                res.writeHead(200, jsonResponseType);
                res.write(buffer);
                res.end();
            })
        } else {
            res.writeHead(200, jsonResponseType);
            res.write(jsonResponse);
            res.end();
        }

    }
}

function renderFile(req, res) {
    runInDomain(req, res, function () {
        var fileKey = req.param("filekey");
        var resizeInfo = req.param("resize");
        downloadFile(fileKey, req.param("token"), function (err, file) {
            if (err) {
                writeJSONResponse(req, res, err);
            } else {
                var fileName = file.metadata.filename;
                var extension = fileName.split('.').pop(), extensionTypes = {
                    'css':'text/css',
                    'gif':'image/gif',
                    'jpg':'image/jpeg',
                    'jpeg':'image/jpeg',
                    'js':'application/javascript',
                    'png':'image/png',
                    'mp4':'video/mp4',
                    'mp3':'audio/mpeg',
                    'txt':'text/plain',
                    'pdf':'application/pdf'
                };
                var contentType = extensionTypes[extension];
                if (!contentType) {
                    contentType = file.metadata.contentType;
                }
                res.writeHead(200, {
                    "Content-Type":contentType,
                    "Access-Control-Allow-Origin":"*",
                    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
                    "Access-Control-Allow-Credentials":true
                });
                if (file.resize) {
                    res.end(file.data, 'binary');
                } else {
                    res.write(file.data);
                    res.end();
                }
            }
        })
    })


}

function fileDownload(req, res) {
    runInDomain(req, res, function () {
        downloadFile(req.param("filekey"), req.param("token"), function (err, file) {
            if (err) {
                writeJSONResponse(req, res, err);
            } else {
                res.writeHead(200, {
                    "Content Type":file.metadata.contentType,
                    "Content-Disposition":"attachment; Filename=\"" + file.metadata.filename + "\"",
                    "Access-Control-Allow-Origin":"*",
                    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
                    "Access-Control-Allow-Credentials":true
                });
                if (file.resize) {
                    res.end(file.data, 'binary');
                } else {
                    res.write(file.data);
                    res.end();
                }
            }
        });
    })

}

function fileUpload(req, res) {
    runInDomain(req, res, function () {
        uploadFiles(req, function (err, fileKeys) {
            writeJSONResponse(req, res, err || fileKeys);
        })
    })

}

function downloadFile(fileKey, token, callback) {
    if (!fileKey) {
        throw new Error("Filekey not found ");
        return;
    }
    getConnection(token, function (err, db) {
        if (err) {
            callback(err);
            return;
        }
        db.downloadFile(fileKey, callback);
    })
}

function uploadFiles(req, callback) {
    var files = [];
    var fields = {};
    var form = new Formidable.IncomingForm();
    form.on('error', callback);
    form.on('field', function (name, val) {
        fields[name] = val;
    });
    form.onPart = function (part) {
        if (!part.filename) {
            form.handlePart(part);
            return;
        }
        var data = [];
        var fileName = part.filename;
        console.log("File name: " + fileName)
        part.on('data', function (buffer) {
            data.push(buffer);
        });

        part.on('end', function () {
            files.push({filename:fileName, data:data});
        });

    };

    form.on('end', function () {
        if (fields.contents) {
            var contents = fields.contents.split(',').pop();
            var fileBuffer = new Buffer(contents, "base64");
            var fileName = fields.name;
            files.push({filename:fileName, data:[fileBuffer]});
        }
        var token = fields.token;
        getConnection(token, function (err, db) {
            if (err) {
                callback(err);
                return;
            }
            var fileKeys = [];
            Utility.iterateArray(files, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, fileKeys);
            }, function (file, callback) {
                db.uploadFile(file.filename, file.data, function (err, fileKey) {
                    if (err) {
                        callback(err);
                        return;
                    }
                    fileKeys.push({key:fileKey, name:file.filename});
                    callback();
                })
            })
        })
    });
    form.parse(req);
}