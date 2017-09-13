 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const mongodb = require('mongodb')
const logger = require('winston')

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')
const FhirRoot = require('../root')
const ModuleLoader = require('../module-loader')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const moduleLoader = ModuleLoader(mongo)

  const fhirResources = moduleLoader.getLoadedModules()
  const fhirRoot = FhirRoot(mongo, fhirResources)

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
    if (data.entry.length === 0) {
      return callback(null, null, data)
    }

    data.entry.forEach((resource) => {
      // create promises for the binary construction
      promises.push(new Promise((resolve, reject) => {
        populateBinaryContent(resource.resource, (err) => {
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
        {
          resource: jsonObject
        }
      ]
    }
  }

  const convertBinaryToJSON = (ctx, resource, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      const bucket = new mongodb.GridFSBucket(db)
      const bucketStream = bucket.openDownloadStream(resource._transforms.content)

      bucketStream.on('error', (err) => {
        return callback(err)
      })

      let data = ''
      bucketStream.on('data', (chunk) => {
        data += chunk
      })

      bucketStream.on('end', () => {
        try {
          let jsonObject = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))

          if (!jsonObject.resourceType) {
            throw new Error('JSON content is not a valid FHIR resource')
          }

          if (jsonObject.resourceType !== 'Bundle') {
            jsonObject = createBundleFromResource(jsonObject)
          }

          callback(null, jsonObject)
        } catch (err) {
          callback(err)
        }
      })
    })
  }

  const afterChangeHook = (ctx, resource, callback) => {
    const supportedContentTypes = ['application/json+fhir', 'application/fhir+json', 'application/json']

    if (supportedContentTypes.indexOf(resource.contentType) === -1) {
      logger.debug(`Cannot convert Binary with content type ${resource.contentType} to Bundle`)
      return callback()
    }

    convertBinaryToJSON(ctx, resource, (err, bundle) => {
      if (err) {
        logger.error(err)
        return callback()
      }

      fhirRoot.processRootBundle(ctx, bundle, (err, httpResponse) => {
        if (err) {
          logger.error(err)
          return callback()
        }

        if (httpResponse.httpStatus < 200 || httpResponse.httpStatus >= 300) {
          logger.error(new Error(`Non 2xx status code: ${httpResponse.httpStatus} while trying to process binary bundle`), httpResponse)
          return callback()
        }

        callback()
      })
    })
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
      create: afterChangeHook,
      update: afterChangeHook
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
