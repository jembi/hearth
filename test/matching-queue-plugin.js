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

const env = require('./test-env/init')()
const server = require('../lib/server')
const constants = require('../lib/constants')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)
const locationResource = require('./resources/Location-1.json')

const testResourceTemplate = {
  'resourceType': 'Patient',
  'id': '1',
  'active': true,
  'identifier': [
    {
      'use': 'official',
      'system': 'pshr:passport:za',
      'value': '1001113333933',
      'assigner': {
        'display': 'Passport South Africa'
      }
    }
  ],
  'name': [
    {
      'use': 'official',
      'prefix': [
        'Mr'
      ],
      'family': [
        'Matinyana'
      ],
      'given': [
        'Charlton',
        'Joseph'
      ]
    }
  ],
  'gender': 'male',
  'birthDate': '1970-07-21'
}

let matchingQueuePlugin
let matchingQueuePluginTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    matchingQueuePlugin = require('../lib/plugins/matching-queue')(env.mongo())

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

tap.test('Matching Queue Plugin - should add the patient resource to the matching queue collection', (t) => {
  // given
  matchingQueuePluginTestEnv(t, (db, done) => {
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))

    // when
    matchingQueuePlugin.hooks.after[0].function('create', {}, 'Patient', resource, (err, badRequest) => {
      // then
      t.error(err)
      t.error(badRequest)

      let c = db.collection(constants.MATCHING_QUEUE_COLLECTION)
      c.findOne({}, (err, doc) => {
        t.error(err)

        t.equal(doc.payload.active, true, `should return a queued document with a status of: active`)
        t.equal(doc.payload.identifier[0].system, 'pshr:passport:za', `should return a queued document with a identifier system of: pshr:passport:za`)
        t.equal(doc.payload.identifier[0].value, '1001113333933', `should return a queued document with a identifier value of: 1001113333933`)
        t.equal(doc.payload.name[0].prefix[0], 'Mr', `should return a queued document with a name prefix of: Mr`)
        t.equal(doc.payload.name[0].given[0], 'Charlton', `should return a queued document with a given name of: Charlton`)
        t.equal(doc.payload.name[0].given[1], 'Joseph', `should return a queued document with a given name of: Joseph`)
        t.equal(doc.payload.name[0].family[0], 'Matinyana', `should return a queued document with a family name of: Matinyana`)
        t.equal(doc.payload.gender, 'male', `should return a queued document with a gender of: male`)
        t.equal(doc.payload.birthDate, '1970-07-21', `should return a queued document with a birthDate of: 1970-07-21`)

        done()
      })
    })
  })
})

tap.test('Matching Queue Plugin - should add the patient resource to the matching queue collection via create API request', (t) => {
  // given
  matchingQueuePluginTestEnv(t, (db, done) => {
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))
    delete resource.id

    // when
    request.post({
      url: 'http://localhost:3447/fhir/Patient',
      headers: headers,
      body: resource,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)
      t.ok(body)

      const patientId = res.headers.location.replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')

      let c = db.collection(constants.MATCHING_QUEUE_COLLECTION)
      c.findOne({ 'payload.id': patientId }, (err, doc) => {
        t.error(err)

        t.equal(doc.payload.active, true, `should return a queued document with a status of: active`)
        t.equal(doc.payload.identifier[0].system, 'pshr:passport:za', `should return a queued document with a identifier system of: pshr:passport:za`)
        t.equal(doc.payload.identifier[0].value, '1001113333933', `should return a queued document with a identifier value of: 1001113333933`)

        done()
      })
    })
  })
})

tap.test('Matching Queue Plugin - should add the patient resource to the matching queue collection via update API request', (t) => {
  // given
  matchingQueuePluginTestEnv(t, (db, done) => {
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))
    delete resource.id

    // save
    request.post({
      url: 'http://localhost:3447/fhir/Patient',
      headers: headers,
      body: resource,
      json: true
    }, (err, res, body) => {
      t.error(err)

      const id = res.headers.location.replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')
      const update = {
        resourceType: 'Patient',
        id: id,
        active: true,
        name: [
          {
            given: ['Update']
          }
        ]
      }

      // update
      request.put({
        url: `http://localhost:3447/fhir/Patient/${id}`,
        headers: headers,
        body: update,
        json: true
      }, (err, res) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')

        request({
          url: `http://localhost:3447/fhir/Patient/${id}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Patient', 'result should be a patient')
          t.equal(body.name[0].given[0], 'Update', 'body should contain the latest patient')

          let c = db.collection(constants.MATCHING_QUEUE_COLLECTION)
          c.find().toArray((err, results) => {
            t.error(err)

            t.equal(results.length, 2, `should return a results array with 2 resources`)
            t.equal(results[0].payload.active, true, `should return a queued document with a status of: active`)
            t.equal(results[0].payload.identifier[0].system, 'pshr:passport:za', `should return a queued document with a identifier system of: pshr:passport:za`)
            t.equal(results[0].payload.identifier[0].value, '1001113333933', `should return a queued document with a identifier value of: 1001113333933`)
            t.equal(results[0].payload.name[0].given[0], 'Charlton', `should return a queued document with a given name value of: Charlton`)
            t.equal(results[1].payload.name[0].given[0], 'Update', `should return a queued document with a given name value of: Update`)

            done()
          })
        })
      })
    })
  })
})

tap.test('Matching Queue Plugin - should return 400 if posted parameters resourceType is not allowed', (t) => {
  // given
  matchingQueuePluginTestEnv(t, (db, done) => {
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))

    // when
    request.post({
      url: 'http://localhost:3447/fhir/Procedure',
      headers: headers,
      body: resource,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)
      t.ok(body)

      t.equal(res.statusCode, 400, 'response status code should be 400')
      t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
      t.equal(body.issue[0].severity, 'error')
      t.equal(body.issue[0].code, 'invalid')
      t.equal(body.issue[0].details.text, 'Invalid resource type')

      done()
    })
  })
})

tap.test('Matching Queue Plugin - should add the location resource to the matching queue collection via create API request', (t) => {
  // given
  matchingQueuePluginTestEnv(t, (db, done) => {
    const resource = JSON.parse(JSON.stringify(locationResource))
    delete resource.id

    // when
    request.post({
      url: 'http://localhost:3447/fhir/Location',
      headers: headers,
      body: resource,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)
      t.ok(body)

      const locationId = res.headers.location.replace('/fhir/Location/', '').replace(/\/_history\/.*/, '')

      let c = db.collection(constants.MATCHING_QUEUE_COLLECTION)
      c.findOne({ 'payload.id': locationId }, (err, doc) => {
        t.error(err)

        t.equal(doc.payload.status, 'active', `should return a queued document with a status of: active`)
        t.equal(doc.payload.name, resource.name, `should return a queued document with a name of: ${resource.name}`)
        t.equal(doc.payload.position.longitude, resource.position.longitude, `should return a queued document with a longitude position of: ${resource.position.longitude}`)
        t.equal(doc.payload.position.latitude, resource.position.latitude, `should return a queued document with a latitude position of: ${resource.position.latitude}`)

        done()
      })
    })
  })
})
