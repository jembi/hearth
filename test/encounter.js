/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict'
const env = require('./test-env/init')()
const server = require('../lib/server')
const tap = require('tap')
const request = require('request')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let encounterTestEnv = (t, test) => {
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

tap.test('encounter should support searches on practitioner organization', (t) => {
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
