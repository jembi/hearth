'use strict'

const mongodb = require('mongodb')
const logger = require('winston')

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')
const fhirRoot = require('../root')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  const afterReadHook = (ctx, data, callback) => {
    populateBinaryContent(data, (err) => {
      if (err) {
        return callback(err)
      }
      callback(null, null, data)
    })
  }

  const afterSearchHook = (ctx, data, callback) => {
    const promises = []
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

  const populateBinaryContent = (data, callback) => {
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

  const writeToGridFS = (resource, done) => {
    mongo.getDB((err, db) => {
      if (err) {
        return done(err)
      }
      const bucket = new mongodb.GridFSBucket(db)

      if (!resource || !resource.content) {
        return done(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'No content in binary resource'))
      }

      const stream = bucket.openUploadStream()

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

  const createBundleFromResource = (jsonObject) => {
    return {
      resourceType: 'Bundle',
      type: 'document',
      meta: {
        lastUpdated: new Date()
      },
      entry: [
        jsonObject
      ]
    }
  }

  const convertBinaryToJSON = (ctx, resource, callback) => {
    const supportedContentTypes = ['application/json+fhir', 'application/fhir+json', 'application/json']

    if (supportedContentTypes.indexOf(resource.contentType) > -1) {
      mongo.getDB((err, db) => {
        if (err) {
          logger.error(err)
          return callback()
        }

        let data = ''
        const bucket = new mongodb.GridFSBucket(db)
        const bucketStream = bucket.openDownloadStream(resource._transforms.content)

        bucketStream.on('error', (err) => {
          logger.error(err)
          return callback()
        })

        bucketStream.on('data', (chunk) => {
          data += chunk
        })

        bucketStream.on('end', () => {
          let jsonObject = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))

          if (jsonObject && jsonObject.resourceType) {
            if (jsonObject.resourceType !== 'Bundle') {
              jsonObject = createBundleFromResource(jsonObject)
            }
            fhirRoot.processRootBundle(ctx, jsonObject, (err, badRequest) => {
              if (err) {
                logger.error(err)
              }

              if (badRequest) {
                logger.error(badRequest)
              }

              logger.info('Successfully converted Binary to Bundle and saved to database')
              callback()
            })
          } else {
            callback()
          }
        })
      })
    } else {
      callback()
    }
  }

  const afterCreateHook = (ctx, resource, callback) => {
    convertBinaryToJSON(ctx, resource, callback)
  }

  const afterUpdateHook = (ctx, resource, callback) => {
    convertBinaryToJSON(ctx, resource, callback)
  }

  return {
    name: 'Binary',

    before: {
      create: (ctx, resource, done) => {
        writeToGridFS(resource, done)
      },

      update: (ctx, resource, done) => {
        writeToGridFS(resource, done)
      }
    },

    after: {
      read: afterReadHook,
      vread: afterReadHook,
      search: afterSearchHook,
      create: afterCreateHook,
      update: afterUpdateHook
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        contenttype: {}
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        const query = { $and: [] }

        if (queryObject['contenttype']) {
          query['$and'].push({ contentType: queryObject['contenttype'][constants.NO_MODIFER] })
        }

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}
