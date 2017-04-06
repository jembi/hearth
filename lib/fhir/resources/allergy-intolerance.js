'use strict'

const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'AllergyIntolerance',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        patient: {}
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['patient']) {
          query['$and'].push({ 'patient.reference': queryUtils.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
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
