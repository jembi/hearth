'use strict'
const logger = require('winston')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let readPostInteractionHandler = (req, res, data, callback) => {
    if (req.query && req.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.identifier
      delete data.telecom
      delete data.photo
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
    name: 'Practitioner',

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
      let supportedParams = ['identifier', 'given', 'family', 'role', 'organization']

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

      if (queryParams['role']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('practitionerRole.role.coding', queryParams['role']))
      }

      if (queryParams['organization']) {
        let clause = {}
        clause['latest.practitionerRole'] = {
          $elemMatch: {
            managingOrganization: {
              reference: fhirCommon.util.paramAsReference(queryParams['organization'], 'Organization')
            }
          }
        }
        query['$and'].push(clause)
      }

      if (query['$and'].length > 0) {
        query = mongo.util.collapseAndQuery(query)
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
