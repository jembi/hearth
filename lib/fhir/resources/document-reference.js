'use strict'
const FhirCommon = require('../common')
const Patient = require('./patient')
const Practitioner = require('./practitioner')

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

    searchFilters: (queryParams, callback) => {
      let supportedParams = [
        'patient', 'patient.identifier', 'indexed', 'author.given', 'author.family', 'status', 'class',
        'type', 'setting', 'period', 'facility', 'event', 'securityLabel', 'format', 'related-id'
      ]

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }
      let promises = []

      if (queryParams['patient']) {
        query['$and'].push({
          'subject.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        })
      }

      if (queryParams['patient.identifier']) {
        promises.push(new Promise((resolve, reject) => {
          fhirCommon.util.genChainedParamQuery(queryParams['patient.identifier'], 'subject.reference', 'identifier', patient, (err, clause) => {
            if (err) { return reject(err) }
            query['$and'].push(clause)
            resolve()
          })
        }))
      }

      if (queryParams['indexed']) {
        query['$and'].push(fhirCommon.util.paramAsDateRangeClause('_transforms.indexed', queryParams['indexed']))
      }

      if (queryParams['author.given']) {
        promises.push(new Promise((resolve, reject) => {
          fhirCommon.util.genChainedParamQuery(queryParams['author.given'], 'author.reference', 'given', practitioner, (err, clause) => {
            if (err) { return reject(err) }
            query['$and'].push(clause)
            resolve()
          })
        }))
      }

      if (queryParams['author.family']) {
        promises.push(new Promise((resolve, reject) => {
          fhirCommon.util.genChainedParamQuery(queryParams['author.family'], 'author.reference', 'family', practitioner, (err, clause) => {
            if (err) { return reject(err) }
            query['$and'].push(clause)
            resolve()
          })
        }))
      }

      if (queryParams['status']) {
        query['$and'].push({
          status: queryParams['status']
        })
      }

      if (queryParams['class']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('class.coding', queryParams['class']))
      }

      if (queryParams['type']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryParams['type']))
      }

      if (queryParams['setting']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.practiceSetting.coding', queryParams['setting']))
      }

      if (queryParams['period']) {
        query['$and'].push(fhirCommon.util.paramAsDateRangeClause({
          start: '_transforms.context.period.start',
          end: '_transforms.context.period.end'
        },
          queryParams['period']
        ))
      }

      if (queryParams['facility']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.facilityType.coding', queryParams['facility']))
      }

      if (queryParams['event']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.event.coding', queryParams['event']))
      }

      if (queryParams['securityLabel']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('securityLabel.coding', queryParams['securityLabel']))
      }

      if (queryParams['format']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('content.format', queryParams['format']))
      }

      if (queryParams['related-id']) {
        query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('context.related.identifier', queryParams['related-id']))
      }

      Promise.all(promises).then(() => {
        if (query['$and'].length > 0) {
          query = mongo.util.collapseWhenSingleClause(query)
          callback(null, null, query)
        } else {
          callback()
        }
      }).catch((err) => {
        callback(err)
      })
    }
  }
}
