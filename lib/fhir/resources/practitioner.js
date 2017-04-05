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
        identifier: {},
        given: {},
        family: {},
        role: {},
        organization: {}
      }

      fhirCommon.util.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          for (const modifier in queryObject['identifier']) {
            query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][modifier]))
          }
        }

        if (queryObject['given']) {
          for (const modifier in queryObject['given']) {
            query['$and'].push(fhirCommon.util.nameToMongoClause('given', queryObject['given'][modifier]))
          }
        }

        if (queryObject['family']) {
          for (const modifier in queryObject['family']) {
            query['$and'].push(fhirCommon.util.nameToMongoClause('family', queryObject['family'][modifier]))
          }
        }

        if (queryObject['role']) {
          for (const modifier in queryObject['role']) {
            query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('practitionerRole.role.coding', queryObject['role'][modifier]))
          }
        }

        if (queryObject['organization']) {
          for (const modifier in queryObject['organization']) {
            let clause = {}
            clause['practitionerRole'] = {
              $elemMatch: {
                managingOrganization: {
                  reference: fhirCommon.util.paramAsReference(queryObject['organization'][modifier], 'Organization')
                }
              }
            }
            query['$and'].push(clause)
          }
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
