 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const tap = require('tap')
const request = require('request')
const _ = require('lodash')

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let testEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

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
}

tap.test('Transaction should process all entries correctly', (t) => {
  // given
  testEnv(t, (db, done) => {
    const pats = env.testPatients()
    env.createPatient(t, pats.charlton, () => {
      env.createPatient(t, pats.emmarentia, () => {
        const c = db.collection('Patient')
        const cHistory = db.collection('Patient_history')
        const emmarentiaId = pats.emmarentia.patient.id

        c.findOne({ id: emmarentiaId }, (err, doc) => {
          t.error(err)
          t.equal('' + doc.id, emmarentiaId, 'Ensure emmarentia exists before deletion')

          const transaction = _.cloneDeep(require('./resources/Transaction-success.json'))
          transaction.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
          transaction.entry[1].resource.id = pats.charlton.patient.id
          transaction.entry[2].request.url = `Patient/${pats.charlton.patient.id}`
          transaction.entry[3].request.url = `Patient/${pats.charlton.patient.id}/_history/${pats.charlton.patient.meta.versionId}`
          transaction.entry[5].request.url = `Patient/${emmarentiaId}`
          // when
          request({
            url: 'http://localhost:3447/fhir',
            method: 'POST',
            headers: headers,
            body: transaction,
            json: true
          }, (err, res, body) => {
            t.error(err)
            t.equals(res.statusCode, 200, 'should return a 200 status')
            t.equals(body.resourceType, 'Bundle', 'should return a Bundle')
            t.equals(body.entry[0].response.status, '201', 'should return 201 for create')
            t.ok(body.entry[0].response.location, 'should return the location')
            t.equals(body.entry[1].response.status, '200', 'should return 200 for update')
            t.ok(body.entry[1].response.location, 'should return the location')
            t.equals(body.entry[2].response.status, '200', 'should return 200 for read')
            t.equals(body.entry[2].resource.id, pats.charlton.patient.id, 'should return patient with correct id on read')
            t.equals(body.entry[3].response.status, '200', 'should return 200 for vread')
            t.equals(body.entry[3].resource.id, pats.charlton.patient.id, 'should return patient with correct id on vread')
            t.equals(body.entry[3].resource.meta.versionId, pats.charlton.patient.meta.versionId, 'should return patient with correct version id on vread')
            t.equals(body.entry[4].response.status, '200', 'should return 200 for search')
            t.equals(body.entry[4].resource.type, 'searchset', 'should return a searchset for search')
            t.equals(body.entry[4].resource.entry.length, 1, 'should return correct search results')
            t.equals(body.entry[5].response.status, '204', 'should delete resource')

            c.findOne({ id: body.entry[0].response.location.split('/')[3] }, (err, result) => {
              t.error(err)
              t.ok(result, 'should have created a patient')
              c.findOne({ id: body.entry[1].response.location.split('/')[3] }, (err, result) => {
                t.error(err)
                t.equals(result.name[0].given[0], 'John', 'should have updated a patient correctly')
                t.equals(result.name[0].family[0], 'Doe', 'should have updated a patient correctly')

                c.findOne({ id: emmarentiaId }, (err, doc) => {
                  t.error(err)
                  t.notOk(doc, 'Resource should be deleted')

                  cHistory.findOne({ id: emmarentiaId }, (err, doc) => {
                    t.error(err)
                    t.equal('' + doc.id, emmarentiaId, 'Deleted resource should appear in history')

                    done()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})

tap.test('Transaction should revert when an operation (excluding reads) fails', (t) => {
  // given
  testEnv(t, (db, done) => {
    const pats = env.testPatients()
    env.createPatient(t, pats.charlton, () => {
      const transaction = _.cloneDeep(require('./resources/Transaction-fail.json'))
      transaction.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
      transaction.entry[1].resource.id = pats.charlton.patient.id
      transaction.entry[3].request.url = `Patient/${pats.charlton.patient.id}`
      // when
      request({
        url: 'http://localhost:3447/fhir',
        method: 'POST',
        headers: headers,
        body: transaction,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 400, 'should return a 400 status')
        t.equals(body.resourceType, 'OperationOutcome', 'should return an OperationOutcome of the failing request')
        const c = db.collection('Patient')
        c.findOne({ 'name.given': 'Peter' }, (err, result) => {
          t.error(err)
          t.notOk(result, 'should have reverted the created patient')
          c.findOne({ 'name.given': 'Charlton' }, (err, result) => {
            t.error(err)
            t.ok(result, 'should have reverted the updated patient')
            done()
          })
        })
      })
    })
  })
})

tap.test('Transaction should pass even when reads fail', (t) => {
  // given
  testEnv(t, (db, done) => {
    const pats = env.testPatients()
    env.createPatient(t, pats.charlton, () => {
      const transaction = _.cloneDeep(require('./resources/Transaction-success.json'))
      transaction.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
      transaction.entry[1].resource.id = pats.charlton.patient.id
      // the read and vread references are not updates so they point to non-existent patients
      // when
      request({
        url: 'http://localhost:3447/fhir',
        method: 'POST',
        headers: headers,
        body: transaction,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 200, 'should return a 200 status')
        t.equals(body.resourceType, 'Bundle', 'should return a Bundle')
        t.equals(body.entry[0].response.status, '201', 'should return 201 for create')
        t.ok(body.entry[0].response.location, 'should return the location')
        t.equals(body.entry[1].response.status, '200', 'should return 200 for update')
        t.ok(body.entry[1].response.location, 'should return the location')
        t.equals(body.entry[2].response.status, '404', 'should return 404 for read')
        t.equals(body.entry[3].response.status, '404', 'should return 404 for vread')
        t.equals(body.entry[4].response.status, '200', 'should return 200 for search')
        t.equals(body.entry[4].resource.type, 'searchset', 'should return a searchset for search')
        t.equals(body.entry[4].resource.entry.length, 1, 'should return correct search results')
        t.equals(body.entry[5].response.status, '204', 'should return 204 for not found delete')
        const c = db.collection('Patient')
        c.findOne({ id: body.entry[0].response.location.split('/')[3] }, (err, result) => {
          t.error(err)
          t.ok(result, 'should have created a patient')
          c.findOne({ id: body.entry[1].response.location.split('/')[3] }, (err, result) => {
            t.error(err)
            t.equals(result.name[0].given[0], 'John', 'should have updated a patient correctly')
            t.equals(result.name[0].family[0], 'Doe', 'should have updated a patient correctly')
            done()
          })
        })
      })
    })
  })
})

tap.test('Transaction should resolve references correctly when processing a transaction', (t) => {
  // given
  testEnv(t, (db, done) => {
    // when
    request({
      url: 'http://localhost:3447/fhir',
      method: 'POST',
      headers: headers,
      body: _.cloneDeep(require('./resources/Transaction-reference.json')),
      json: true
    }, (err, res, body) => {
      t.error(err)
      t.equals(res.statusCode, 200, 'should return a 200 status')
      const c = db.collection('Encounter')
      c.findOne({ id: body.entry[1].response.location.split('/')[3] }, (err, result) => {
        t.error(err)
        t.equals(result.patient.reference, `Patient/${body.entry[0].response.location.split('/')[3]}`, 'references should be resolved')
        done()
      })
    })
  })
})

tap.test('Transaction should resolve references correctly when processing a transaction containing a resource that get\'s updated', (t) => {
  // given
  testEnv(t, (db, done) => {
    env.createResource(t, require('./resources/Transaction-reference.json').entry[0].resource, 'Patient', (err, ref) => {
      t.error(err)
      // when
      const body = _.cloneDeep(require('./resources/Transaction-reference.json'))
      body.entry[0].resource.id = ref.split('/')[1]
      body.entry[0].request.method = 'PUT'
      body.entry[0].request.url += `/${body.entry[0].resource.id}`
      request({
        url: 'http://localhost:3447/fhir',
        method: 'POST',
        headers: headers,
        body: body,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 200, 'should return a 200 status')
        const c = db.collection('Encounter')
        c.findOne({ id: body.entry[1].response.location.split('/')[3] }, (err, result) => {
          t.error(err)
          t.equals(result.patient.reference, `Patient/${body.entry[0].response.location.split('/')[3]}`, 'references should be resolved')
          done()
        })
      })
    })
  })
})

tap.test('Transaction should return a 400 when the bundle type is incorrect', (t) => {
  // given
  testEnv(t, (db, done) => {
    const tx = require('./resources/Transaction-reference.json')
    tx.type = 'Box'
    // when
    request({
      url: 'http://localhost:3447/fhir',
      method: 'POST',
      headers: headers,
      body: _.cloneDeep(tx),
      json: true
    }, (err, res, body) => {
      t.error(err)
      t.equals(res.statusCode, 400, 'should return a 400 status')
      t.equals(body.issue[0].details.text, 'Bundle.type must either be transaction, batch or document', 'should have correct details')
      done()
    })
  })
})

tap.test('Batch should succeed even when an operation fails', (t) => {
  // given
  testEnv(t, (db, done) => {
    const pats = env.testPatients()
    env.createPatient(t, pats.charlton, () => {
      const batch = _.cloneDeep(require('./resources/Transaction-fail.json'))
      batch.type = 'batch'
      batch.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
      batch.entry[1].resource.id = pats.charlton.patient.id
      batch.entry[3].request.url = `Patient/${pats.charlton.patient.id}`
      // when
      request({
        url: 'http://localhost:3447/fhir',
        method: 'POST',
        headers: headers,
        body: batch,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 200, 'should return a 200 status')
        t.equals(body.resourceType, 'Bundle', 'should return a Bundle')
        t.equals(body.entry[0].response.status, '201', 'should return 201 for create')
        t.ok(body.entry[0].response.location, 'should return the location')
        t.equals(body.entry[1].response.status, '200', 'should return 200 for update')
        t.ok(body.entry[1].response.location, 'should return the location')
        t.equals(body.entry[2].response.status, '400', 'should return 400 for 2nd update')
        t.equals(body.entry[3].response.status, '200', 'should return 200 for read')
        t.equals(body.entry[3].resource.id, pats.charlton.patient.id, 'should return patient with correct id on get')
        t.equals(body.entry[4].response.status, '204', 'should return 204 for not found delete')
        done()
      })
    })
  })
})

tap.test('Transaction should revert delete operation when operation (other than read) fails', (t) => {
  // given
  testEnv(t, (db, done) => {
    const pats = env.testPatients()
    env.createPatient(t, pats.emmarentia, () => {
      const idToDelete = pats.emmarentia.patient.id

      const c = db.collection('Patient')
      c.findOne({ id: idToDelete }, (err, result) => {
        t.error(err)
        t.equal('' + result.id, idToDelete, 'Patient should be created')

        const transaction = _.cloneDeep(require('./resources/Transaction-fail.json'))
        transaction.entry[4].request.url = `Patient/${pats.emmarentia.patient.id}`

        // when
        request({
          url: 'http://localhost:3447/fhir',
          method: 'POST',
          headers: headers,
          body: transaction,
          json: true
        }, (err, res, body) => {
          t.error(err)
          t.equals(res.statusCode, 400, 'should return a 400 status')
          t.equals(body.resourceType, 'OperationOutcome', 'should return an OperationOutcome of the failing request')

          c.findOne({ id: idToDelete }, (err, result) => {
            t.error(err)
            t.equal('' + result.id, idToDelete, 'should have reverted the deleted patient')

            done()
          })
        })
      })
    })
  })
})

tap.test('Document bundles should get processed successfully', (t) => {
  // given
  testEnv(t, (db, done) => {
    const doc = _.cloneDeep(require('./resources/FHIR-Document.json'))

    // when
    request({
      url: 'http://localhost:3447/fhir',
      method: 'POST',
      headers: headers,
      body: doc,
      json: true
    }, (err, res, body) => {
      t.error(err)
      t.equals(res.statusCode, 200, 'should return a 200 status')

      const comp = db.collection('Composition')
      const obs = db.collection('Observation')
      const meds = db.collection('MedicationOrder')

      comp.count((err, count) => {
        t.error(err)
        t.equals(count, 1)
        obs.count((err, count) => {
          t.error(err)
          t.equals(count, 4)
          meds.count((err, count) => {
            t.error(err)
            t.equals(count, 1)
            done()
          })
        })
      })
    })
  })
})

tap.test('Document bundles should get processed successfully even when a resource need to be updated', (t) => {
  // given
  testEnv(t, (db, done) => {
    const doc = _.cloneDeep(require('./resources/FHIR-Document.json'))
    const obs = doc.entry[1].resource
    env.createResource(t, obs, 'Observation', (err, ref) => {
      t.error(err)
      doc.entry[1].resource.id = ref.replace('Observation/', '')
      obs.status = 'ammended'

      // when
      request({
        url: 'http://localhost:3447/fhir',
        method: 'POST',
        headers: headers,
        body: doc,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equals(res.statusCode, 200, 'should return a 200 status')

        const comp = db.collection('Composition')
        const obs = db.collection('Observation')
        const meds = db.collection('MedicationOrder')

        comp.count((err, count) => {
          t.error(err)
          t.equals(count, 1)
          obs.count((err, count) => {
            t.error(err)
            t.equals(count, 4)
            meds.count((err, count) => {
              t.error(err)
              t.equals(count, 1)
              obs.findOne({ status: 'ammended' }, (err, result) => {
                t.error(err)
                t.ok(result)
                t.equals(result.status, 'ammended')
              })
              done()
            })
          })
        })
      })
    })
  })
})
