'use strict'
const FhirCommon = require('../common')
const Patient = require('./patient')
const Practitioner = require('./practitioner')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const patient = Patient(mongo)
  const practitioner = Practitioner(mongo)

  const transformHandler = (req, res, onSuccess) => {
    if (req.body.created) {
      req.body._transforms = {
        created: fhirCommon.util.transformDate(req.body.created)
      }
    }
    onSuccess()
  }

  return {
    name: 'DocumentManifest',

    preInteractionHandlers: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['patient', 'patient.identifier', 'created', 'author.given', 'author.family', 'type', 'status']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }
      let promises = []

      if (queryParams['patient']) {
        // TODO handle full url references
        query['$and'].push({
          'latest.subject.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
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

      if (queryParams['created']) {
        query['$and'].push(fhirCommon.util.paramAsDateRangeClause('_transforms.created', queryParams['created']))
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

      if (queryParams['type']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryParams['type']))
      }

      if (queryParams['status']) {
        query['$and'].push({ 'latest.status': queryParams['status'] })
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
