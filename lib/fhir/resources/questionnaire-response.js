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

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['encounter', 'patient', 'questionnaire', 'questionnaire.identifier']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['encounter']) {
        let clause = {}
        clause['encounter.reference'] = fhirCommon.util.paramAsReference(queryParams['encounter'], 'Encounter')
        query['$and'].push(clause)
      }

      if (queryParams['patient']) {
        let clause = {}
        clause['subject.reference'] = fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        query['$and'].push(clause)
      }

      if (queryParams['questionnaire']) {
        let clause = {}
        clause['questionnaire.reference'] = fhirCommon.util.paramAsReference(queryParams['questionnaire'], 'Questionnaire')
        query['$and'].push(clause)
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
