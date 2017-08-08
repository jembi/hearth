'use strict'

const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'Composition',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        entry: { allowArray: true },
        patient: { modifiers: { exact: true } },
        status: { modifiers: { exact: true } },
        subject: { modifiers: { exact: true } },
        type: { modifiers: { exact: true } }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        // TODO: HEARTH-107

        // TODO: HEARTH-108

        // TODO: HEARTH-109

        // TODO: HEARTH-110

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}