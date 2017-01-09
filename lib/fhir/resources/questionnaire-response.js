'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let summarize = (data) => {
    fhirCommon.addSubsettedSecurityLabel(data)
    delete data.group
  }

  let readPostInteractionHandler = (req, res, data, callback) => {
    if (req.query && req.query._summary) {
      summarize(data)
      return callback(data)
    }

    callback(data)
  }

  return {
    name: 'QuestionnaireResponse',

    postInteractionHandlers: {
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler,
      search: (req, res, data, callback) => {
        if (req.query && req.query._summary && data.resourceType === 'Bundle') {
          data.entry.forEach((e) => summarize(e.resource))
        }
        callback(data)
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
        clause['latest.encounter.reference'] = fhirCommon.util.paramAsReference(queryParams['encounter'], 'Encounter')
        query['$and'].push(clause)
      }

      if (queryParams['patient']) {
        let clause = {}
        clause['latest.subject.reference'] = fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        query['$and'].push(clause)
      }

      if (queryParams['questionnaire']) {
        let clause = {}
        clause['latest.questionnaire.reference'] = fhirCommon.util.paramAsReference(queryParams['questionnaire'], 'Questionnaire')
        query['$and'].push(clause)
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
