'use strict'

const FhirCommon = require('../common')
const constants = require('../../constants')

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
          query['$and'].push({ 'encounter.reference': fhirCommon.util.paramAsReference(queryObject['encounter'][constants.NO_MODIFER], 'Encounter') })
        }

        if (queryObject['patient']) {
          query['$and'].push({ 'subject.reference': fhirCommon.util.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
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
