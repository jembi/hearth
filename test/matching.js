 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')
const request = require('request')
const sinon = require('sinon')
const _ = require('lodash')

const env = require('./test-env/init')()
const server = require('../lib/server')
const matchingConfig = require('../config/matching')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)
const testPatients = env.testPatients()

const sandbox = sinon.sandbox.create()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
emmarentia.id = '2222222222'
const nikita = testPatients.nikita.patient
nikita.id = '3333333333'

const testPatientsTemplate = [charlton, emmarentia, nikita]

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

const getCleanMatchingConfig = () => {
  const testMatchingConfig = _.cloneDeep(matchingConfig)
  testMatchingConfig.resourceConfig.Patient.matchingProperties = {}
  testMatchingConfig.resourceConfig.Patient.discriminatorProperties = {}
  return testMatchingConfig
}

const stubMatchingConfig = (testMatchingConfig) => {
  sandbox.stub(matchingConfig.resourceConfig, 'Patient').value(testMatchingConfig.resourceConfig.Patient)
}

const basicMatchingTest = (testPatients, t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const c = db.collection('Patient')
      c.insertMany(testPatients, { forceServerObjectId: true }, (err, doc) => {
        t.error(err)
        t.ok(doc)
        t.equal(doc.insertedIds.length, testPatients.length)

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

    const actual = body.entry
    t.deepEqual(actual, tp.expectedResponse.entry, 'Response contains expected entries')
    done()
  })
}

tap.afterEach((done) => {
  sandbox.restore()
  done()
})

tap.test('should return 404 if no certain matches found and onlyCertainMatches parameter true', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'exact', weight: 1 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[2].valueBoolean = true
  testBody.parameter[0].resource.name[0].family[0] = 'NotCertainMatch'

  const testPatients = _.cloneDeep(testPatientsTemplate)
  basicMatchingTest(testPatients, t, (db, done) => {
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
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'exact', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'exact', weight: 0.5 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[2].valueBoolean = true
  testBody.parameter[0].resource.name[0].family.push('Cook')
  testBody.parameter[0].resource.name[0].given.push('Emmarentia')

  const testPatients = _.cloneDeep(testPatientsTemplate)
  basicMatchingTest(testPatients, t, (db, done) => {
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

tap.test('should return 200 if no matches are found and onlyCertainMatches not true', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'levenstein', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'exact', weight: 0.5 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)

  env.initDB((err, db) => {
    t.error(err)
    server.start((err) => {
      t.error(err)
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
        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.equal(body.resourceType, 'Bundle', 'Reponse body should be a Bundle')
        t.equal(body.entry.length, 0, 'The bundle entries should be empty')
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

tap.test('should return 200 and a bundle of patients with search scores exactly matching the posted parameters resource', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'exact', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'exact', weight: 0.5 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)

  const testPatients = _.cloneDeep(testPatientsTemplate)
  basicMatchingTest(testPatients, t, (db, done) => {
    const expectedResponse = {
      total: 1,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: testPatients[0],
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'certain'
            },
            score: 1
          }
        }
      ]
    }

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})

tap.test('should return 200 and a bundle of patients matching on name.given=levenshtein(weight 0.5) and name.family=exact(weight 0.5)', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'levenshtein', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'exact', weight: 0.5 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)

  const mwawiTemp = _.cloneDeep(env.testPatients().mwawi.patient)
  mwawiTemp.id = '4444444444'
  mwawiTemp.name[0].given = ['charly']
  mwawiTemp.name[0].family = ['Matinyana']

  const testPatients = _.cloneDeep(testPatientsTemplate)
  testPatients.push(mwawiTemp)

  basicMatchingTest(testPatients, t, (db, done) => {
    const expectedResponse = {
      total: 2,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: charlton,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'certain'
            },
            score: 1
          }
        }, {
          fullUrl: 'http://localhost:3447/fhir/Patient/4444444444',
          resource: mwawiTemp,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'possible'
            },
            score: 0.75
          }
        }
      ]
    }

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})

tap.test('should return 200 and a bundle of patients exactly matching the phonetic representation of the posted parameters resource', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'double-metaphone', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'double-metaphone', weight: 0.5 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[0].resource.name[0].given = ['Mwawi']
  testBody.parameter[0].resource.name[0].family = ['Ntshwanti']

  env.initDB((err, db) => {
    t.error(err)
    server.start((err) => {
      t.error(err)
      env.createPatient(t, _.cloneDeep(testPatients.mwawi), () => {
        // When
        request({
          url: `http://localhost:3447/fhir/Patient/$match`,
          headers: headers,
          method: 'POST',
          body: testBody,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(body.entry[0].search.score, 1, 'Patient should be found')

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

tap.test('should return 200 and a bundle of patients matching the phonetic representation of a property in the posted parameters resource', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'double-metaphone', weight: 1 }
  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[0].resource.name[0].given = ['Grant', 'Maw'] // [KRNT, KRNT], [M, MF]

  env.initDB((err, db) => {
    t.error(err)
    server.start((err) => {
      t.error(err)
      env.createPatient(t, _.cloneDeep(testPatients.mwawi), () => {
        // When
        request({
          url: `http://localhost:3447/fhir/Patient/$match`,
          headers: headers,
          method: 'POST',
          body: testBody,
          json: true
        }, (err, res, body) => {
          // Then
          t.error(err)
          t.equal(body.entry[0].search.score, 1, 'Patient Mwawi should be found')

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

tap.test('should discriminate using an exact match', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'exact', weight: 1 }
  testMatchingConfig.resourceConfig.Patient.discriminatorProperties['birthDate'] = { algorithm: 'exact' }

  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[0].resource.birthDate = '1991-07-08'
  testBody.parameter[0].resource.name[0].given = 'John'

  const testPatients = _.cloneDeep(testPatientsTemplate)
  testPatients[0].birthDate = '1991-07-08'
  testPatients[1].birthDate = '1937-04-31'
  testPatients[2].birthDate = '1991-07-08'
  testPatients[0].name[0].given = 'John'
  testPatients[1].name[0].given = 'John'
  testPatients[2].name[0].given = 'John'

  basicMatchingTest(testPatients, t, (db, done) => {
    const expectedResponse = {
      total: 2,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: testPatients[0],
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'certain'
            },
            score: 1
          }
        },
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/3333333333',
          resource: testPatients[2],
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'certain'
            },
            score: 1
          }
        }
      ]
    }

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})

tap.test('should discriminate using a partial match', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'exact', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'levenshtein', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.discriminatorProperties['name.family'] = { algorithm: 'partial-1-char' }

  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[0].resource.name[0].family = 'Smith'
  testBody.parameter[0].resource.name[0].given = 'John'

  const testPatients = _.cloneDeep(testPatientsTemplate)
  testPatients[0].name[0].family = 'Smith'
  testPatients[1].name[0].family = 'Smyth'
  testPatients[2].name[0].family = 'James'
  testPatients[0].name[0].given = 'John'
  testPatients[1].name[0].given = 'John'
  testPatients[2].name[0].given = 'John'

  basicMatchingTest(testPatients, t, (db, done) => {
    delete testPatients[0]._transforms
    delete testPatients[1]._transforms
    delete testPatients[2]._transforms
    const expectedResponse = {
      total: 2,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: testPatients[0],
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'certain'
            },
            score: 1
          }
        },
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/2222222222',
          resource: testPatients[1],
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: 'probable'
            },
            score: 0.9
          }
        }
      ]
    }

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})

tap.test('should discriminate using a exact match on representation', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'exact', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'levenshtein', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.discriminatorProperties['name.family'] = { algorithm: 'double-metaphone' }

  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[0].resource.name[0].family = 'Smith'
  testBody.parameter[0].resource.name[0].given = 'John'

  const pat1 = { resourceType: 'Patient', name: [ { given: 'John', family: 'Smith' } ] }
  const pat2 = { resourceType: 'Patient', name: [ { given: 'John', family: 'Smith' } ] }
  const pat3 = { resourceType: 'Patient', name: [ { given: 'John', family: 'Smith' } ] }
  pat1.name[0].family = 'Smith'
  pat2.name[0].family = 'Smyth'
  pat3.name[0].family = 'Jmith'
  pat1.name[0].given = 'John'
  pat2.name[0].given = 'John'
  pat3.name[0].given = 'John'

  env.initDB((err, db) => {
    t.error(err)
    server.start((err) => {
      t.error(err)
      env.createPatient(t, { patient: pat1 }, () => {
        env.createPatient(t, { patient: pat2 }, () => {
          env.createPatient(t, { patient: pat3 }, () => {
            // When
            request({
              url: `http://localhost:3447/fhir/Patient/$match`,
              headers: headers,
              method: 'POST',
              body: testBody,
              json: true
            }, (err, res, body) => {
              // Then
              t.error(err)
              t.equals(res.statusCode, 200, 'should respond with a 200 status')

              t.equals(body.entry.length, 2, 'should match only w of the patient due to the discriminator')
              t.equals(body.entry[0].search.score, 1)
              t.equals(body.entry[1].search.score, 0.9)

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

tap.test('should return an error when an invalid algorithm is used for in the discriminator', (t) => {
  // Given
  const testMatchingConfig = getCleanMatchingConfig()
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.given'] = { algorithm: 'exact', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.matchingProperties['name.family'] = { algorithm: 'levenshtein', weight: 0.5 }
  testMatchingConfig.resourceConfig.Patient.discriminatorProperties['name.family'] = { algorithm: 'levenshtein' }

  stubMatchingConfig(testMatchingConfig)

  const testBody = _.cloneDeep(matchOperationBodyTemplate)
  testBody.parameter[0].resource.name[0].family = 'Smith'
  testBody.parameter[0].resource.name[0].given = 'John'

  env.initDB((err, db) => {
    t.error(err)
    server.start((err) => {
      t.error(err)
      // When
      request({
        url: `http://localhost:3447/fhir/Patient/$match`,
        headers: headers,
        method: 'POST',
        body: testBody,
        json: true
      }, (err, res, body) => {
        // Then
        t.error(err)
        t.equals(res.statusCode, 500, 'should respond with a 500 status')

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
