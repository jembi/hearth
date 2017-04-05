'use strict'

const FhirCommon = require('../common')
const Patient = require('./patient')
const Practitioner = require('./practitioner')
const constants = require('../../constants')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const patient = Patient(mongo)
  const practitioner = Practitioner(mongo)

  const transformHandler = (ctx, resource, callback) => {
    resource._transforms = {}
    if (resource.indexed) {
      resource._transforms.indexed = fhirCommon.util.transformDate(resource.indexed)
    }
    if (resource.context && resource.context.period) {
      resource._transforms.context = { period: {} }
      if (resource.context.period.start) {
        resource._transforms.context.period.start = fhirCommon.util.transformDate(resource.context.period.start)
      }
      if (resource.context.period.end) {
        resource._transforms.context.period.end = fhirCommon.util.transformDate(resource.context.period.end)
      }
    }
    callback()
  }

  return {
    name: 'DocumentReference',

    preInteractionHandlers: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        patient: {},
        'patient.identifier': {},
        indexed: { allowArray: true },
        'author.given': {},
        'author.family': {},
        status: {},
        class: {},
        type: {},
        setting: {},
        period: { allowArray: true },
        facility: {},
        event: {},
        securityLabel: {},
        format: {},
        'related-id': {}
      }

      fhirCommon.util.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }
        let promises = []

        if (queryObject['patient']) {
          query['$and'].push({ 'subject.reference': fhirCommon.util.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['patient.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            fhirCommon.util.genChainedParamQuery(queryObject['patient.identifier'][constants.NO_MODIFER], 'subject.reference', 'identifier', patient, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['indexed']) {
          query['$and'].push(fhirCommon.util.paramAsDateRangeClause('_transforms.indexed', queryObject['indexed'][constants.NO_MODIFER]))
        }

        if (queryObject['author.given']) {
          promises.push(new Promise((resolve, reject) => {
            fhirCommon.util.genChainedParamQuery(queryObject['author.given'][constants.NO_MODIFER], 'author.reference', 'given', practitioner, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['author.family']) {
          promises.push(new Promise((resolve, reject) => {
            fhirCommon.util.genChainedParamQuery(queryObject['author.family'][constants.NO_MODIFER], 'author.reference', 'family', practitioner, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['status']) {
          query['$and'].push({ status: queryObject['status'][constants.NO_MODIFER] })
        }

        if (queryObject['class']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('class.coding', queryObject['class'][constants.NO_MODIFER]))
        }

        if (queryObject['type']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        if (queryObject['setting']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.practiceSetting.coding', queryObject['setting'][constants.NO_MODIFER]))
        }

        if (queryObject['period']) {
          query['$and'].push(fhirCommon.util.paramAsDateRangeClause({
            start: '_transforms.context.period.start',
            end: '_transforms.context.period.end'
          },
              queryObject['period'][constants.NO_MODIFER]
            ))
        }

        if (queryObject['facility']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.facilityType.coding', queryObject['facility'][constants.NO_MODIFER]))
        }

        if (queryObject['event']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.event.coding', queryObject['event'][constants.NO_MODIFER]))
        }

        if (queryObject['securityLabel']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('securityLabel.coding', queryObject['securityLabel'][constants.NO_MODIFER]))
        }

        if (queryObject['format']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('content.format', queryObject['format'][constants.NO_MODIFER]))
        }

        if (queryObject['related-id']) {
          query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('context.related.identifier', queryObject['related-id'][constants.NO_MODIFER]))
        }

        Promise.all(promises).then(() => {
          if (query['$and'].length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
