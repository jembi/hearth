 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')

const env = require('./test-env/init')()
const server = require('../lib/server')
const _ = require('lodash')
const matchesArray = require('./resources/matching-resultset.json')
const constants = require('../lib/constants')

const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
emmarentia.link = [{ other: { reference: 'Patient/1111111111' }, type: constants.LINK_TYPE_CERTAIN_DUPLICATE_SOURCE }]
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

tap.test('Resource Linking - .addLinkToResource() - Should update a Patient resource with a matching link to a another patient', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const resource = _.cloneDeep(matchesArray)[0]
    const referenceLink = 'http://localhost:3447/fhir/Patient/12345678987654321'

    // when
    const doc = resourceLinking.addLinkToResource(resource, referenceLink, 'certain-duplicate-source', '0.95')

    t.equal(doc.link.length, 3, `should have a link total of: 3`)
    // newly added link at index 2
    t.equal(doc.link[2].type, 'certain-duplicate-source', `should have a link type of: certain-duplicate-source`)
    t.equal(doc.link[2].other.reference, referenceLink, `should have a reference link of: ${referenceLink}`)
    t.equals(doc.link[2].extension[0].url, 'http://hearth.org/link-matching-score', 'should add correct extension')
    t.equals(doc.link[2].extension[0].valueDecimal, '0.95', 'should add correct score')

    done()
  })
})

tap.test('Resource Linking - .addLinkToMatches() - Should update an array of Patient resources matches with a link to the patient that was the source of the match', (t) => {
  // given
  resourceLinkingTestEnv(t, (db, done) => {
    const testMatchesArray = _.cloneDeep(matchesArray)
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
      resourceLinking.addLinkToMatches(testMatchesArray, resource, (err) => {
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
    const testMatchesArray = _.cloneDeep(matchesArray)
    testMatchesArray[1]._mpi.search.extension.valueCode = 'certain'
    testMatchesArray[1]._mpi.search.score = 1
    testMatchesArray[2]._mpi.search.extension.valueCode = 'probable'
    testMatchesArray[2]._mpi.search.score = 0.85
    testMatchesArray[3]._mpi.search.extension.valueCode = 'possible'
    testMatchesArray[3]._mpi.search.score = 0.56

    const resource = testMatchesArray.shift()
    resource.link = []

    // when
    resourceLinking.addMatchesLinksToResource(testMatchesArray, resource, (err) => {
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

tap.test('Resource Linking - .removePreviousMatchingLinks() - Should remove all reference links to and from a resource on update', (t) => {
  resourceLinkingTestEnv(t, (db, done) => {
    const testResource = _.cloneDeep(charlton)
    testResource.link = [
      { other: { reference: 'Patient/2222222222' }, type: constants.LINK_TYPE_CERTAIN_DUPLICATE_OF },
      { other: { reference: 'leave me be' }, type: 'should exist' }
    ]

    const c = db.collection('Patient')
    c.findOne({ id: '2222222222' }, (err, result) => {
      t.error(err)

      t.equal(result.link[0].other.reference, 'Patient/1111111111', 'link should exist before test')

      resourceLinking.removePreviousMatchingLinks(testResource, (err, result) => {
        t.error(err)

        t.equal(result.link[0].other.reference, 'leave me be', 'links with no source should remain')
        t.equal(result.link.length, 1, 'Links that have sources should be removed')

        c.findOne({ id: '2222222222' }, (err, result) => {
          t.error(err)
          t.equal(result.link, null, 'source link should be removed by test')
          done()
        })
      })
    })
  })
})

tap.test('Resource Linking - .removePreviousMatchingLinks() - Should return the resource as is on create', (t) => {
  resourceLinkingTestEnv(t, (db, done) => {
    const testResource = _.cloneDeep(mwawi)
    testResource.link = [
      { other: { reference: 'Patient/2222222222' }, type: constants.LINK_TYPE_CERTAIN_DUPLICATE_OF },
      { other: { reference: 'leave me be' }, type: 'should exist' }
    ]

    const c = db.collection('Patient')
    c.findOne({ id: '2222222222' }, (err, result) => {
      t.error(err)

      t.equal(result.link[0].other.reference, 'Patient/1111111111', 'link should exist before test')

      resourceLinking.removePreviousMatchingLinks(testResource, (err, result) => {
        t.error(err)

        t.equal(result.link.length, 2, 'links with no source should remain')

        c.findOne({ id: '2222222222' }, (err, result) => {
          t.error(err)
          t.equal(result.link[0].other.reference, 'Patient/1111111111', 'link should exist after test')
          done()
        })
      })
    })
  })
})
