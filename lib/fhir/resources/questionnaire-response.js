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
        encounter: {},
        patient: {},
        questionnaire: {},
        'questionnaire.identifier': {}
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

        if (queryObject['questionnaire']) {
          for (const k in queryObject['questionaire']) {
            query['$and'].push({ 'questionnaire.reference': fhirCommon.util.paramAsReference(queryObject['questionnaire'][k], 'Questionnaire') })
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
