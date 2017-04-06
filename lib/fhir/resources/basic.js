'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Basic',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      let supportedParams = ['code', 'subject']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
      }

      let query = { $and: [] }

      if (queryParams['code']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('code.coding', queryParams['code']))
      }

      if (queryParams['subject']) {
        query['$and'].push({
          'subject.reference': fhirCommon.util.paramAsReference(queryParams['subject'], 'Encounter')
        })
      }

      if (query['$and'].length > 0) {
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
