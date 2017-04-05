'use strict'

const FhirCommon = require('../common')
const constants = require('../../constants')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Questionnaire',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        identifier: {}
      }

      fhirCommon.util.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
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
