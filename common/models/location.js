'use strict';
var app = require('../../server/server');

module.exports = function(Location) {
    Location.observe("after save", (context, next) => {
        var UnitLocation = app.models.UnitLocation;
        var Unit = app.models.Unit;

        // operation on create new
        if (context.instance && context.isNewInstance) {
            Unit.findById(context.instance.unitId, (err, unit) => {
                if (err)
                    return next(err);

                var unitLocation = {
                    "unit": unit.name,
                    "address": context.instance.address,
                    "phones": context.instance.phones,
                    "images": context.instance.images,
                    "geolocation": context.instance.geolocation,
                    "category": context.instance.category || "uncategorized",
                    "tags": context.instance.tags,
                    "unitId": context.instance.unitId,
                    "locationId": context.instance.id
                };
                UnitLocation.create(unitLocation, (err, data) => {
                    next(err);
                });
            });
        }
        // operation on update
        else { 
            next();
        }
    });
};
