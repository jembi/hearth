'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'ProcedureRequest',

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['encounter', 'patient']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['encounter']) {
        query['$and'].push({
          'latest.encounter.reference': fhirCommon.util.paramAsReference(queryParams['encounter'], 'Encounter')
        })
      }

      if (queryParams['patient']) {
        query['$and'].push({
          'latest.subject.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        })
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
