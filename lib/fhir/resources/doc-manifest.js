'use strict'
const FhirCommon = require('../common')
const Patient = require('./patient')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const patient = Patient(mongo)

  return {
    name: 'DocumentManifest',

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['patient', 'patient.identifier']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }
      let promises = []

      if (queryParams['patient']) {
        // TODO handle full url references
        query['$and'].push({
          'latest.subject': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        })
      }

      if (queryParams['patient.identifier']) {
        promises.push(new Promise((resolve, reject) => {
          // fetch the referenced patient filters using patient module
          patient.searchFilters({ identifier: queryParams['patient.identifier'] }, (err, badRequest, patFilters) => {
            if (err) { return reject(err) }
            if (badRequest) { return reject(new Error('Bad request made to patient module via doc-manifest module')) }
            mongo.getDB((err, db) => {
              if (err) { return reject(err) }
              const c = db.collection('Patient')
              // find patients in question
              c.find(patFilters).toArray((err, results) => {
                if (err) { return reject(err) }
                if (results.length === 0) {
                  // add clause to a non-existant patient resource so an empty result set is returned
                  query['$and'].push({ 'latest.subject': 'Patient/_none' })
                  return resolve()
                }

                // build up a query that finds docs for each matching patient
                let patQuery = { '$or': [] }
                results.forEach((pat) => {
                  patQuery['$or'].push({ 'latest.subject': `Patient/${pat._id}` })
                })
                query['$and'].push(patQuery)
                resolve()
              })
            })
          })
        }))
      }

      Promise.all(promises).then(() => {
        if (query['$and'].length > 0) {
          query = mongo.util.collapseWhenSingleClause(query)
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }

  }
}
