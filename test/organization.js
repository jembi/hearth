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

const basicOrganizationTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const orgs = env.testOrganizations()

      env.createOrganization(t, orgs.greenwood, () => {
        env.createOrganization(t, orgs.redwood, () => {
          env.createOrganization(t, orgs.goodhealth, () => {
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
  })
}

tap.test('organization fetch all organizations', (t) => {
  basicOrganizationTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Organization',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 3, 'body should contain 3 results')
      t.equal(body.entry[0].resource.identifier[0].value, '123456', 'body should contain the matching patient')
      t.equal(body.entry[1].resource.identifier[0].value, '987654321', 'body should contain the matching patient')
      t.equal(body.entry[2].resource.identifier[0].value, '543219876', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('organization should support searches on identifier', (t) => {
  basicOrganizationTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Organization?identifier=543219876',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '543219876', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('patient should support searches on identifier with a system specified', (t) => {
  basicOrganizationTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Organization?identifier=pshr:practice:number|543219876',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '543219876', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('patient should support searches with a _summary flag', (t) => {
  basicOrganizationTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Organization?_summary=true',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)

      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 3, 'body should contain 3 results')
      t.equal(body.entry[0].resource.meta.security[0].code, 'SUBSETTED')
      t.equal(body.entry[2].resource.identifier[0].value, '543219876')

      t.notOk(body.entry[0].resource.telecom)
      t.notOk(body.entry[0].resource.address)
      t.notOk(body.entry[0].resource.extension)
      done()
    })
  })
})
