'use strict'
const FhirCommon = require('../common')
const mongodb = require('mongodb')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let readPostInteractionHandler = (ctx, data, callback) => {
    populateBinaryContent(data, (err) => {
      if (err) {
        return callback(err)
      }
      callback(null, null, data)
    })
  }

  let searchPostInteractionHandler = (ctx, data, callback) => {
    let promises = []
    if (data.length === 0) {
      return callback(null, null, data)
    }

    data.forEach((resource) => {
      // create promises for the binary construction
      promises.push(new Promise((resolve, reject) => {
        populateBinaryContent(resource, (err) => {
          if (err) {
            return reject(err)
          }
          resolve()
        })
      }))
    })

    // return when all promises have been completed
    Promise.all(promises).then(() => {
      return callback(null, null, data)
    }, (err) => {
      return callback(err)
    })
  }

  let populateBinaryContent = (data, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }
      let binaryString = ''
      const bucket = new mongodb.GridFSBucket(db)

      bucket.openDownloadStream(data._transforms.content)
        .on('error', (err) => {
          callback(err)
        })
        .on('data', (chunk) => {
          binaryString += chunk
        })
        .on('end', () => {
          data.content = binaryString
          callback()
        })
    })
  }

  let writeToGridFS = (resource, done) => {
    mongo.getDB((err, db) => {
      if (err) {
        return done(err)
      }
      let bucket = new mongodb.GridFSBucket(db)

      if (!resource || !resource.content) {
        return done(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'No content in binary resource'))
      }

      let stream = bucket.openUploadStream()

      stream.on('error', (err) => {
        return done(err)
      })
      .on('finish', (doc) => {
        if (!doc) {
          return done(new Error('GridFS create failed'))
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

    postInteractionHandlers: {
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler,
      search: searchPostInteractionHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        contenttype: { allowArray: false, required: false }
      }

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['contenttype']) {
        query['$and'].push({ contentType: queryParams['contenttype'] })
      }

      if (query['$and'].length > 0) {
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
