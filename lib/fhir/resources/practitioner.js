'use strict'
const logger = require('winston')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let readPostInteractionHandler = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.identifier
      delete data.telecom
      delete data.photo
      return callback(null, null, data)
    }

    fhirCommon.dereferenceAttachment(data, (err) => {
      if (err) {
        logger.warn(err)
      }
      callback(null, null, data)
    })
  }

  return {
    name: 'Practitioner',

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
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        identifier: { allowArray: false, required: false },
        given: { allowArray: false, required: false },
        family: { allowArray: false, required: false },
        role: { allowArray: false, required: false },
        organization: { allowArray: false, required: false }
      }

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
        clause['practitionerRole'] = {
          $elemMatch: {
            managingOrganization: {
              reference: fhirCommon.util.paramAsReference(queryParams['organization'], 'Organization')
            }
          }
        }
        query['$and'].push(clause)
      }

      if (query['$and'].length > 0) {
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
