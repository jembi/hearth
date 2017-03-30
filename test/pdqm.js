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
charlton.id = 1111111111
charlton.identifier[0].system = 'test:assigning:auth'
charlton.identifier[0].value = '111111'
charlton.identifier[1].system = 'another:assigning:auth'
charlton.identifier[1].value = '222222'
delete charlton.identifier[2].system
charlton.identifier[2].value = '333333'
delete charlton.link
charlton.birthDate = '1980-09-12'

const emmarentia = testPatients.emmarentia.patient
emmarentia.id = 2222222222

const nikita = testPatients.nikita.patient
nikita.id = 3333333333

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

// const requestAndAssertResponseOperationOutcome = (tp, t, done) => {
//   // When
//   request({
//     url: `http://localhost:3447/fhir/Patient?${querystring.stringify(tp.queryParams)}`,
//     headers: headers,
//     json: true
//   }, (err, res, body) => {
//     // Then
//     t.error(err)
//     t.equal(res.statusCode, tp.statusCode, 'response status code should be 400')
//
//     t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
//     t.equal(body.issue[0].severity, tp.expectedResponse.severity)
//     t.equal(body.issue[0].code, tp.expectedResponse.code)
//     t.equal(body.issue[0].details.text, tp.expectedResponse.details)
//     done()
//   })
// }

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
  })

  t.test('_id query parameter', { autoend: true }, (t) => {
    // TODO
    t.test('TODO', (t) => {
      t.end()
    })
  })

  t.test('family query parameter', { autoend: true }, (t) => {
    // TODO
    t.test('TODO', (t) => {
      t.end()
    })
  })

  t.test('given query parameter', { autoend: true }, (t) => {
    // TODO
    t.test('TODO', (t) => {
      t.end()
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
    // TODO
    t.test('TODO', (t) => {
      t.end()
    })
  })

  t.test('gender query parameter', { autoend: true }, (t) => {
    // TODO
    t.test('TODO', (t) => {
      t.end()
    })
  })

  t.test('pediatrics query parameters', { autoend: true }, (t) => {
    t.test('mothersMaidenName.given query parameter', { autoend: true }, (t) => {
      // TODO
      t.test('TODO', (t) => {
        t.end()
      })
    })

    t.test('mothersMaidenName.family query parameter', { autoend: true }, (t) => {
      // TODO
      t.test('TODO', (t) => {
        t.end()
      })
    })

    t.test('telecom query parameter', { autoend: true }, (t) => {
      // TODO
      t.test('TODO', (t) => {
        t.end()
      })
    })

    t.test('multipleBirthInteger query parameter', { autoend: true }, (t) => {
      // TODO
      t.test('TODO', (t) => {
        t.end()
      })
    })
  })
})
