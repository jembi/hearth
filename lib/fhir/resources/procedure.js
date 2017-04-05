'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Procedure',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        encounter: {},
        patient: {}
      }

      fhirCommon.util.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['encounter']) {
          for (const k in queryObject['encounter']) {
            query['$and'].push({ 'encounter.reference': fhirCommon.util.paramAsReference(queryObject['encounter'][k], 'Encounter') })
          }
        }

        if (queryObject['patient']) {
          for (const k in queryObject['patient']) {
            query['$and'].push({ 'subject.reference': fhirCommon.util.paramAsReference(queryObject['patient'][k], 'Patient') })
          }
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
