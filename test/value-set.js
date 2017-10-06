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

const basicValueSetTest = (t, test) => {
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

tap.test('ValueSet Resource', { autoend: true }, (t) => {
  t.test('should return ValueSets matching the url parameter', (t) => {
    const valueSet = {
      resourceType: 'ValueSet',
      active: true,
      codeSystem: {
        system: 'hearth:sssa:procedure-codes',
        caseSensitive: true,
        concept: [
          {
            code: '00100',
            display: 'Anaesthesia for procedures on salivary glands, including biopsy'
          },
          {
            code: '00102',
            display: 'Anaesthesia for procedures involving plastic repair of cleft lip'
          },
          {
            code: '00103',
            display: 'Anaesthesia for reconstructive procedures of eyelid (eg., blepharoplasty, ptosis surgery)'
          },
          {
            code: '00104',
            display: 'Anaesthesia for electroconvulsive therapy'
          },
          {
            code: '00120',
            display: 'Anaesthesia for procedures on external, middle, and inner ear including biopsy; not otherwise specified'
          }
        ]
      }
    }

    basicValueSetTest(t, (db, done) => {
      env.createResource(t, valueSet, 'ValueSet', (err, ref) => {
        t.error(err)

        request({
          url: 'http://localhost:3447/fhir/ValueSet?url=hearth:sssa:procedure-codes',
          headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
          t.equal(body.total, 1, 'body should contain one result')
          t.equals(body.entry[0].resource.codeSystem.system, 'hearth:sssa:procedure-codes')

          done()
        })
      })
    })
  })

  t.test('should return no ValueSets if the url doesn\'t match', (t) => {
    basicValueSetTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/ValueSet?url=hearth:sssa:procedure-codes',
        headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain no result')

        done()
      })
    })
  })
})
