'use strict'

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

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
        organization: {},
        type: {}
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['organization']) {
          query['$and'].push({ 'managingOrganization.reference': queryUtils.paramAsReference(queryObject['organization'][constants.NO_MODIFER], 'Organization') })
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
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
