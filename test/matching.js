'use strict'

const tap = require('tap')
const request = require('request')
const crypto = require('crypto')

const env = require('./test-env/init')()
const server = require('../lib/server')
const matchingConfig = require('../config/matching')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)
const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
const nikita = testPatients.nikita.patient
nikita.id = '3333333333'

const basicMatchingTest = (t, test) => {
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
    url: `http://localhost:3447/fhir/Patient/$match`,
    headers: headers,
    method: 'POST',
    body: tp.body,
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

const matchOperationBodyTemplate = {
  resourceType: 'Parameters',
  parameter: [
    {
      name: 'resource',
      resource: {
        resourceType: 'Patient',
        name: [
          {
            family: [
              'Matinyana'
            ],
            given: [
              'Charlton'
            ]
          }
        ]
      }
    }, {
      name: 'count',
      valueInteger: 100
    }, {
      name: 'onlyCertainMatches',
      valueBoolean: false
    }
  ]
}

const matchOperationConfigTemplate = {
  matchingProperties: {
    'name.given': {
      algorithm: 'exact',
      weight: 0.5
    },
    'name.family': {
      algorithm: 'exact',
      weight: 0.5
    }
  }
}

tap.test('should return 404 if no certain matches found and onlyCertainMatches parameter true', (t) => {
  // Given
  matchingConfig.resourceConfig.Patient = Object.assign({}, matchOperationConfigTemplate)
  const testBody = JSON.parse(JSON.stringify(matchOperationBodyTemplate))
  testBody.parameter[2].valueBoolean = true
  testBody.parameter[0].resource.name[0].family[0] = 'NotCertainMatch'
  basicMatchingTest(t, (db, done) => {
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
      t.equal(res.statusCode, 404, 'response status code should be 404')
      t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
      t.equal(body.issue[0].severity, 'info')
      t.equal(body.issue[0].code, 'not-found')
      t.equal(body.issue[0].details.text, 'No certain matches found')
      done()
    })
  })
})

tap.test('should return 409 if multiple certain matches found and onlyCertainMatches parameter true', (t) => {
  // Given
  matchingConfig.resourceConfig.Patient = Object.assign({}, matchOperationConfigTemplate)
  const testBody = JSON.parse(JSON.stringify(matchOperationBodyTemplate))
  testBody.parameter[2].valueBoolean = true
  testBody.parameter[0].resource.name[0].family.push('Cook')
  testBody.parameter[0].resource.name[0].given.push('Emmarentia')
  basicMatchingTest(t, (db, done) => {
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
      t.equal(res.statusCode, 409, 'response status code should be 409')
      t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
      t.equal(body.issue[0].severity, 'info')
      t.equal(body.issue[0].code, 'conflict')
      t.equal(body.issue[0].details.text, 'More than one certain match found')
      done()
    })
  })
})

tap.test('should return 200 and a bundle of patients with search scores exactly matching the posted parameters resource', (t) => {
  // Given
  matchingConfig.resourceConfig.Patient = Object.assign({}, matchOperationConfigTemplate)
  const testBody = JSON.parse(JSON.stringify(matchOperationBodyTemplate))

  basicMatchingTest(t, (db, done) => {
    delete charlton._id
    const expectedResponse = {
      total: 1,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: charlton,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
              valueCode: 'certain'
            },
            score: 1
          }
        }
      ]
    }
    expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})

tap.test('should return 200 and a bundle of patients with search scores matching the levenshtein algorithm', (t) => {
  // Given
  matchingConfig.resourceConfig.Patient = Object.assign({}, matchOperationConfigTemplate)
  matchingConfig.resourceConfig.Patient.matchingProperties['name.given'].algorithm = 'levenshtein'
  const testBody = JSON.parse(JSON.stringify(matchOperationBodyTemplate))

  basicMatchingTest(t, (db, done) => {
    delete charlton._id
    delete emmarentia._id
    delete nikita._id
    const expectedResponse = {
      total: 3,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: charlton,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
              valueCode: 'certain'
            },
            score: 1
          }
        }, {
          fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
          resource: emmarentia,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
              valueCode: 'certainly-not'
            },
            score: 0.15
          }
        }, {
          fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
          resource: nikita,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
              valueCode: 'certainly-not'
            },
            score: 0.0625
          }
        }
      ]
    }
    expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})
