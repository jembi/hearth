'use strict'

const tap = require('tap')

const env = require('./test-env/init')()
const server = require('../lib/server')
const _ = require('lodash')
const matchingResultSet = require('./resources/matching-resultset.json')
const constants = require('../lib/constants')

const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
emmarentia.link = [{ 'other': { 'reference': 'Patient/1111111111' }, 'type': constants.LINK_TYPE_CERTAIN_DUPLICATE_SOURCE }]
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

tap.test('Resource Linking - .linkResource() - Should update a Patient resource with a matching link to a another patient', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const resource = _.cloneDeep(matchingResultSet).entry[0].resource
    const referenceLink = 'http://localhost:3447/fhir/Patient/12345678987654321'

    // when
    const doc = resourceLinking.linkResource(resource, referenceLink, 'certain-duplicate-source', '0.95')

    t.equal(doc.link.length, 3, `should have a link total of: 3`)
    // newly added link at index 2
    t.equal(doc.link[2].type, 'certain-duplicate-source', `should have a link type of: certain-duplicate-source`)
    t.equal(doc.link[2].other.reference, referenceLink, `should have a reference link of: ${referenceLink}`)
    t.equals(doc.link[2].extension[0].url, 'http://hearth.org/link-matching-score', 'should add correct extension')
    t.equals(doc.link[2].extension[0].valueDecimal, '0.95', 'should add correct score')

    done()
  })
})

tap.test('Resource Linking - .addLinkReferenceToMatches() - Should update an array of Patient resources matches with a link to the patient that was the source of the match', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const bundle = _.cloneDeep(matchingResultSet)
    // const referenceLink = 'http://localhost:3447/fhir/Patient/12345678987654321'
    const resource = charlton

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
      resourceLinking.addLinkReferenceToMatches(bundle.entry, resource, (err) => {
        // then
        t.error(err)

        c.find({ id: { $in: ['1111111111', '2222222222', '3333333333', '4444444444'] } }).sort({id: 1}).toArray((err, results) => {
          t.error(err)

          t.equal(results[0].id, '1111111111', `should have a resource id of: 1111111111`)
          t.equal(results[0].link.length, 3, `should have a link total of: 3`)
          t.equal(results[0].link[2].type, 'certain-duplicate-source', `should have a link type of: certain-duplicate-source`)
          t.equal(results[1].id, '2222222222', `should have a resource id of: 2222222222`)
          t.equal(results[1].link.length, 1, `should have a link total of 1 - Link already exists`)
          t.equal(results[2].id, '3333333333', `should have a resource id of: 3333333333`)
          t.equal(results[2].link.length, 1, `should have a link total of: 1`)
          t.equal(results[2].link[0].type, 'probable-duplicate-source', `should have a link type of: probable-duplicate-source`)
          t.equal(results[3].id, '4444444444', `should have a resource id of: 4444444444`)
          t.notOk(results[3].link, 0, `should not have a link property`)

          done()
        })
      })
    })
  })
})

tap.test('Resource Linking - .addMatchesLinksToResource() - Should update a Patient resource with link to matching patient resources', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const bundle = _.cloneDeep(matchingResultSet)
    bundle.entry[1].search.extension.valueCode = 'certain'
    bundle.entry[1].search.score = 1
    bundle.entry[2].search.extension.valueCode = 'probable'
    bundle.entry[2].search.score = 0.85
    bundle.entry[3].search.extension.valueCode = 'possible'
    bundle.entry[3].search.score = 0.56

    const resource = bundle.entry.shift().resource
    resource.link = []

    // when
    resourceLinking.addMatchesLinksToResource(bundle.entry, resource, (err) => {
      t.error(err)

      // then
      let c = db.collection('Patient')
      c.findOne({ id: resource.id }, (err, resource) => {
        t.error(err)

        t.deepEquals(resource.link[0], {
          other: {
            reference: 'Patient/2222222222'
          },
          type: 'certain-duplicate-of',
          extension: [{
            url: 'http://hearth.org/link-matching-score',
            valueDecimal: 1
          }]
        })

        t.deepEquals(resource.link[1], {
          other: {
            reference: 'Patient/3333333333'
          },
          type: 'probable-duplicate-of',
          extension: [{
            url: 'http://hearth.org/link-matching-score',
            valueDecimal: 0.85
          }]
        })

        t.deepEquals(resource.link[2], {
          other: {
            reference: 'Patient/4444444444'
          },
          type: 'possible-duplicate-of',
          extension: [{
            url: 'http://hearth.org/link-matching-score',
            valueDecimal: 0.56
          }]
        })

        done()
      })
    })
  })
})
