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
const crypto = require('crypto')
const querystring = require('querystring')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const basicPIXmTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const charlton = env.testPatients().charlton
      charlton.patient.identifier.splice(1)
      charlton.patient.identifier[0].system = 'pshr:passport:za'
      charlton.patient.identifier[0].value = '888888'
      delete charlton.patient.link

      const emmarentia = env.testPatients().emmarentia
      emmarentia.patient.identifier[0].value = '222222'
      emmarentia.patient.identifier[1].value = '888888'
      emmarentia.patient.identifier[2].value = '999999'
      emmarentia.patient.link[0].other.reference = parameters[1].valueReference
      emmarentia.patient.link[1].other.reference = parameters[2].valueReference
      emmarentia.patient.id = '123456789'

      const nikita = env.testPatients().nikita
      delete nikita.patient.identifier
      delete nikita.patient.link
      nikita.patient.id = '987654321'

      const c = db.collection('Patient')
      c.insertOne(charlton.patient, (err, doc) => {
        t.error(err)
        t.ok(doc)

        c.insertOne(emmarentia.patient, (err, doc) => {
          t.error(err)
          t.ok(doc)

          c.insertOne(nikita.patient, (err, doc) => {
            t.error(err)
            t.ok(doc)

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

const parameters = [
  {
    name: 'targetId',
    valueReference: 'http://localhost:3447/fhir/Patient/123456789'
  }, {
    name: 'targetId',
    valueReference: 'http://xyz-server/xxx/Patient/444444'
  }, {
    name: 'targetId',
    valueReference: 'http://abc-server/Patient/333333'
  }, {
    name: 'targetIdentifier',
    valueIdentifier: {
      use: 'official',
      system: 'pshr:sanid',
      value: '222222'
    }
  }, {
    name: 'targetIdentifier',
    valueIdentifier: {
      use: 'official',
      system: 'pshr:passport:za',
      value: '888888'
    }
  }, {
    name: 'targetIdentifier',
    valueIdentifier: {
      use: 'official',
      system: 'pshr:passport:gbr',
      value: '999999'
    }
  }, {
    name: 'targetId',
    valueReference: 'http://localhost:3447/fhir/Patient/987654321'
  }
]

const hashAndSortParameters = (parameters = []) => {
  return parameters.map((parameter) => {
    return crypto.createHash('sha256').update(JSON.stringify(parameter), 'utf-8').digest('hex')
  }).sort()
}

const requestAndAssertParameters = (tp, t, done) => {
  // When
  const sourceIdentifier = tp.sourceIdentifier
  const targetSystem = tp.targetSystem
  const escapedQueryString = querystring.stringify({ sourceIdentifier, targetSystem })

  request({
    url: `http://localhost:3447/fhir/Patient/$ihe-pix?${escapedQueryString}`,
    headers: headers,
    json: true
  }, (err, res, body) => {
    // Then

    t.error(err)
    t.equal(res.statusCode, tp.statusCode, 'response status code should be 200')
    t.ok(body)
    t.ok(body.parameter)
    t.equal(body.resourceType, 'Parameters', 'Should return a parameters resource')

    let actualParameters = hashAndSortParameters(body.parameter)

    t.deepEqual(actualParameters, tp.expectedParameters, 'Parameters resource should contain expected parameters')
    done()
  })
}

tap.test('PIXm Query, should return 200 and the identifiers parameters resource, excluding the queried identifier', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i !== 3 && i !== 6)),
      sourceIdentifier: 'pshr:sanid|222222',
      targetSystem: '',
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and the identifier from an identifier target system', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i === 4)),
      sourceIdentifier: 'pshr:passport:gbr|999999',
      targetSystem: 'pshr:passport:za',
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and the targetId from a link target system', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i === 1)),
      sourceIdentifier: 'pshr:sanid|222222',
      targetSystem: 'http://xyz-server',
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and the identifiers from the fhir server\'s domain', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i !== 0 && i !== 6)),
      sourceIdentifier: 'http://localhost:3447/fhir|123456789',
      targetSystem: '',
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and an empty response when the target system matches the one searched', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: [],
      sourceIdentifier: 'http://localhost:3447/fhir|123456789',
      targetSystem: 'http://localhost:3447/fhir',
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and empty parameters when recognises the domain and id but no ids in other domains', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: [],
      sourceIdentifier: 'http://localhost:3447/fhir|987654321',
      targetSystem: '',
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and the relevant parameters resource when multiple targetSystems are specified', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i === 1 || i === 4)),
      sourceIdentifier: 'http://localhost:3447/fhir|123456789',
      targetSystem: ['http://xyz-server', 'pshr:passport:za'],
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and the relevant parameters resource when sourceIdentifier is a link', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i !== 1 && i !== 6)),
      sourceIdentifier: 'http://xyz-server/xxx|444444',
      targetSystem: [],
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 200 and the relevant parameters resource when sourceIdentifier is a link with trailing forwardslash', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: hashAndSortParameters(parameters.filter((v, i) => i !== 1 && i !== 6)),
      sourceIdentifier: 'http://xyz-server/xxx/|444444',
      targetSystem: [],
      statusCode: 200
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 404 and empty parameters when recognises the domain but can\'t find the id', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: [],
      sourceIdentifier: 'pshr:sanid|non-existent-id',
      targetSystem: '',
      statusCode: 404
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

tap.test('PIXm Query, should return 404 and empty parameters when recognises the domain but can\'t find the id', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      expectedParameters: [],
      sourceIdentifier: 'http://localhost:3447/fhir|non-existent-id',
      targetSystem: '',
      statusCode: 404
    }

    requestAndAssertParameters(testParams, t, done)
  })
})

const requestAndAssertOperationOutcome = (tp, t, done) => {
  // When
  request({
    url: `http://localhost:3447/fhir/Patient/$ihe-pix?${tp.sourceIdentifier}&${tp.targetSystem}`,
    headers: headers,
    json: true
  }, (err, res, body) => {
    // Then

    t.error(err)
    t.equal(res.statusCode, tp.statusCode, 'response status code should be 400')
    t.ok(body)
    t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
    t.equal(body.issue[0].severity, tp.severity)
    t.equal(body.issue[0].code, tp.code)
    t.equal(body.issue[0].details.text, tp.details)
    done()
  })
}

tap.test('PIXm query, should return 400 bad request if missing required query parameter', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      statusCode: 400,
      sourceIdentifier: '',
      targetSystem: 'targetSystem=test',
      severity: 'error',
      code: 'invalid',
      details: 'This endpoint has the following required query parameters: ["sourceIdentifier"]'
    }

    requestAndAssertOperationOutcome(testParams, t, done)
  })
})

tap.test('PIXm query, should return 400 bad request if assigning authority not found', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      statusCode: 400,
      sourceIdentifier: 'sourceIdentifier=12345',
      targetSystem: '',
      severity: 'error',
      code: 'invalid',
      details: 'sourceIdentifier Assigning Authority not found'
    }

    requestAndAssertOperationOutcome(testParams, t, done)
  })
})

tap.test('PIXm query, should return 400 bad request if assigning authority not found', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      statusCode: 400,
      sourceIdentifier: 'sourceIdentifier=|12345',
      targetSystem: '',
      severity: 'error',
      code: 'invalid',
      details: 'sourceIdentifier Assigning Authority not found'
    }

    requestAndAssertOperationOutcome(testParams, t, done)
  })
})

tap.test('PIXm query, should return 400 bad request if assigning authority not found', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      statusCode: 400,
      sourceIdentifier: 'sourceIdentifier=12345|12345',
      targetSystem: '',
      severity: 'error',
      code: 'invalid',
      details: 'sourceIdentifier Assigning Authority not found'
    }

    requestAndAssertOperationOutcome(testParams, t, done)
  })
})

tap.test('PIXm query, should return 403 forbidden if target system not found', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      statusCode: 403,
      sourceIdentifier: 'sourceIdentifier=pshr:sanid|222222',
      targetSystem: 'targetSystem=pshr:passport:ken',
      severity: 'error',
      code: 'invalid',
      details: 'targetSystem not found'
    }

    requestAndAssertOperationOutcome(testParams, t, done)
  })
})

// This is not according to PIXm spec, but seems intuitive
tap.test('PIXm query, should return 400 bad request if more than one patient returned', (t) => {
  // Given
  basicPIXmTest(t, (db, done) => {
    const testParams = {
      statusCode: 400,
      sourceIdentifier: 'sourceIdentifier=pshr:passport:za|888888',
      targetSystem: '',
      severity: 'error',
      code: 'invalid',
      details: 'query not specific enough, more than one patient found'
    }

    requestAndAssertOperationOutcome(testParams, t, done)
  })
})
