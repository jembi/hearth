'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Procedure',

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['encounter', 'patient']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['encounter']) {
        query['$and'].push({
          'encounter.reference': fhirCommon.util.paramAsReference(queryParams['encounter'], 'Encounter')
        })
      }

      if (queryParams['patient']) {
        query['$and'].push({
          'subject.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        })
      }

      if (query['$and'].length > 0) {
        query = mongo.util.collapseWhenSingleClause(query)
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
