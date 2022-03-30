/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const env = require('../test-env/init')()
const server = require('../../lib/server')
const tap = require('tap')
const request = require('request')
const querystring = require('querystring')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const basicPDQmTest = (t, test) => {
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

tap.test('PDQm Query parameters: ', { autoend: true }, (t) => {
  t.test('Should respond with 200 when all valid query parameters supplied for the IHE PDQm Profile', (t) => {
    // Given
    basicPDQmTest(t, (db, done) => {
      const queryParams = {}
      queryParams._id = 'randomvalue'
      queryParams.active = 'randomvalue'
      queryParams.identifier = 'randomvalue'
      queryParams.family = 'randomvalue'
      queryParams.given = 'randomvalue'
      queryParams.telecom = 'randomvalue'
      queryParams.birthdate = 'randomvalue'
      queryParams.address = 'randomvalue'
      queryParams['address-city'] = 'randomvalue'
      queryParams['address-country'] = 'randomvalue'
      queryParams['address-postalcode'] = 'randomvalue'
      queryParams['address-state'] = 'randomvalue'
      queryParams.gender = 'randomvalue'

      request({
        url: `http://localhost:3447/fhir/Patient?${querystring.stringify(queryParams)}`,
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')

        done()
      })
    })
  })

  t.test('Should respond with 400 when invalid query parameters supplied for the IHE PDQm Profile', (t) => {
    // Given
    basicPDQmTest(t, (db, done) => {
      const queryParams = {}
      queryParams.unsupportedQueryParam = 'randomvalue'

      request({
        url: `http://localhost:3447/fhir/Patient?${querystring.stringify(queryParams)}`,
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 400, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'OperationOutcome', 'result should be a OperationOutcome')
        t.equals(body.issue[0].severity, 'error')
        t.equals(body.issue[0].code, 'invalid')
        t.equals(body.issue[0].details.text, 'This endpoint does not support the query parameter: unsupportedQueryParam')

        done()
      })
    })
  })
})
