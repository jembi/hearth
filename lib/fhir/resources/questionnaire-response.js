'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let summarize = (data) => {
    fhirCommon.addSubsettedSecurityLabel(data)
    delete data.group
  }

  let readPostInteractionHandler = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      summarize(data)
      return callback(null, null, data)
    }

    callback(null, null, data)
  }

  return {
    name: 'QuestionnaireResponse',

    postInteractionHandlers: {
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler,
      search: (ctx, data, callback) => {
        if (ctx.query && ctx.query._summary && data.resourceType === 'Bundle') {
          data.entry.forEach((e) => summarize(e.resource))
        }
        callback(null, null, data)
      }
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        encounter: { allowArray: false, required: false, operators: { exact: true } },
        patient: { allowArray: false, required: false, operators: { exact: true } },
        questionnaire: { allowArray: false, required: false, operators: { exact: true } },
        'questionnaire.identifier': { allowArray: false, required: false, operators: { exact: true } }
      }

      fhirCommon.util.validateQueryParamsReturnQueryObject(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['encounter']) {
          let clause = {}
          clause['encounter.reference'] = fhirCommon.util.paramAsReference(queryObject['encounter'], 'Encounter')
          query['$and'].push(clause)
        }

        if (queryObject['patient']) {
          let clause = {}
          clause['subject.reference'] = fhirCommon.util.paramAsReference(queryObject['patient'], 'Patient')
          query['$and'].push(clause)
        }

        if (queryObject['questionnaire']) {
          let clause = {}
          clause['questionnaire.reference'] = fhirCommon.util.paramAsReference(queryObject['questionnaire'], 'Questionnaire')
          query['$and'].push(clause)
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
