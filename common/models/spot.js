'use strict';
// var loopback = require('loopback');
// var app = loopback(); 
module.exports = function(Spot) {
    const supportedExtensions = ["jpg", "jpeg", "png", "gif"];
    const regExpExt = /(jpeg|jpg|png|gif)/;
    const cdnUri = "http://cdn.pojokan.com.global.prod.fastly.net";

    Spot.create = function(data, req, res, cb) {
        var Unit = Spot.app.models.Unit;
        var Location = Spot.app.models.Location;

        var unitData = {
            name: data.name,
            description: data.description || "",
            category: data.category || "",
            sub: data.sub || "",
            tags: data.tags || []
        };

        var locationData = {
            address: data.address,
            phones: data.phones || [],
            position: data.position,
            images: [],
            tags: data.tags || []
        };

        var imageObjects = data.images.map(image => {
            var extension = (image.match(regExpExt) || [null])[0];
            var base64string = image.replace(/^data:image\/[a-z]+;base64,/, "");
            var buffer = new Buffer(base64string, 'base64');

            return {
                extension: extension,
                buffer: buffer
            };
        });

        var storageOperations = imageObjects.map(imageObject => {
            return new Promise((resolve, reject) => {

                var extension = imageObjects[0].extension;
                var buffer = imageObjects[0].buffer;
                var md5 = require('md5')(buffer);

                var mkdirp = require('mkdirp');
                var fs = require('fs');
                var pathUtil = require("path");
                var getDirName = pathUtil.dirname;
                var baseDirectory = __dirname;
                var filename = pathUtil.join(baseDirectory, "../../uploads", `${md5}.${extension}`);

                mkdirp(getDirName(filename), function(err) {
                    if (err) return cb(err);

                    var wStream = fs.createWriteStream(filename);
                    wStream.on('finish', function() {
                        console.log('file has been written');
                        var keyPath = pathUtil.join(baseDirectory, "../../", 'file/spot-storage-5e984703f061.json');
                        var gcs = require('@google-cloud/storage')({
                            projectId: 'spot-storage',
                            keyFilename: keyPath
                        });
                        var bucket = gcs.bucket("regional-bucket-01-us");
                        var options = {
                            public: true
                        };

                        bucket.upload(filename, options, function(err, file, apiResponse) {
                            if (err)
                                reject(err);
                            else
                                resolve(file);
                        });
                    });
                    wStream.write(buffer);
                    wStream.end();
                });
            });
        });

        Promise.all(storageOperations)
            .then(files => {
                Unit.create(unitData, (err, unit) => {
                    if (err)
                        return cb(err);
                    locationData.unitId = unit.id;
                    locationData.images = files.map(file => file.name);
                    Location.create(locationData, (err, location) => {
                        if (err)
                            return cb(err);
                        data.id = unit.id;
                        cb(null, data);
                    });
                });
            })
            .catch(ex => {
                cb(ex);
            });
    };

    Spot.remoteMethod("create", {
        http: {
            path: "/",
            verb: "post"
        },
        accepts: [{
            arg: "data",
            type: "object",
            'http': {
                source: "body"
            }
        }, {
            arg: 'req',
            type: 'object',
            'http': {
                source: 'req'
            }
        }, {
            arg: 'res',
            type: 'object',
            'http': {
                source: 'res'
            }
        }],
        returns: {
            arg: "spot",
            type: "object",
            root: true
        }
    });
};
