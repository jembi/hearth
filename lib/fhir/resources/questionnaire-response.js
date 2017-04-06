'use strict'

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

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

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['encounter']) {
          query['$and'].push({ 'encounter.reference': queryUtils.paramAsReference(queryObject['encounter'][constants.NO_MODIFER], 'Encounter') })
        }

        if (queryObject['patient']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['questionnaire']) {
          query['$and'].push({ 'questionnaire.reference': queryUtils.paramAsReference(queryObject['questionnaire'][constants.NO_MODIFER], 'Questionnaire') })
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
