'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let readPostInteractionHandler = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.telecom
      delete data.address
      delete data.position
      return callback(null, null, data)
    }

    callback(null, null, data)
  }

  return {
    name: 'Location',

    postInteractionHandlers: {
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        organization: { allowArray: false, required: false, operators: { exact: true } },
        type: { allowArray: false, required: false, operators: { exact: true } }
      }

      fhirCommon.util.validateQueryParamsReturnQueryObject(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['organization']) {
          query['$and'].push({
            'managingOrganization.reference': fhirCommon.util.paramAsReference(queryObject['organization'], 'Organization')
          })
        }

        if (queryObject['type']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryObject['type']))
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
