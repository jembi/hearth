'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Procedure',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        encounter: { allowArray: false, required: false },
        patient: { allowArray: false, required: false }
      }

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
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
