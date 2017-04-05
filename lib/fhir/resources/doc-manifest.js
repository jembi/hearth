'use strict'
const FhirCommon = require('../common')
const Patient = require('./patient')
const Practitioner = require('./practitioner')

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
          for (const modifier in queryObject['patient']) {
            query['$and'].push({ 'subject.reference': fhirCommon.util.paramAsReference(queryObject['patient'][modifier], 'Patient') })
          }
        }

        if (queryObject['patient.identifier']) {
          for (const modifier in queryObject['patient.identifier']) {
            promises.push(new Promise((resolve, reject) => {
              fhirCommon.util.genChainedParamQuery(queryObject['patient.identifier'][modifier], 'subject.reference', 'identifier', patient, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['created']) {
          for (const modifier in queryObject['created']) {
            query['$and'].push(fhirCommon.util.paramAsDateRangeClause('_transforms.created', queryObject['created'][modifier]))
          }
        }

        if (queryObject['author.given']) {
          for (const modifier in queryObject['author.given']) {
            promises.push(new Promise((resolve, reject) => {
              fhirCommon.util.genChainedParamQuery(queryObject['author.given'][modifier], 'author.reference', 'given', practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['author.family']) {
          for (const modifier in queryObject['author.family']) {
            promises.push(new Promise((resolve, reject) => {
              fhirCommon.util.genChainedParamQuery(queryObject['author.family'][modifier], 'author.reference', 'family', practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['type']) {
          for (const modifier in queryObject['type']) {
            query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][modifier]))
          }
        }

        if (queryObject['status']) {
          for (const modifier in queryObject['status']) {
            query['$and'].push({ status: queryObject['status'][modifier] })
          }
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
