'use strict'
const logger = require('winston')
const FhirCommon = require('../common')
const PixmService = require('../services/pixm')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)
  const pixmService = PixmService(fhirCommon)

  let readPostInteractionHandler = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.telecom
      delete data.communication
      delete data.address
      delete data.photo
      delete data.contact
      delete data.extension
      return callback(null, null, data)
    }

    fhirCommon.dereferenceAttachment(data, (err) => {
      if (err) {
        logger.warn(err)
      }
      callback(null, null, data)
    })
  }

  let searchPostInteractionHandler = (ctx, data, callback) => {
    if (ctx.operation === '$ihe-pix') {
      pixmService.searchPostInteractionHandler(ctx, data, callback)
    } else {
      callback(null, null, data)
    }
  }

  return {
    name: 'Patient',

    preInteractionHandlers: {
      create: (ctx, resource, callback) => {
        fhirCommon.referenceAttachment(resource, (err) => {
          if (err) {
            return callback(err)
          }
          callback()
        })
      }
    },

    postInteractionHandlers: {
      search: searchPostInteractionHandler,
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query

      if (ctx.operation === '$ihe-pix') {
        return pixmService.buildPIXmQuery(ctx, callback)
      }

      let supportedParams = ['identifier', 'given', 'family']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['identifier']) {
        query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryParams['identifier']))
      }

      if (queryParams['given']) {
        query['$and'].push(fhirCommon.util.nameToMongoClause('given', queryParams['given']))
      }

      if (queryParams['family']) {
        query['$and'].push(fhirCommon.util.nameToMongoClause('family', queryParams['family']))
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
