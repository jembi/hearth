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

const encounterTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const patients = env.testPatients()
      const pracs = env.testPractitioners()
      const orgs = env.testOrganizations()

      env.createOrganization(t, orgs.greenwood, () => {
        env.createOrganization(t, orgs.redwood, () => {
          env.createPractitioner(t, pracs.alison, orgs.greenwood, () => {
            env.createPractitioner(t, pracs.henry, orgs.redwood, () => {
              env.createPractitioner(t, pracs.edwino, orgs.redwood, () => {
                env.createPatientWithResources(t, patients.charlton, pracs.alison, pracs.henry, orgs.greenwood, () => {
                  env.createPatientWithResources(t, patients.emmarentia, pracs.edwino, pracs.henry, orgs.redwood, () => {
                    test(db, patients, pracs, orgs, () => {
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
        })
      })
    })
  })
}

tap.test('Encounter resource tests', { autoend: true }, (t) => {
  t.test('should support searches on practitioner organization', (t) => {
    encounterTestEnv(t, (db, patients, pracs, orgs, done) => {
      // search for all encounters under Greenwood (should match patient Charlton with encounter for Alison)
      request({
        url: `http://localhost:3447/fhir/Encounter?practitioner.organization=${orgs.greenwood.organization.id}`,
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.patient.reference, patients.charlton.resource, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return everything when no parameter are given', (t) => {
    encounterTestEnv(t, (db, patients, pracs, orgs, done) => {
      // search for all encounters
      request({
        url: 'http://localhost:3447/fhir/Encounter',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two result')
        done()
      })
    })
  })
})
