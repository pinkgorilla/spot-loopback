'use strict';
// var loopback = require('loopback');
// var app = loopback(); 
module.exports = function(Spot) {

    Spot.create = function(data, req, res, cb) {
        var Unit = Spot.app.models.Unit;
        var Location = Spot.app.models.Location;
        // var data = {name:name, description:description, address:address, position:position, phones:phones, category:category, sub:sub, tags:tags};
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
            images: []
        };

        var imageObjects = data.images.map(image => {
            var supportedExtensions = ["jpg", "jpeg", "png", "gif"];
            var regExpExt = /(jpeg|jpg|png|gif)/;
            var extension = (image.match(regExpExt) || [null])[0];
            var base64string = image.replace(/^data:image\/[a-z]+;base64,/, "");
            var buffer = new Buffer(base64string, 'base64');

            return {
                extension: extension,
                buffer: buffer
            };
        });
        var cdnUri = "http://cdn.pojokan.com.global.prod.fastly.net";
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
                    // Your bucket now contains:
                    // - "image.png" (with the contents of `/local/path/image.png')

                    // `file` is an instance of a File object that refers to your new file.


                    Unit.create(unitData, (err, unit) => {
                        if (err)
                            return cb(err);
                        locationData.unitId = unit.id;
                        Location.create(locationData, (err, location) => {
                            if (err)
                                return cb(err);
                            data.id = unit.id;
                            cb(null, data);
                        });
                    });

                });
            });
            wStream.write(buffer);
            wStream.end();
        });
        // var gcs = require('@google-cloud/storage')({
        //     projectId: 'spot-storage',
        //     keyFilename: '../file/spot-storage-5e984703f061.json'
        // });
        // var bucket = gcs.bucket("regional-bucket-01-us");
        // var options = {
        //     entity: 'allUsers',
        //     role: gcs.acl.READER_ROLE
        // };
        // bucket.acl.add(options, function(err, aclObject) {});
        // console.log(imageBinaries);

        // Unit.create(unitData, (err, unit) => {
        //     if (err)
        //         return cb(err);
        //     locationData.unitId = unit.id;
        //     Location.create(locationData, (err, location) => {
        //         if (err)
        //             return cb(err);
        //         data.id = unit.id;
        //         cb(null, data);
        //     });
        // });
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
