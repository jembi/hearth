'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    name: 'Basic',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        code: { allowArray: false, required: false, operators: { exact: true } },
        subject: { allowArray: false, required: false, operators: { exact: true } }
      }

      fhirCommon.util.validateQueryParamsReturnQueryObject(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['code']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('code.coding', queryObject['code']))
        }

        if (queryObject['subject']) {
          query['$and'].push({
            'subject.reference': fhirCommon.util.paramAsReference(queryObject['subject'], 'Encounter')
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
