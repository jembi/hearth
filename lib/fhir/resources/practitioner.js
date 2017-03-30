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
        identifier: { allowArray: false, required: false, operators: { exact: true } },
        given: { allowArray: false, required: false, operators: { exact: true } },
        family: { allowArray: false, required: false, operators: { exact: true } },
        role: { allowArray: false, required: false, operators: { exact: true } },
        organization: { allowArray: false, required: false, operators: { exact: true } }
      }

      fhirCommon.util.validateQueryParamsReturnQueryObject(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryObject['identifier'].value))
        }

        if (queryObject['given']) {
          query['$and'].push(fhirCommon.util.nameToMongoClause('given', queryObject['given'].value))
        }

        if (queryObject['family']) {
          query['$and'].push(fhirCommon.util.nameToMongoClause('family', queryObject['family'].value))
        }

        if (queryObject['role']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('practitionerRole.role.coding', queryObject['role'].value))
        }

        if (queryObject['organization']) {
          let clause = {}
          clause['practitionerRole'] = {
            $elemMatch: {
              managingOrganization: {
                reference: fhirCommon.util.paramAsReference(queryObject['organization'].value, 'Organization')
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
      })
    }
  }
}
