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
    if (resource.created) {
      resource._transforms = {
        created: fhirCommon.util.transformDate(resource.created)
      }
    }
    callback()
  }

  return {
    name: 'DocumentManifest',

    preInteractionHandlers: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        patient: {},
        'patient.identifier': {},
        created: {},
        'author.given': {},
        'author.family': {},
        type: {},
        status: {}
      }

      fhirCommon.util.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }
        let promises = []

        if (queryObject['patient']) {
          // TODO handle full url references
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

        if (queryObject['created']) {
          query['$and'].push(fhirCommon.util.paramAsDateRangeClause('_transforms.created', queryObject['created'][constants.NO_MODIFER]))
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

        if (queryObject['type']) {
          query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        if (queryObject['status']) {
          query['$and'].push({ status: queryObject['status'][constants.NO_MODIFER] })
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
