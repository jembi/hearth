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

let docRefTestEnv = (t, test) => {
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
              env.createPatient(t, patients.charlton, () => {
                env.createPatient(t, patients.emmarentia, () => {
                  const docRef = _.cloneDeep(require('./resources/DocumentReference-1'))
                  const docRef2 = _.cloneDeep(require('./resources/DocumentReference-1'))
                  docRef.subject.reference = patients.charlton.resource
                  docRef.author[0].reference = pracs.alison.resource
                  docRef2.subject.reference = patients.emmarentia.resource
                  docRef2.author[0].reference = pracs.henry.resource
                  docRef2.indexed = '2014-03-22T17:00:20+02:00'
                  docRef2.class.coding[0].code = '47039-3'
                  docRef2.class.coding[0].display = 'Inpatient Admission history and physical note'
                  docRef2.context.period.start = '2014-02-22T10:00:00+02:00'
                  docRef2.context.period.end = '2014-02-22T11:00:00+02:00'

                  env.createResource(t, docRef, 'DocumentReference', (err, ref) => {
                    t.error(err)
                    env.createResource(t, docRef2, 'DocumentReference', (err, ref2) => {
                      t.error(err)
                      test(db, patients, pracs, orgs, [ref, ref2], () => {
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
}

tap.test('document reference should support searches on patient reference', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: `http://localhost:3447/fhir/DocumentReference?patient=${patients.charlton.resource}`,
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on patient identifier', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?patient.identifier=1007211154902',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on author first name', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?author.given=Alison',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on author last name', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?author.family=Tobi',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on status (matching)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?status=current',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on status (non-matching)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?status=superseded',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
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

tap.test('document reference should support searches on class', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?class=34117-2',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on class with system', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?class=http%3A%2F%2Fhl7.org%2Ffhir%2FValueSet%2Fc80-doc-classcodes|34117-2',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on type', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?type=History+and+Physical',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on setting', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?setting=General+Medicine',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on facility', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?facility=225732001',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on event', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?event=ANNGEN',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on security label', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?securityLabel=N',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on format', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?format=urn:ihe:pcc:handp:2008',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on related-id', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?related-id=docRef2',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ymd)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=2013-07-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (eq y)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=eq2013',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ge ymd)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=ge2014-02-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[1], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (le ymd)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=le2014-02-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ge and le ymd)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=ge2013-05-01&indexed=le2014-02-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ge and le y)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=ge2013&indexed=le2014',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ge and le ym)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=ge2013-07&indexed=le2014-03',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ge and le ymdhm)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=ge2013-07-01T23:11:00%2B02:00&indexed=le2013-07-01T23:12:00%2B02:00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (ge and le ymdhm - no match)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=ge2013-07-01T23%3A12%3A00%2B02%3A00&indexed=le2013-07-01T23%3A13%3A00%2B02%3A00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
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

tap.test('document reference should support searches on indexed date (eq ymdhm)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=eq2013-07-01T23%3A11%2B02%3A00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (eq ymdhm - no match)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=eq2013-07-01T23%3A12%2B02%3A00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
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

tap.test('document reference should support searches on indexed date (eq ymdhms)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=eq2013-07-01T23%3A11%3A33%2B02%3A00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on indexed date (eq ymdhms - no match)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?indexed=eq2013-07-01T23%3A11%3A34%2B02%3A00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
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

tap.test('document reference should support searches on period (ymdhm)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?period=2004-12-23T09:00:00%2B02%3A00',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on period (gt lt ymd - 1 match)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?period=gt2004-01-01&period=lt2014-01-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(`DocumentReference/${body.entry[0].resource.id}`, docRefs[0], 'body should contain correct match')
      done()
    })
  })
})

tap.test('document reference should support searches on period (gt lt ymd - 2 matches)', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?period=gt2004-01-01&period=lt2016-01-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two result')
      done()
    })
  })
})

// TODO change this to a bad request outcome when the functionality is implemented
tap.test('document reference search should respond with an error outcome if unsupported prefix is used', (t) => {
  docRefTestEnv(t, (db, patients, pracs, orgs, docRefs, done) => {
    request({
      url: 'http://localhost:3447/fhir/DocumentReference?period=xy2004-01-01',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 500, 'response status code should be 500')
      t.ok(body)
      t.equal(body.resourceType, 'OperationOutcome', 'result should be an operation outcome')
      done()
    })
  })
})
