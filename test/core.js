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
const testPatients = env.testPatients()

const basicCoreTest = (t, test) => {
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

const requestAndAssertResponseOperationOutcome = (tp, t, done) => {
  // When
  request({
    url: `http://localhost:3447/fhir/Patient/${tp.id}`,
    headers: headers,
    json: true
  }, (err, res, body) => {
    // Then
    t.error(err)
    t.equal(res.statusCode, tp.statusCode, 'response status should match')

    t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
    t.equal(body.issue[0].severity, tp.expectedResponse.severity)
    t.equal(body.issue[0].code, tp.expectedResponse.code)
    t.equal(body.issue[0].details.text, tp.expectedResponse.details)
    done()
  })
}

tap.test('Core', { autoend: true }, (t) => {
  t.test('Read function', { autoend: true }, (t) => {
    t.test('should return 404 - not found when non existent patient is read', (t) => {
      basicCoreTest(t, (db, done) => {
        const expectedResponse = {
          severity: 'information',
          code: 'not-found',
          details: 'Not found'
        }

        const testParams = {
          id: 'non-existent-id',
          expectedResponse: expectedResponse,
          statusCode: 404
        }

        requestAndAssertResponseOperationOutcome(testParams, t, done)
      })
    })

    t.test('should return 410 - gone when a deleted patient is read', (t) => {
      const id = '1111111111'
      basicCoreTest(t, (db, done) => {
        const charlton = testPatients.charlton.patient
        charlton.id = id
        const cHistory = db.collection('Patient_history')
        cHistory.insertOne(charlton, (err, doc) => {
          t.error(err)
          t.ok(doc)

          const expectedResponse = {
            severity: 'information',
            code: 'gone',
            details: 'Gone'
          }

          const testParams = {
            id: id,
            expectedResponse: expectedResponse,
            statusCode: 410
          }

          requestAndAssertResponseOperationOutcome(testParams, t, done)
        })
      })
    })
  })

  t.test('Delete function', { autoend: true }, (t) => {
    t.test('should return 204 - no content when a patient is deleted', (t) => {
      const id = '1111111111'
      basicCoreTest(t, (db, done) => {
        const charlton = testPatients.charlton.patient
        charlton.id = id

        const c = db.collection('Patient')
        c.insertOne(charlton, (err, doc) => {
          t.error(err)

          request({
            url: `http://localhost:3447/fhir/Patient/${id}`,
            method: 'DELETE',
            headers: headers,
            json: true
          }, (err, res, body) => {
            t.error(err)
            t.equal(res.statusCode, 204)

            c.findOne({ id: id }, (err, doc) => {
              t.error(err)
              t.notOk(doc)

              const cHistory = db.collection('Patient_history')
              cHistory.findOne({ id: id }, (err, doc) => {
                t.error(err)
                t.ok(doc)
                t.equal(doc.id, id, 'Deleted doc should exist in history')

                done()
              })
            })
          })
        })
      })
    })

    t.test('should return 204 - no content when a non existent patient is deleted', (t) => {
      basicCoreTest(t, (db, done) => {
        request({
          url: `http://localhost:3447/fhir/Patient/non-existent-id`,
          method: 'DELETE',
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)
          t.equal(res.statusCode, 204)

          done()
        })
      })
    })
  })

  t.test('Match function', { autoend: true }, (t) => {
    const matchOperationBodyTemplate = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'resource',
          resource: {
            resourceType: 'Binary'
          }
        }, {
          name: 'count',
          valueInteger: 100
        }
      ]
    }

    t.test('should return 400 if posted parameters resourceType is not of type Parameters', (t) => {
      // Given
      const testBody = Object.assign({}, matchOperationBodyTemplate)
      testBody.resourceType = 'Patient'
      basicCoreTest(t, (db, done) => {
        // When
        request({
          url: `http://localhost:3447/fhir/Patient/$match`,
          method: 'POST',
          body: testBody,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(res.statusCode, 400, 'response status code should be 400')
          t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
          t.equal(body.issue[0].severity, 'error')
          t.equal(body.issue[0].code, 'invalid')
          t.equal(body.issue[0].details.text, 'Expected Parameters resource type')
          done()
        })
      })
    })

    t.test('should return 400 if posted parameters resource has an unexpected parameter', (t) => {
      // Given
      const testBody = Object.assign({}, matchOperationBodyTemplate)
      testBody.parameter = testBody.parameter.concat([{ name: 'shouldNotExist' }])
      basicCoreTest(t, (db, done) => {
        // When
        request({
          url: `http://localhost:3447/fhir/Patient/$match`,
          method: 'POST',
          body: testBody,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(res.statusCode, 400, 'response status code should be 400')
          t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
          t.equal(body.issue[0].severity, 'error')
          t.equal(body.issue[0].code, 'invalid')
          t.equal(body.issue[0].details.text, 'Unexpected query parameter: shouldNotExist')
          done()
        })
      })
    })

    t.test('should return 400 if posted parameters resource no resource parameter', (t) => {
      // Given
      const testBody = Object.assign({}, matchOperationBodyTemplate)
      testBody.parameter = testBody.parameter.slice(1)
      basicCoreTest(t, (db, done) => {
        // When
        request({
          url: `http://localhost:3447/fhir/Patient/$match`,
          method: 'POST',
          body: testBody,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(res.statusCode, 400, 'response status code should be 400')
          t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
          t.equal(body.issue[0].severity, 'error')
          t.equal(body.issue[0].code, 'invalid')
          t.equal(body.issue[0].details.text, 'No resource parameter in parameters resource')
          done()
        })
      })
    })

    t.test('should return 400 if posted parameters resourceType does not match url resourceType', (t) => {
      // Given
      const testBody = Object.assign({}, matchOperationBodyTemplate)
      basicCoreTest(t, (db, done) => {
        // When
        request({
          url: `http://localhost:3447/fhir/Patient/$match`,
          method: 'POST',
          body: testBody,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(res.statusCode, 400, 'response status code should be 400')
          t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
          t.equal(body.issue[0].severity, 'error')
          t.equal(body.issue[0].code, 'invalid')
          t.equal(body.issue[0].details.text, 'Invalid resource type')
          done()
        })
      })
    })

    t.test('should return 400 if posted parameters resource resourceType does not have matching config', (t) => {
      // Given
      const testBody = Object.assign({}, matchOperationBodyTemplate)
      basicCoreTest(t, (db, done) => {
        // When
        request({
          url: `http://localhost:3447/fhir/Binary/$match`,
          method: 'POST',
          body: testBody,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(res.statusCode, 400, 'response status code should be 400')
          t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
          t.equal(body.issue[0].severity, 'error')
          t.equal(body.issue[0].code, 'invalid')
          t.equal(body.issue[0].details.text, 'Match operation not supported on resource type')
          done()
        })
      })
    })
  })
})
