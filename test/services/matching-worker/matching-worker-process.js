 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')
const env = require('../../test-env/init')()
const server = require('../../../lib/server')

const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
const nikita = testPatients.nikita.patient
nikita.id = '3333333333'
const mwawi = testPatients.mwawi.patient
mwawi.id = '4444444444'

const matchingWorkerProcessTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

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

const queryResource = {
  resourceType: 'Patient',
  name: [
    {
      family: [
        'Matinyana'
      ]
    }
  ]
}

const workerContext = {
  workerName: 'mpi_query',
  resourceType: 'Patient',
  queryResource: JSON.stringify(queryResource),
  path: 'name.family',
  algorithm: 'levenshtein',
  weight: 0.25
}

process.argv[2] = JSON.stringify(workerContext)
const matchingWorkerProcess = require('../../../lib/fhir/services/matching-worker/matching-worker-process')

tap.test('should execute processResourceScore() and return a object', (t) => {
  let matchesMap = {}
  const charltonTemp = {}
  charltonTemp.id = charlton.id
  charltonTemp.name = charlton.name

  matchingWorkerProcess.processResourceScore(matchesMap, charltonTemp)
  t.ok(matchesMap[charltonTemp.id])
  t.equal(matchesMap[charltonTemp.id].name[0].given[0], 'Charlton', 'name should have a value of: Charlton')
  t.equal(matchesMap[charltonTemp.id]._mpi.score, 0.25, 'should have a score value of: 0.25')

  const emmarentiaTemp = {}
  emmarentiaTemp.id = emmarentia.id
  emmarentiaTemp.name = emmarentia.name

  matchingWorkerProcess.processResourceScore(matchesMap, emmarentiaTemp)
  t.ok(matchesMap[emmarentiaTemp.id])
  t.equal(matchesMap[emmarentiaTemp.id].name[0].given[0], 'Emmarentia', 'name should have a value of: Emmarentia')
  t.equal(matchesMap[emmarentiaTemp.id]._mpi.score, 0, 'should have a score value of: 0')

  t.end()
})

tap.test('should execute mpiQuery() to fetch all records and return a matchesMap object', (t) => {
  matchingWorkerProcessTest(t, (db, done) => {
    const c = db.collection('Patient')
    const query = {}

    // when
    matchingWorkerProcess.mpiQuery(c, query, (err, results) => {
      t.error(err)
      t.ok(results)

      t.notOk(results[charlton.id].name[0].given, 'should not have the given name returned, projection added')

      t.equal(results[charlton.id].name[0].family[0], 'Matinyana', 'should have a name value of: Matinyana')
      t.equal(results[charlton.id]._mpi.score, 0.25, 'should have a score value of: 0.25')

      t.equal(results[emmarentia.id].name[0].family[0], 'Cook', 'should have a name value of: Cook')
      t.equal(results[emmarentia.id]._mpi.score, 0, 'should have a score value of: 0')

      t.equal(results[nikita.id].name[0].family[0], 'Sekhotla', 'should have a name value of: Sekhotla')
      t.equal(results[nikita.id]._mpi.score, 0.027777777777777776, 'should have a score value of: 0.027777777777777776')

      t.equal(results[mwawi.id].name[0].family[0], 'Ntshwanti', 'should have a name value of: Ntshwanti')
      t.equal(results[mwawi.id]._mpi.score, 0.05555555555555555, 'should have a score value of: 0.05555555555555555')

      done()
    })
  })
})
