 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const env = require('./test-env/init')()
const server = require('../lib/server')
const tap = require('tap')
const request = require('request')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const observation = {
  id: 11111,
  encounter: {
    reference: 'Encounter/22222'
  }
}

const basicObservationTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const c = db.collection('Observation')
      c.insertOne(observation, (err) => {
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
  })
}

tap.test('observation should support searches on encounter', (t) => {
  basicObservationTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Observation?encounter=22222',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.id, 11111)
      t.equal(body.entry[0].resource.encounter.reference, 'Encounter/22222')
      done()
    })
  })
})
