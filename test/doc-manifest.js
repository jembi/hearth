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
const _ = require('lodash')

const env = require('./test-env/init')()
const server = require('../lib/server')
const testDocManifest = require('./resources/DocumentManifest-1.json')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const docManifestTestEnv = (t, test) => {
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

tap.test('DocumentManifest - should return all results when there are no parameters', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe1 = _.cloneDeep(testDocManifest)
    delete findMe1.id
    const findMe2 = _.cloneDeep(testDocManifest)
    delete findMe2.id
    env.createResource(t, findMe1, 'DocumentManifest', () => {
      env.createResource(t, findMe2, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 2, 'total should be two')
          t.equals(body.resourceType, 'Bundle', 'should return a Bundle')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[1].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by author reference', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.author[0].reference = 'Device/12345'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?author=Device/12345',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.author[0].reference, 'Device/12345', 'should have the correct author value')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by content-ref reference', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.content[0].pReference.reference = 'DocumentReference/54321'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?content-ref=DocumentReference/54321',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.content[0].pReference.reference, 'DocumentReference/54321', 'should have the correct content-ref value')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should support searches on created date (ymd)', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.created = '2013-07-01'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?created=2013-07-01',
          headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
          t.equal(body.total, 1, 'body should contain one result')
          t.equals(body.entry[0].resource.created, '2013-07-01', 'should have correct created date')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by description', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.description = 'Random Description for Manifest'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?description=Random Description for Manifest',
          headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.description, 'Random Description for Manifest', 'should have correct description')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by identifier', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.identifier[0].system = 'sample-system'
    findMe.identifier[0].value = 'randomnumber-1234567'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?identifier=sample-system|randomnumber-1234567',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.identifier[0].system, 'sample-system', 'should have the correct identifier system')
          t.equals(body.entry[0].resource.identifier[0].value, 'randomnumber-1234567', 'should have the correct identifier value')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by subject for the supplied patient parameter', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.subject.reference = 'Patient/123'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?patient=Patient/123',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.subject.reference, 'Patient/123', 'should have a subject of Patient/123')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by recipient reference', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.recipient[0].reference = 'Patient/12345'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?recipient=Patient/12345',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.recipient[0].reference, 'Patient/12345', 'should have the correct recipient value')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by related-id reference', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.related[0].identifier.system = 'sample-system'
    findMe.related[0].identifier.value = 'randomnumber-1234567'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          // url: 'http://localhost:3447/fhir/DocumentManifest?related-id=sample-system|randomnumber-1234567',
          url: 'http://localhost:3447/fhir/DocumentManifest?related-id=sample-system|randomnumber-1234567',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.related[0].identifier.system, 'sample-system', 'should have the correct related system')
          t.equals(body.entry[0].resource.related[0].identifier.value, 'randomnumber-1234567', 'should have the correct related value')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by related-ref reference', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.related[0].ref.reference = 'DocumentReference/54321'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?related-ref=DocumentReference/54321',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.related[0].ref.reference, 'DocumentReference/54321', 'should have the correct related-ref value')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by source', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.source = 'random:source:uri:value'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?source=random:source:uri:value',
          headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.source, 'random:source:uri:value', 'should have correct source')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by status', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.status = 'superseded'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?status=superseded',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.status, 'superseded', 'should have correct status')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by subject for the supplied subject parameter', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.subject.reference = 'Patient/123'
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?subject=Patient/123',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.subject.reference, 'Patient/123', 'should have a subject of Patient/123')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by type', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    findMe.type = {
      coding: [
        {
          system: 'otherSys',
          code: 'otherCode'
        }, {
          system: 'testSys',
          code: 'testCode'
        }
      ],
      text: 'a test code'
    }
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?type=testSys|testCode',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 1, 'total should be one')
          t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
          t.equals(body.entry[0].resource.type.coding[1].system, 'testSys', 'should have correct type system')
          t.equals(body.entry[0].resource.type.coding[1].code, 'testCode', 'should have correct type code')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by patient.identifier', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const testPatients = env.testPatients()
    const findMe = _.cloneDeep(testDocManifest)
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createPatient(t, testPatients.charlton, () => {
      findMe.subject.reference = `Patient/${testPatients.charlton.patient.id}`
      env.createResource(t, findMe, 'DocumentManifest', () => {
        env.createResource(t, skipMe, 'DocumentManifest', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/DocumentManifest?patient.identifier=pshr:sanid|1007211154902',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(body.total, 1, 'total should be one')
            t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
            t.equals(body.entry[0].resource.subject.reference, `Patient/${testPatients.charlton.patient.id}`, 'should have correct subject reference')
            done()
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by patient.identifier and return multiple documents for multiple matching patients', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const testPatients = env.testPatients()
    const findMe1 = _.cloneDeep(testDocManifest)
    delete findMe1.id
    const findMe2 = _.cloneDeep(testDocManifest)
    delete findMe2.id
    env.createPatient(t, testPatients.charlton, () => {
      findMe1.subject.reference = `Patient/${testPatients.charlton.patient.id}`
      env.createPatient(t, testPatients.emmarentia, () => {
        findMe2.subject.reference = `Patient/${testPatients.emmarentia.patient.id}`
        env.createResource(t, findMe1, 'DocumentManifest', () => {
          env.createResource(t, findMe2, 'DocumentManifest', () => {
            // when
            request({
              url: 'http://localhost:3447/fhir/DocumentManifest?patient.identifier=pshr:passport:za|1001113333933',
              headers: headers,
              json: true
            }, (err, res, body) => {
              // then
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equals(body.total, 2, 'total should be two')
              done()
            })
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by patient.identifier and return no results if the reference doesn\'t exist', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = _.cloneDeep(testDocManifest)
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?patient.identifier=pshr:sanid|no-exist',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.total, 0, 'total should be zero')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by author.given', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const testPractitioners = env.testPractitioners()
    const testOrganizations = env.testOrganizations()
    const findMe = _.cloneDeep(testDocManifest)
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createPractitioner(t, testPractitioners.alison, testOrganizations.greenwood, () => {
      findMe.author.push({ reference: `Practitioner/${testPractitioners.alison.practitioner.id}` })
      env.createResource(t, findMe, 'DocumentManifest', () => {
        env.createResource(t, skipMe, 'DocumentManifest', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/DocumentManifest?author.given=Alison',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(body.total, 1, 'total should be one')
            t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
            t.equals(body.entry[0].resource.author[1].reference, `Practitioner/${testPractitioners.alison.practitioner.id}`, 'should have correct author reference')
            done()
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by author.family', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const testPractitioners = env.testPractitioners()
    const testOrganizations = env.testOrganizations()
    const findMe = _.cloneDeep(testDocManifest)
    delete findMe.id
    const skipMe = _.cloneDeep(testDocManifest)
    delete skipMe.id
    env.createPractitioner(t, testPractitioners.alison, testOrganizations.greenwood, () => {
      findMe.author.push({ reference: `Practitioner/${testPractitioners.alison.practitioner.id}` })
      env.createResource(t, findMe, 'DocumentManifest', () => {
        env.createResource(t, skipMe, 'DocumentManifest', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/DocumentManifest?author.family=Tobi',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(body.total, 1, 'total should be one')
            t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'should return a resource of type DocumentManifest')
            t.equals(body.entry[0].resource.author[1].reference, `Practitioner/${testPractitioners.alison.practitioner.id}`, 'should have correct author reference')
            done()
          })
        })
      })
    })
  })
})
