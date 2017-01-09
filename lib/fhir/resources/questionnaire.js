'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Questionnaire',

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['identifier']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['identifier']) {
        query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryParams['identifier']))
      }

      if (query['$and'].length > 0) {
        query = mongo.util.collapseAndQuery(query)
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
