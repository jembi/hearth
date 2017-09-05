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

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let CompositionTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createResource(t, env.testCompositions().doc1, 'Composition', (err, ref1) => {
        t.error(err)
        env.createResource(t, env.testCompositions().doc2, 'Composition', (err, ref2) => {
          t.error(err)
          env.createResource(t, env.testCompositions().doc3, 'Composition', (err, ref3) => {
            t.error(err)
            env.createResource(t, env.testCompositions().doc4, 'Composition', (err, ref4) => {
              t.error(err)
              test(db, [ref1, ref2, ref3, ref4], () => {
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
}

tap.test('Composition - should return all results when there are no parameters', (t) => {
  // given
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: 'http://localhost:3447/fhir/Composition',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equals(4, body.total, 'total should be four')
      t.equals('Bundle', body.resourceType, 'should return a Bundle')
      t.equals('Composition', body.entry[0].resource.resourceType, 'should return a resource of type Composition')
      t.equals('Composition', body.entry[1].resource.resourceType, 'should return a resource of type Composition')
      t.equals('Composition', body.entry[2].resource.resourceType, 'should return a resource of type Composition')
      t.equals('Composition', body.entry[3].resource.resourceType, 'should return a resource of type Composition')
      done()
    })
  })
})

tap.test('Composition - should fail for invalid Composition resource ID', (t) => {
  // given
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: 'http://localhost:3447/fhir/Composition/77ssssssssssssssssssssss',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      t.ok(body)
      t.equals('not-found', body.issue[0].code, 'should return binary "not-found"')
      t.equals('OperationOutcome', body.resourceType, 'should return a OperationOutcome')
      done()
    })
  })
})

tap.test('Composition - should fetch Composition for valid resource ID', (t) => {
  // given
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: 'http://localhost:3447/fhir/Composition',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)

      request({
        url: `http://localhost:3447/fhir/Composition/${body.entry[0].resource.id}`,
        headers: headers,
        json: true
      }, (err, res, resource) => {
        // then
        t.error(err)
        t.ok(body)

        t.equals(body.entry[0].resource.title, resource.title, 'should have the same title property"')
        done()
      })
    })
  })
})

tap.test('composition should be found with matching status', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?status=final`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equals(body.entry[0].resource.status, 'final')

      done()
    })
  })
})

tap.test('composition should not find any result with an unknown status', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?status=invalid`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 0, 'body should contain no results')

      done()
    })
  })
})

tap.test('composition should be found with matching section.entry reference', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?entry=Condition/stroke`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equals(body.entry[0].resource.identifier.value, '1')
      t.equals(body.entry[0].resource.section[0].entry[0].reference, 'Condition/stroke')

      done()
    })
  })
})

tap.test('composition should not find any result with an unknown section.entry reference', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?entry=invalid`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 0, 'body should contain no results')

      done()
    })
  })
})

tap.test('composition should be found matching multiple section.entry reference', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?entry=Condition/example-one&entry=Condition/example-two&entry=Condition/example-three`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equals(body.entry[0].resource.identifier.value, '22222')
      t.equals(body.entry[0].resource.section[0].entry[0].reference, 'Condition/example-one')

      done()
    })
  })
})

tap.test('multiple compositions should be found matching section.entry reference', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?entry=Condition/example-1`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain one result')
      t.equals(body.entry[0].resource.identifier.value, '3333333')
      t.equals(body.entry[0].resource.section[0].entry[0].reference, 'Condition/example-1')
      t.equals(body.entry[1].resource.identifier.value, '44444444')
      t.equals(body.entry[1].resource.section[0].entry[0].reference, 'Condition/example-1')

      done()
    })
  })
})

tap.test('composition should not be found when section.entry does not match both entry query parameters', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?entry=Condition/stroke&entry=undefined`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 0, 'body should contain one result')

      done()
    })
  })
})

tap.test('composition should be found with matching patient', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?patient=Patient/example-patient-id`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equals(body.entry[0].resource.subject.reference, 'Patient/example-patient-id')

      done()
    })
  })
})

tap.test('composition should be found with matching subject', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?subject=Patient/example-patient-id`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equals(body.entry[0].resource.subject.reference, 'Patient/example-patient-id')

      done()
    })
  })
})

tap.test('composition should not be found when subject.reference does not match the query parameter patient', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?patient=123`,
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

tap.test('composition should not be found when subject.reference does not match the query parameter subject', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?subject=123`,
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

tap.test('composition should find some results with a specific type', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?type=abc123def`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.ok(body)
      t.equals(body.total, 1)
      t.equal(body.entry[0].resource.type.coding[0].code, 'abc123def', 'body should contain record with type.code value of \'abc123def\'')

      done()
    })
  })
})

tap.test('composition should find zero results when type does not exist', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?type=noneexisting`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.ok(body)
      t.equals(body.total, 0)
      done()
    })
  })
})

tap.test('composition should find results with \'system\' and \'code\' being supplied in the type parameter', (t) => {
  CompositionTestEnv(t, (db, refs, done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?type=http://loinc.org|abc123def`,
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.ok(body)
      t.equals(body.total, 1)
      t.equal(body.entry[0].resource.type.coding[0].code, 'abc123def', 'body should contain record with type.code value of \'abc123def\'')

      done()
    })
  })
})
