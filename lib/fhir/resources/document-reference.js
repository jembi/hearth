'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'DocumentReference',

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['patient', 'status', 'class', 'type']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['patient']) {
        query['$and'].push({
          'latest.subject.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        })
      }

      if (queryParams['status']) {
        query['$and'].push({
          'latest.status': queryParams['status']
        })
      }

      if (queryParams['class']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('class.coding', queryParams['class']))
      }

      if (queryParams['type']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryParams['type']))
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
