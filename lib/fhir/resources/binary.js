'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Binary',

    // TODO: Pre interaction handlers

    // TODO: Post interaction handlers

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['contenttype']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['contenttype']) {
        query['$and'].push(fhirCommon.util.nameToMongoClause('contenttype', queryParams['contenttype']))
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
