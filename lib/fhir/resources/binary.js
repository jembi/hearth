'use strict'
const FhirCommon = require('../common')
const mongodb = require('mongodb')
const Readable = require('stream').Readable

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Binary',

    preInteractionHandlers: {
      create: (ctx, resource, done) => {
        mongo.getDB((err, db) => {
          if (err) {
            return done(err)
          }
          let bucket = new mongodb.GridFSBucket(db)
          
          if (!resource || !resource.content) {
            return done(null, 'No content in binary resource')
          }
          
          let stream = new Readable()
          stream.push(resource.content)
          stream.push(null)
          
          stream.pipe(bucket.openUploadStream())
          .on('error', function(err) {
            return done(err)
          })
          .on('finish', function(doc) {
            if (!doc) {
              return done('GridFS create failed')
            }
            if (!resource._transforms) {
              resource._transforms = {}
            }
            resource._transforms.content = doc._id
            done()
          })          
        })
      }
    },

    // TODO: Post interaction handlers

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['contenttype']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['contenttype']) {
        query['$and'].push({ 'latest.contentType': queryParams['contenttype'] })
      }

      if (query['$and'].length > 0) {
        query = mongo.util.collapseWhenSingleClause(query)
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
