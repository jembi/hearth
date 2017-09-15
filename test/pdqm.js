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
const querystring = require('querystring')
const crypto = require('crypto')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
charlton.identifier[0].system = 'test:assigning:auth'
charlton.identifier[0].value = '111111'
charlton.identifier[1].system = 'another:assigning:auth'
charlton.identifier[1].value = '222222'
delete charlton.identifier[2].system
charlton.identifier[2].value = '333333'
delete charlton.link
charlton.birthDate = '1980-09-12'
charlton.gender = 'male'
charlton.address[0].line[0] = '1st Street'
charlton.address[0].line[1] = 'Block 1'
charlton.extension = [
  {
    url: 'http://pdqm-sample:8080/ITI-78/Profile/pdqm#mothersMaidenName',
    valueHumanName: {
      family: [ 'Smith', 'Mc', 'extra' ],
      given: [ 'Mary', 'Jane' ]
    }
  }
]
charlton.multipleBirthInteger = 2

const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
emmarentia.name[0].given = ['Emmarentia', 'Gerherda']
emmarentia.name[0].family = ['Cook', 'Spray']
emmarentia.address[0].line[0] = '1st'
emmarentia.extension = [
  {
    url: 'http://pdqm-sample:8080/ITI-78/Profile/pdqm#mothersMaidenName',
    valueHumanName: {
      family: [ 'Cook', 'Smit' ],
      given: [ 'Mom' ]
    }
  }
]

const nikita = testPatients.nikita.patient
nikita.id = '3333333333'

const basicPDQmTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const patients = []

      patients.push(
        charlton,
        emmarentia,
        nikita
      )

      const c = db.collection('Patient')
      c.insertMany(patients, (err, doc) => {
        t.error(err)
        t.ok(doc)
        t.equal(doc.insertedIds.length, patients.length)

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

const hashAndSortEntryArray = (entry) => {
  return entry.map((entry) => {
    return crypto.createHash('sha256').update(JSON.stringify(entry), 'utf-8').digest('hex')
  }).sort()
}

const requestAndAssertResponseBundle = (tp, t, done) => {
  // When
  request({
    url: `http://localhost:3447/fhir/Patient?${querystring.stringify(tp.queryParams)}`,
    headers: headers,
    json: true
  }, (err, res, body) => {
    // Then
    t.error(err)
    t.equal(res.statusCode, tp.statusCode, 'Response has expected status code')

    t.equal(body.resourceType, 'Bundle')
    t.equal(body.total, tp.expectedResponse.total)

    const actual = hashAndSortEntryArray(body.entry)
    t.deepEqual(actual, tp.expectedResponse.entry, 'Response contains expected entries')
    done()
  })
}

const requestAndAssertResponseOperationOutcome = (tp, t, done) => {
  // When
  request({
    url: `http://localhost:3447/fhir/Patient?${querystring.stringify(tp.queryParams)}`,
    headers: headers,
    json: true
  }, (err, res, body) => {
    // Then
    t.error(err)
    t.equal(res.statusCode, tp.statusCode, 'response status code should be 400')

    t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
    t.equal(body.issue[0].severity, tp.expectedResponse.severity)
    t.equal(body.issue[0].code, tp.expectedResponse.code)
    t.equal(body.issue[0].details.text, tp.expectedResponse.details)
    done()
  })
}

tap.test('PDQm Query', { autoend: true }, (t) => {
  t.test('indentifier query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle of patients when patient identifier matches full identifier token query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = 'test:assigning:auth|111111'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient identifier matches multiple full identifier token query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = [ 'test:assigning:auth|111111', 'another:assigning:auth|222222' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient identifier matches identifier token query parameter regardless of system property', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = '111111'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient identifier matches full identifier token query parameter where system property is not defined', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = '|333333'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient identifier matches multiple identifier token query parameters regardless of system property', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = [ '111111', '222222' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and an operation outcome when patient identifier matches multiple identifier domain token query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = 'test:assigning:auth|,another:assigning:auth|'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and an empty bundle when patient identifier does not match identifier token query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = 'test:assigning:auth|000000'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 404 and an operation outcome when no patient identifier matches identifier domain token query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = 'non:existent:domain|'

        delete charlton._id
        const expectedResponse = {
          severity: 'error',
          code: 'invalid',
          details: 'targetSystem not found'
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 404
        }

        requestAndAssertResponseOperationOutcome(testParams, t, done)
      })
    })

    t.test('should return 404 and an operation outcome when no patient identifier matches multiple identifier domain token query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.identifier = 'test:assigning:authority|,non:existent:domain|'

        delete charlton._id
        const expectedResponse = {
          severity: 'error',
          code: 'invalid',
          details: 'targetSystem not found'
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 404
        }

        requestAndAssertResponseOperationOutcome(testParams, t, done)
      })
    })
  })

  t.test('_id query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle with a single patient when patient id matches _id query parameter allow :exact', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['_id:exact'] = '1111111111'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle with a single patient when patient id matches _id query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams._id = '2222222222'

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and an empty bundle of patients when patient id does not match _id query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams._id = 'non-existant-id'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })

  t.test('family query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle of patients when multiple patient family names match family query parameter without exact match opeartor', (t) => {
      // Given
      charlton.name[0].family = ['Cookoo']
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.family = 'Cook'

        delete charlton._id
        delete emmarentia._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
              resource: charlton
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)
        delete charlton.name[0].family

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when multiple patient family names match family query parameter without exact match opeartor', (t) => {
      // Given
      charlton.name[0].family = ['Cookoo']
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['family:exact'] = 'Cook'

        delete charlton._id
        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)
        delete charlton.name[0].family

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when multiple patient family names match family query parameter', (t) => {
      // Given
      charlton.name[0].family = ['Cook']
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.family = 'Cook'

        delete charlton._id
        delete emmarentia._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
              resource: charlton
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)
        delete charlton.name[0].family

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient family name matches family query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.family = 'Cook'

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when multiple patient family names match multiple family query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.family = [ 'Cook', 'Spray' ]

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and an empty bundle when no patient name matches family query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.family = ['Surnamey']

        delete emmarentia._id
        const expectedResponse = {
          total: 0,
          entry: []
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })

  t.test('given query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle of patients when multiple patient given names match given query parameter', (t) => {
      // Given
      charlton.name[0].given = ['Gerherda']
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.given = 'Gerherda'

        delete charlton._id
        delete emmarentia._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
              resource: charlton
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)
        delete charlton.name[0].given

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient given name matches given query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.given = 'Emmarentia'

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when multiple patient given names match multiple given query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.given = ['Emmarentia', 'Gerherda']

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and an empty bundle when no patient name matches given query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.given = ['Emmarentia', 'Kurtus']

        delete emmarentia._id
        const expectedResponse = {
          total: 0,
          entry: []
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })

  t.test('birthdate query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle of patients when patient birthDate matches date birthDate query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = 'eq1970-07-21'

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient birthDate matches year birthDate query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = 'eq1970'

        delete emmarentia._id
        delete nikita._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
              resource: nikita
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient birthDate does not match date birthDate query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = 'ne1970-07-21'

        delete charlton._id
        delete nikita._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
              resource: charlton
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
              resource: nikita
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient birthDate matches multiple birthDate query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = [ 'eq1970', 'ne1970-01-16' ]

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient birthDate matches multiple date birthDate query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = [ 'ge1970-01', 'le1970-10-31' ]

        delete emmarentia._id
        delete nikita._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
              resource: nikita
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient birthDate less-than/equal date birthDate query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = 'le1970-10-31'

        delete emmarentia._id
        delete nikita._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
              resource: nikita
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient birthDate greater/equal date birthDate query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.birthDate = [ 'ge1970-10-31' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
              resource: charlton
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })

  t.test('address query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle of patients when patient address matches address query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.address = '1st Street'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient address matches address query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['address:exact'] = '1st'

        delete emmarentia._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient address matches address query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.address = [ '1st', 'Western Cape' ]
        testQueryParams['address:exact'] = 'Block 1'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient address matches address query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.address = [ '1st', 'Eastern Cape' ]
        testQueryParams['address:exact'] = 'Block 1'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient address matches address query parameters', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.address = [ '1st', 'Western Cape' ]

        delete charlton._id
        delete emmarentia._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
              resource: charlton
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })

  t.test('gender query parameter', { autoend: true }, (t) => {
    t.test('should return 200 and bundle of patients when patient gender matches gender query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.gender = 'male'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and bundle of patients when patient gender matches gender query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.gender = 'female'

        delete nikita._id
        delete emmarentia._id
        const expectedResponse = {
          total: 2,
          entry: [
            {
              fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
              resource: emmarentia
            }, {
              fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
              resource: nikita
            }
          ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('should return 200 and an empty bundle no patient gender matches gender query parameter', (t) => {
      // Given
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.gender = 'not-a-gender'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })

  t.test('pediatrics query parameters', { autoend: true }, (t) => {
    t.test('mothersMaidenName.given query parameter should filter response', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.given'] = 'Mary'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.given query parameter should filter response even with multiple values', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.given'] = [ 'Mary', 'Jane' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.given query parameter should return no results if there are no matches', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.given'] = 'NoMatch'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.family query parameter should filter response', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.family'] = 'Smith'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.family query parameter should filter response even with multiple values', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.family'] = [ 'Smith', 'Mc' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.family query parameter should filter response with a name that matches two patients', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.family'] = [ 'Smit' ]

        delete charlton._id
        delete emmarentia._id
        const expectedResponse = {
          total: 2,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          }, {
            fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
            resource: emmarentia
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.family query parameter should filter response with an exact match', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.family'] = [ 'Smit' ]
        testQueryParams['mothersMaidenName.family:exact'] = [ 'Smith' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('mothersMaidenName.family query parameter should return no results if there are no matches', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams['mothersMaidenName.family'] = 'NoMatch'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('telecom query parameter should filter results correctly', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.telecom = 'email|charlton@email.com'

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('telecom query parameter should filter results correctly when there are multiple telecom params', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.telecom = [ 'email|charlton@email.com', 'phone|27831234567' ]

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('telecom query parameter should return no results if no matches are found', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.telecom = 'email|not-mine@email.com'

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('multipleBirthInteger query parameter should filter results correctly', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.multipleBirthInteger = 2

        delete charlton._id
        const expectedResponse = {
          total: 1,
          entry: [ {
            fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
            resource: charlton
          } ]
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })

    t.test('multipleBirthInteger query parameter should return no results if no matches are found', (t) => {
      basicPDQmTest(t, (db, done) => {
        const testQueryParams = {}
        testQueryParams.multipleBirthInteger = 5

        delete charlton._id
        const expectedResponse = {
          total: 0,
          entry: []
        }
        expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

        const testParams = {
          queryParams: testQueryParams,
          expectedResponse: expectedResponse,
          statusCode: 200
        }

        requestAndAssertResponseBundle(testParams, t, done)
      })
    })
  })
})
