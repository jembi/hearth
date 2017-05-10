'use strict'

const tap = require('tap')

const env = require('./test-env/init')()
const server = require('../lib/server')
const _ = require('lodash')
const matchingResultSet = require('./resources/matching-resultset.json')

const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
emmarentia.link = [{ 'other': { 'reference': 'http://localhost:3447/fhir/Patient/12345678987654321' }, 'type': 'refer' }]
const nikita = testPatients.nikita.patient
nikita.id = '3333333333'
delete nikita.link
const mwawi = testPatients.mwawi.patient
mwawi.id = '4444444444'
delete mwawi.link

let resourceLinking
const resourceLinkingTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    resourceLinking = require('../lib/resource-linking')(env.mongo())

    server.start((err) => {
      t.error(err)

      const patients = []

      patients.push(
        charlton,
        emmarentia,
        nikita,
        mwawi
      )
      const c = db.collection('Patient')
      c.insertMany(patients, (err, doc) => {
        t.error(err)
        t.ok(doc)
        t.equal(doc.insertedIds.length, patients.length)

        test(db, () => {
          env.clearDB((err) => {
            t.error(err)
            server.stop(() => {
              t.end()
            })
          })
        })
      })
    })
  })
}

tap.test('Resource Linking - Should update a Patient resource with a link to a matched patient', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const resource = _.cloneDeep(matchingResultSet).entry[0].resource
    const referenceLink = 'http://localhost:3447/fhir/Patient/12345678987654321'

    let c = db.collection('Patient')
    c.findOne({ id: resource.id }, (err, doc) => {
      t.error(err)

      // before updating - should have 2 links
      t.equal(doc.link.length, 2, `should have a link total of: 2`)

      // when
      resourceLinking.linkResource(resource, referenceLink, (err, badRequest) => {
        // then
        t.error(err)
        t.error(badRequest)

        c.findOne({ id: resource.id }, (err, doc) => {
          t.error(err)

          t.equal(doc.link.length, 3, `should have a link total of: 3`)
          // newly added link at index 2
          t.equal(doc.link[2].type, 'refer', `should have a link type of: refer`)
          t.equal(doc.link[2].other.reference, referenceLink, `should have a reference link of: ${referenceLink}`)

          done()
        })
      })
    })
  })
})

tap.test('Resource Linking - Should update an array Patient resources with a link to a matched patient', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const resource = _.cloneDeep(matchingResultSet)
    const referenceLink = 'http://localhost:3447/fhir/Patient/12345678987654321'

    let c = db.collection('Patient')
    c.find({ id: { $in: ['1111111111', '2222222222', '3333333333', '4444444444'] } }).sort({id: 1}).toArray((err, results) => {
      t.error(err)

      t.equal(results[0].id, '1111111111', `should have a resource id of: 1111111111`)
      t.equal(results[0].link.length, 2, `should have a link total of: 2`)
      t.equal(results[1].id, '2222222222', `should have a resource id of: 2222222222`)
      t.equal(results[1].link.length, 1, `should have a link total of: 1`)
      t.equal(results[2].id, '3333333333', `should have a resource id of: 3333333333`)
      t.notOk(results[2].link, 0, `should not have a link property`)
      t.equal(results[3].id, '4444444444', `should have a resource id of: 4444444444`)
      t.notOk(results[3].link, 0, `should not have a link property`)

      // when
      resourceLinking.processLinkResourcesArray(resource.entry, referenceLink, (err, badRequest, updated) => {
        // then
        t.error(err)
        t.error(badRequest)
        t.ok(updated)

        c.find({ id: { $in: ['1111111111', '2222222222', '3333333333', '4444444444'] } }).sort({id: 1}).toArray((err, results) => {
          t.error(err)

          t.equal(results[0].id, '1111111111', `should have a resource id of: 1111111111`)
          t.equal(results[0].link.length, 3, `should have a link total of: 3`)
          t.equal(results[1].id, '2222222222', `should have a resource id of: 2222222222`)
          t.equal(results[1].link.length, 1, `should have a link total of 1 - Link already exists`)
          t.equal(results[2].id, '3333333333', `should have a resource id of: 3333333333`)
          t.equal(results[2].link.length, 1, `should have a link total of: 1`)
          t.equal(results[3].id, '4444444444', `should have a resource id of: 4444444444`)
          t.notOk(results[3].link, 0, `should not have a link property`)

          done()
        })
      })
    })
  })
})
