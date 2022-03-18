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
const _ = require('lodash')
const config = require('../lib/config')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const basicPatientTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createPatient(t, env.testPatients().charlton, () => {
        env.createPatient(t, env.testPatients().emmarentia, () => { // use emmarentia for filtering
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

tap.test('Query Param - active: ', { autoend: true }, (t) => {
  t.test('patient should support searches on the "active" property and return no results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?active=false',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain 0 results')
        done()
      })
    })
  })

  t.test('patient should support searches on the "active" property and return found results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?active=true',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, '1007211152222', 'body should contain the matching patient')
        done()
      })
    })
  })
})

tap.test('Query Param - address: ', { autoend: true }, (t) => {
  t.test('should return 200 and bundle of patients when patient address matches address query parameter', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address=2760%20Mlosi',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient address matches address query parameter exactly', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address:exact=2760%20Mlosi%20Street',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient address matches multiple address query parameters', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address=2760&address=Western%20Cape&address:exact=Kraaifontein',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of no patients when patient address doesnt match address query parameters', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address=1st&address=Eastern Cape&address:exact=Block 1',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain 0 results')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient address matches address query parameters', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address=Kraaifontein&address=Western Cape',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })
})

tap.test('Query Param - address-city: ', { autoend: true }, (t) => {
  t.test('patient should support searches by city', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-city=Cape%20Town',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].city, 'Cape Town', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support searches by city with no results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-city=Durban',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain 0 results')
        done()
      })
    })
  })
})

tap.test('Query Param - address-country: ', { autoend: true }, (t) => {
  t.test('patient should support searches by country', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-country=South%20Africa',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].country, 'South Africa', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support searches by country with no results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-country=USA',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain 0 results')
        done()
      })
    })
  })
})

tap.test('Query Param - address-postalcode: ', { autoend: true }, (t) => {
  t.test('patient should support searches by postalcode', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-postalcode=7570',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].postalCode, '7570', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support searches by postalcode with no results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-postalcode=1122',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain 0 results')
        done()
      })
    })
  })
})

tap.test('Query Param - address-state: ', { autoend: true }, (t) => {
  t.test('patient should support searches by state', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state=Western%20Cape',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].state, 'Western Cape', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support searches by state with no results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state=KwaZulu-Natal',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain 0 results')
        done()
      })
    })
  })
})

tap.test('Query Param - address - strings/startsWith/exact: ', { autoend: true }, (t) => {
  t.test('patient should support contains searches on strings', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state:contains=Cape',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].state, 'Western Cape', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support case insensitve searches on strings by default', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state=western%20cape',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].state, 'Western Cape', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support startswith searches on strings by default', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state=Western',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].state, 'Western Cape', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support exact searches on strings', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state:exact=Western%20Cape',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.address[0].state, 'Western Cape', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should return no results when match isnt exact', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?address-state:exact=Western%20Cap',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain two results')
        done()
      })
    })
  })
})

tap.test('Query Param - birthdate: ', { autoend: true }, (t) => {
  t.test('should return 200 and bundle of patients when patient birthdate matches date birthdate query parameter - No operator supplied, defaults to equals', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=1970-07-21',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate matches date birthdate query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=eq1970-07-21',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate matches year birthdate query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=eq1970',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate matches month birthdate query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=eq1970-07',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two results')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate does not match date birthdate query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=ne1970-07-21',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate matches multiple birthdate query parameters', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=eq1970&birthdate=ne1970-07-30',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate matches multiple date birthdate query parameters', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=ge1970-01&birthdate=le1970-10-25',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain two result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate less-than/equal date birthdate query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=le1970-07-25',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient birthdate greater/equal date birthdate query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?birthdate=ge1970-07-25',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })
})

tap.test('Query Param - family: ', { autoend: true }, (t) => {
  t.test('patient should support basic family name searches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?family=Matinyana',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support basic family name searches and return no results', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?family=doesntexist',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when exact match operator', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?family:exact=Cook',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when multiple patient family names match multiple family query parameter', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?family=Cook&family=Spray',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })
})

tap.test('Query Param - Gender: ', { autoend: true }, (t) => {
  t.test('patient should support basic gender searches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?gender=male',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support basic gender searches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?gender=unknown',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero result')
        done()
      })
    })
  })
})

tap.test('Query Param - given: ', { autoend: true }, (t) => {
  t.test('patient should support basic given name searches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?given=Charlton',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('name searches should be case-insensitive', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?given=charlton',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('name searches should match the first part of the string', (t) => {
    basicPatientTest(t, (db, done) => {
      // search for 'cha' should match 'Charlton'
      request({
        url: 'http://localhost:3447/fhir/Patient?given=cha',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when multiple patient given names match multiple given query parameter', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?given=Charlton&given=Joseph',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })
})

tap.test('Query Param - identifier: ', { autoend: true }, (t) => {
  t.test('patient should support searches on identifier', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should support searches on identifier with a system specified', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=pshr:sanid|1007211154902',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('patient should respond with en empty searchset if no matches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=NOTTHERE',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient identifier matches multiple full identifier token query parameters', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=pshr:sanid|1007211154902&identifier=pshr:passport:za|1001113333933',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient identifier matches full identifier token query parameter where system property is not defined', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=|no-system-identifier',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain 2 results')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and bundle of patients when patient identifier matches multiple identifier token query parameters regardless of system property', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&identifier=1001113333933',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 200 and an operation outcome when patient identifier matches multiple identifier domain token query parameters', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=pshr:sanid|,pshr:passport:za|',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain 2 results')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('should return 404 and an operation outcome when no patient identifier matches identifier domain token query parameter', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=non:existent:domain|',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 404, 'response status code should be 404')
        t.ok(body)
        t.equal(body.resourceType, 'OperationOutcome', 'result should be a OperationOutcome')
        t.equals(body.issue[0].severity, 'error')
        t.equals(body.issue[0].code, 'invalid')
        t.equals(body.issue[0].details.text, 'targetSystem not found')

        done()
      })
    })
  })

  t.test('should return 404 and an operation outcome when no patient identifier matches multiple identifier domain token query parameters', (t) => {
    // Given
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=pshr:sanid|,non:existent:domain|',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 404, 'response status code should be 404')
        t.ok(body)
        t.equal(body.resourceType, 'OperationOutcome', 'result should be a OperationOutcome')
        t.equals(body.issue[0].severity, 'error')
        t.equals(body.issue[0].code, 'invalid')
        t.equals(body.issue[0].details.text, 'targetSystem not found')

        done()
      })
    })
  })
})

tap.test('Query Param - telecom: ', { autoend: true }, (t) => {
  t.test('telecom query parameter should filter results correctly', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?telecom=email|charlton@email.com',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        done()
      })
    })
  })

  t.test('telecom query parameter should filter results correctly when there are multiple telecom params', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?telecom=email|charlton@email.com&telecom=phone|27831234567',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain zero results')
        done()
      })
    })
  })

  t.test('telecom query parameter should return no results if no matches are found', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?telecom=email|not-mine@email.com',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })
})

tap.test('Query Param (conditional) - email: ', { autoend: true }, (t) => {
  t.test('email query parameter should filter results correctly', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?email=charlton@email.com',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        done()
      })
    })
  })
})

// IHE Profile query parameters
tap.test('pediatrics query parameters', { autoend: true }, (t) => {
  t.test('mothersMaidenName.given query parameter should filter response', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.given=Mary',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('mothersMaidenName.given query parameter should filter response even with multiple values', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.given=Mary&mothersMaidenName.given=Jane',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('mothersMaidenName.given query parameter should return no results if there are no matches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.given=NoMatch',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })

  t.test('mothersMaidenName.family query parameter should filter response', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.family=Smith',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('mothersMaidenName.family query parameter should filter response even with multiple values', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.family=Smith&mothersMaidenName.family=Mc',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('mothersMaidenName.family query parameter should filter response with a name that matches two patients', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.family=Smit',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 2, 'body should contain 2 results')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        t.equal(body.entry[1].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('mothersMaidenName.family query parameter should filter response with an exact match', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.family=Smit&mothersMaidenName.family:exact=Smith',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().charlton.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('mothersMaidenName.family query parameter should return no results if there are no matches', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?mothersMaidenName.family=NoMatch',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })

  t.test('multipleBirthInteger query parameter should filter results correctly', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?multipleBirthInteger=2',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain 1 result')
        t.equal(body.entry[0].resource.identifier[0].value, env.testPatients().emmarentia.patient.identifier[0].value, 'body should contain the matching patient')
        done()
      })
    })
  })

  t.test('multipleBirthInteger query parameter should return no results if no matches are found', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?multipleBirthInteger=5',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })
})

tap.test('Query Param - combined parameters: ', { autoend: true }, (t) => {
  t.test('should search on both given and family name', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?given=charlton&family=matinyana',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')

        // shouldn't match charlton - family name 'doe'
        request({
          url: 'http://localhost:3447/fhir/Patient?given=charlton&family=doe',
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
          t.equal(body.total, 0, 'body should contain zero results')
          done()
        })
      })
    })
  })

  t.test('should search on identifier and name', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&given=charlton',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')

        // shouldn't match charlton - search on different name
        request({
          url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&given=jane',
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
          t.equal(body.total, 0, 'body should contain zero results')
          done()
        })
      })
    })
  })
})

tap.test('patient should be saved correctly', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201, 'response status code should be 201')

        t.ok(res.headers.location, 'should have a location header set')
        t.match(res.headers.location, /\/fhir\/Patient\/[\w-]+\/_history\/[\w-]+/, 'should return a location with both id and vid present')

        const c = db.collection('Patient')
        c.findOne((err, result) => {
          t.error(err)
          t.ok(result, 'result should exist in the mongo')

          t.equal(result.identifier[0].value, '1007211154902', 'should have correct identifier')
          t.equal(result.identifier[1].value, '1001113333933', 'should have correct identifier')

          t.ok(result.meta, 'should have meta set')
          t.ok(result.meta.versionId, 'should have meta.versionId set')
          t.ok(result.meta.lastUpdated, 'should have meta.lastUpdated set')
          t.ok(result._transforms, 'should have _transforms set')
          t.ok(result._request, 'should have _request set')
          t.equal(result._request.method, 'POST', 'should have _request.method set to POST')

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

tap.test('patient endpoint should return an error', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 400, 'response status code should be 400')
        t.equal(body.resourceType, 'OperationOutcome', 'should return an operation outcome object')

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

tap.test('patient should support read', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const id = res.headers.location.replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')

        request({
          url: `http://localhost:3447/fhir/Patient/${id}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Patient', 'result should be a patient')
          t.equal(body.identifier[0].value, '1007211154902', 'body should contain the matching patient')

          t.ok(body.meta, 'should have meta set')
          t.ok(body.meta.versionId, 'should have versionId set')

          t.notOk(body._transforms, 'should not expose _transforms')
          t.notOk(body._request, 'should not expose _request')
          t.notOk(body._id, 'should not expose mongo _id')

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

tap.test('patient read should respond with 404 if not found', (t) => {
  basicPatientTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient/573aff9fed5696d633aaaaaa',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('patient should support vread', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        request({
          url: `http://localhost:3447${res.headers.location}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Patient', 'result should be a patient')
          t.equal(body.identifier[0].value, '1007211154902', 'body should contain the matching patient')
          t.ok(body.meta.versionId, 'body should contain the versionId')

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

tap.test('vread should respond with 404 if version not found', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const id = res.headers.location.replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')

        request({
          url: `http://localhost:3447/fhir/Patient/${id}/_history/2222`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 404, 'response status code should be 404')

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

tap.test('patient should support update', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const originalLocation = res.headers.location
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

          // read
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

            // vread - history should contain original
            request({
              url: `http://localhost:3447${originalLocation}`,
              headers: headers,
              json: true
            }, (err, res, body) => {
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equal(body.resourceType, 'Patient', 'result should be a patient')
              t.equal(body.name[0].given[0], 'Charlton', 'body should contain the original patient')

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

tap.test('patient should support multiple updates', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const originalLocation = res.headers.location
        const id = res.headers.location.replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')
        const update = {
          resourceType: 'Patient',
          id: id,
          active: true,
          name: [
            {
              given: ['Update1']
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

          const updateLocation = res.headers.location

          // read
          request({
            url: `http://localhost:3447/fhir/Patient/${id}`,
            headers: headers,
            json: true
          }, (err, res, body) => {
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equal(body.resourceType, 'Patient', 'result should be a patient')
            t.equal(body.name[0].given[0], 'Update1', 'body should contain the latest patient')

            // vread - history should contain original
            request({
              url: `http://localhost:3447${originalLocation}`,
              headers: headers,
              json: true
            }, (err, res, body) => {
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equal(body.resourceType, 'Patient', 'result should be a patient')
              t.equal(body.name[0].given[0], 'Charlton', 'body should contain the original patient')

              const update2 = {
                resourceType: 'Patient',
                id: id,
                active: true,
                name: [
                  {
                    given: ['Update2']
                  }
                ]
              }

              // update
              request.put({
                url: `http://localhost:3447/fhir/Patient/${id}`,
                headers: headers,
                body: update2,
                json: true
              }, (err, res) => {
                t.error(err)

                t.equal(res.statusCode, 200, 'response status code should be 200')

                // read
                request({
                  url: `http://localhost:3447/fhir/Patient/${id}`,
                  headers: headers,
                  json: true
                }, (err, res, body) => {
                  t.error(err)

                  t.equal(res.statusCode, 200, 'response status code should be 200')
                  t.ok(body)
                  t.equal(body.resourceType, 'Patient', 'result should be a patient')
                  t.equal(body.name[0].given[0], 'Update2', 'body should contain the latest patient')

                  // vread - history should contain original
                  request({
                    url: `http://localhost:3447${originalLocation}`,
                    headers: headers,
                    json: true
                  }, (err, res, body) => {
                    t.error(err)

                    t.equal(res.statusCode, 200, 'response status code should be 200')
                    t.ok(body)
                    t.equal(body.resourceType, 'Patient', 'result should be a patient')
                    t.equal(body.name[0].given[0], 'Charlton', 'body should contain the original patient')

                    // vread - history should contain the first update
                    request({
                      url: `http://localhost:3447${updateLocation}`,
                      headers: headers,
                      json: true
                    }, (err, res, body) => {
                      t.error(err)

                      t.equal(res.statusCode, 200, 'response status code should be 200')
                      t.ok(body)
                      t.equal(body.resourceType, 'Patient', 'result should be a patient')
                      t.equal(body.name[0].given[0], 'Update1', 'body should contain the original patient')

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
})

tap.test('update should replace existing documents', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
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

          // read
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

            // resource should be completely replaced by the updated document
            // should not contain fields from the original document that aren't present in the update
            t.notOk(body.name[0].family, 'body should not contain the family name')
            t.notOk(body.identifier, 'body should not contain the identifier')
            t.notOk(body.gender, 'body should not contain gender')
            t.notOk(body.address, 'body should not contain address')

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

tap.test('read should respond with 404 not found if invalid value for id is used', (t) => {
  basicPatientTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient/th%21s%21sb%24d',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('vread should respond with 404 not found if invalid value for vid is used', (t) => {
  basicPatientTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient/1234/_history/th%21s%21sb%24d',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('patient should support standard _id parameter', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const id = res.headers.location.replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')

        request({
          url: `http://localhost:3447/fhir/Patient?_id=${id}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
          t.equals(1, body.entry.length, 'Bundle should have 1 entry')
          t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'should contain the matching patient')

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

tap.test('patient update should insert document when boolean updateCreate true and document does not exist', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      config.setConf('operations:updateCreate', true)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))

      request.put({
        url: `http://localhost:3447/fhir/Patient/${pat.id}`,
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201, 'response status code should be 201')
        t.ok(body)

        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            config.setConf('operations:updateCreate', false)
            t.end()
          })
        })
      })
    })
  })
})

tap.test('patient update should insert document when string updateCreate true and document does not exist', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      config.setConf('operations:updateCreate', 'true')

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))

      request.put({
        url: `http://localhost:3447/fhir/Patient/${pat.id}`,
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201, 'response status code should be 201')
        t.ok(body)

        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            config.setConf('operations:updateCreate', false)
            t.end()
          })
        })
      })
    })
  })
})

tap.test('patient update should error when boolean updateCreate false and document does not exist', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      config.setConf('operations:updateCreate', false)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))

      request.put({
        url: `http://localhost:3447/fhir/Patient/${pat.id}`,
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 404, 'response status code should be 404')
        t.ok(body)

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

tap.test('patient update should error when string updateCreate false and document does not exist', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      config.setConf('operations:updateCreate', 'false')

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))

      request.put({
        url: `http://localhost:3447/fhir/Patient/${pat.id}`,
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 404, 'response status code should be 404')
        t.ok(body)

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

tap.test('patient should support complex chained parameters', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const loc = _.cloneDeep(require('./resources/Location-1.json'))
      delete loc.id

      env.createResource(t, loc, 'Location', (err, locRef) => {
        t.error(err)
        const prac = _.cloneDeep(require('./resources/Practitioner-1.json'))
        delete prac.id
        prac.practitionerRole[0].location = []
        prac.practitionerRole[0].location[0] = { reference: locRef }

        env.createResource(t, prac, 'Practitioner', (err, pracRef) => {
          t.error(err)
          const pat = _.cloneDeep(require('./resources/Patient-1.json'))
          delete pat.id
          pat.careProvider = [
            {
              reference: pracRef
            },
            {
              reference: 'Organization/123'
            }
          ]

          env.createResource(t, pat, 'Patient', () => {
            request({
              url: 'http://localhost:3447/fhir/Patient?careprovider.location.name=Greenwood',
              headers: headers,
              json: true
            }, (err, res, body) => {
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
              t.equals(1, body.entry.length, 'Bundle should have 1 entry')
              t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'should contain the matching patient')

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
