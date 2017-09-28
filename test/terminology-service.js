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

const valueSetSample1 = require('./resources/ValueSet-1.json')
const valueSetSample2 = require('./resources/ValueSet-2.json')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const TerminologyServiceTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createResource(t, valueSetSample1, 'ValueSet', () => {
        env.createResource(t, valueSetSample2, 'ValueSet', () => {
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
  })
}

tap.test('ValueSet should return an error when either system or code not supplied', (t) => {
  TerminologyServiceTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/ValueSet/$lookup?system=hearth:valueset:procedure-codes',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 400, 'response status code should be 400')
      t.ok(body)
      t.equals(body.resourceType, 'OperationOutcome', 'result should be a bundle')
      t.equals(body.issue.length, 1, 'should have 1 entry in the issues array')
      t.equals(body.issue[0].code, 'invalid', 'should have a code value of \'Invalid\'')
      t.equals(body.issue[0].details.text, 'Must specify \'system\' and \'code\' parameters', 'should have a code value of \'Must specify \'system\' and \'code\' parameters\'')

      done()
    })
  })
})

tap.test('ValueSet should support searches on system and code and return no results', (t) => {
  TerminologyServiceTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/ValueSet/$lookup?system=FakeSystem&code=0001',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      t.ok(body)
      t.equals(body.resourceType, 'OperationOutcome', 'result should be a bundle')
      t.equals(body.issue.length, 1, 'should have 1 entry in the issues array')
      t.equals(body.issue[0].code, 'not-found', 'should have a code value of \'not-found\'')
      t.equals(body.issue[0].details.text, 'Not found', 'should have a code value of \'Not found\'')

      done()
    })
  })
})

tap.test('ValueSet should support searches on system and code', (t) => {
  TerminologyServiceTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/ValueSet/$lookup?system=hearth:valueset:procedure-codes&code=0001',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Parameters', 'result should be a bundle')
      t.equal(body.parameter[0].valueString, '0001', 'should have a code value of \'0001\'')
      t.equal(body.parameter[1].valueString, 'Procedure 1', 'should have a code value of \'Procedure 1\'')

      done()
    })
  })
})
