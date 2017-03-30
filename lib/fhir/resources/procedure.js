'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Procedure',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        encounter: { allowArray: false, required: false, operators: { exact: true } },
        patient: { allowArray: false, required: false, operators: { exact: true } }
      }

      fhirCommon.util.validateQueryParamsReturnQueryObject(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['encounter']) {
          query['$and'].push({
            'encounter.reference': fhirCommon.util.paramAsReference(queryObject['encounter'], 'Encounter')
          })
        }

        if (queryObject['patient']) {
          query['$and'].push({
            'subject.reference': fhirCommon.util.paramAsReference(queryObject['patient'], 'Patient')
          })
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
