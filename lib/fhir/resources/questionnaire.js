'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Questionnaire',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        identifier: {}
      }

      fhirCommon.util.validateAndModifyQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryObject['identifier']))
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
