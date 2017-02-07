'use strict'
const tap = require('tap')
const request = require('request')
const _ = require('lodash')
const ObjectID = require('mongodb').ObjectID

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
      const transaction = _.cloneDeep(require('./resources/Transaction-success.json'))
      transaction.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
      transaction.entry[1].resource.id = pats.charlton.patient.id
      transaction.entry[2].request.url = `Patient/${pats.charlton.patient.id}`
      transaction.entry[3].request.url = `Patient/${pats.charlton.patient.id}/_history/1`
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
        t.equals(body.entry[3].resource.meta.versionId, '1', 'should return patient with correct version id on vread')
        t.equals(body.entry[4].response.status, '200', 'should return 200 for search')
        t.equals(body.entry[4].resource.type, 'searchset', 'should return a searchset for search')
        t.equals(body.entry[4].resource.entry.length, 1, 'should return correct search results')
        const c = db.collection('Patient')
        c.findOne({ _id: new ObjectID(body.entry[0].response.location.split('/')[3]) }, (err, result) => {
          t.error(err)
          t.ok(result, 'should have created a patient')
          c.findOne({ _id: new ObjectID(body.entry[1].response.location.split('/')[3]) }, (err, result) => {
            t.error(err)
            t.equals(result.latest.name[0].given[0], 'John', 'should have updated a patient correctly')
            t.equals(result.latest.name[0].family[0], 'Doe', 'should have updated a patient correctly')
            done()
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
        t.equals(res.statusCode, 404, 'should return a 404 status')
        t.equals(body.resourceType, 'OperationOutcome', 'should return an OperationOutcome of the failing request')
        const c = db.collection('Patient')
        c.findOne({ 'latest.name.given': 'Peter' }, (err, result) => {
          t.error(err)
          t.notOk(result, 'should have reverted the created patient')
          c.findOne({ 'latest.name.given': 'Charlton' }, (err, result) => {
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
        t.equals(body.entry[2].response.status, '404', 'should return 200 for read')
        t.equals(body.entry[3].response.status, '404', 'should return 200 for vread')
        t.equals(body.entry[4].response.status, '200', 'should return 200 for search')
        t.equals(body.entry[4].resource.type, 'searchset', 'should return a searchset for search')
        t.equals(body.entry[4].resource.entry.length, 1, 'should return correct search results')
        const c = db.collection('Patient')
        c.findOne({ _id: new ObjectID(body.entry[0].response.location.split('/')[3]) }, (err, result) => {
          t.error(err)
          t.ok(result, 'should have created a patient')
          c.findOne({ _id: new ObjectID(body.entry[1].response.location.split('/')[3]) }, (err, result) => {
            t.error(err)
            t.equals(result.latest.name[0].given[0], 'John', 'should have updated a patient correctly')
            t.equals(result.latest.name[0].family[0], 'Doe', 'should have updated a patient correctly')
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
      c.findOne({ _id: new ObjectID(body.entry[1].response.location.split('/')[3]) }, (err, result) => {
        t.error(err)
        t.equals(result.latest.patient.reference, `Patient/${body.entry[0].response.location.split('/')[3]}`, 'references should be resolved')
        done()
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
      t.equals(body.issue[0].details.text, 'Bundle.type must either be transaction or batch', 'should have correct details')
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
        t.equals(body.entry[2].response.status, '404', 'should return 404 for 2nd update')
        t.equals(body.entry[3].response.status, '200', 'should return 200 for read')
        t.equals(body.entry[3].resource.id, pats.charlton.patient.id, 'should return patient with correct id on get')
        done()
      })
    })
  })
})
