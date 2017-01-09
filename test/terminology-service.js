'use strict'
const env = require('./test-env/init')()
const tap = require('tap')
const TS = require('../lib/fhir/services/terminology-service')

// test the tester

tap.test('terminology-service.collectionNameForSystem should generate a valid collection name', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    let ts = TS()
    t.equal(ts.collectionNameForSystem('pshr:valueset:procedure-codes'), 'concept_pshr_valueset_procedure_codes')
    t.equal(ts.collectionNameForSystem('http://hl7.org/fhir/sid/icd-10'), 'concept_http___hl7_org_fhir_sid_icd_10')

    env.clearDB((err) => {
      t.error(err)
      t.end()
    })
  })
})
