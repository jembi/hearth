'use strict'
const FhirCommon = require('../common')
const mongodb = require('mongodb')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let writeToGridFS = (resource, done) => {
    mongo.getDB((err, db) => {
      if (err) {
        return done(err)
      }
      let bucket = new mongodb.GridFSBucket(db)

      if (!resource || !resource.content) {
        return done(null, FhirCommon().buildHTTPOutcome(400, 'error', 'invalid', 'No content in binary resource'))
      }

      let stream = bucket.openUploadStream()

      stream.on('error', (err) => {
        return done(err)
      })
      .on('finish', (doc) => {
        if (!doc) {
          return done('GridFS create failed')
        }
        if (!resource._transforms) {
          resource._transforms = {}
        }

        delete resource.content
        resource._transforms.content = doc._id
        done()
      })
      stream.end(resource.content)
    })
  }

  return {
    name: 'Binary',

    preInteractionHandlers: {
      create: (ctx, resource, done) => {
        writeToGridFS(resource, done)
      },

      update: (ctx, resource, done) => {
        writeToGridFS(resource, done)
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
