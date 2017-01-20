'use strict'
const logger = require('winston')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let readPostInteractionHandler = (req, res, data, callback) => {
    if (req.query && req.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.telecom
      delete data.communication
      delete data.address
      delete data.photo
      delete data.contact
      delete data.extension
      return callback(data)
    }

    fhirCommon.dereferenceAttachment(data, (err) => {
      if (err) {
        logger.warn(err)
      }
      callback(data)
    })
  }

  return {
    name: 'Patient',

    preInteractionHandlers: {
      create: (req, res, onSuccess) => {
        fhirCommon.referenceAttachment(req.body, (err) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }
          onSuccess()
        })
      }
    },

    postInteractionHandlers: {
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler
    },

    searchFilters: (queryParams, callback) => {
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
