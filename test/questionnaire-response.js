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

const QuestionnaireResponse = require('./resources/QuestionnaireResponse-1.json')

const basicQuestionnaireResponseTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const questionnaire1 = _.cloneDeep(QuestionnaireResponse)
      delete questionnaire1.id

      const questionnaire2 = _.cloneDeep(QuestionnaireResponse)
      delete questionnaire2.id
      questionnaire2.questionnaire.reference = 'Questionnaire/2'
      questionnaire2.encounter.reference = 'Encounter/2'

      env.createResource(t, questionnaire1, 'QuestionnaireResponse', (err) => {
        t.error(err)

        env.createResource(t, questionnaire2, 'QuestionnaireResponse', (err) => {
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
    })
  })
}

tap.test('QuestionnaireResponse should return all QuestionnaireResponse documents when no search parameters supplied', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      t.equal(body.entry[0].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[0].resource.questionnaire.reference, 'Questionnaire/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[1].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[1].resource.questionnaire.reference, 'Questionnaire/2', 'body should contain the matching QuestionnaireResponse')
      done()
    })
  })
})

tap.test('QuestionnaireResponse should support searches on patient', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse?patient=Patient/1',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 2, 'body should contain two results')
      t.equal(body.entry[0].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[0].resource.questionnaire.reference, 'Questionnaire/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[1].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[1].resource.questionnaire.reference, 'Questionnaire/2', 'body should contain the matching QuestionnaireResponse')
      done()
    })
  })
})

tap.test('QuestionnaireResponse should support searches on questionnaire', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse?questionnaire=Questionnaire/1',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[0].resource.questionnaire.reference, 'Questionnaire/1', 'body should contain the matching QuestionnaireResponse')
      done()
    })
  })
})

tap.test('QuestionnaireResponse should support searches on encounter', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse?encounter=Encounter/1',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[0].resource.questionnaire.reference, 'Questionnaire/1', 'body should contain the matching QuestionnaireResponse')
      done()
    })
  })
})

tap.test('QuestionnaireResponse should support multiple search parameters on encounter', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse?encounter=Encounter/1&patient=Patient/1&questionnaire=Questionnaire/1',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[0].resource.questionnaire.reference, 'Questionnaire/1', 'body should contain the matching QuestionnaireResponse')
      done()
    })
  })
})

tap.test('QuestionnaireResponse should the _summary parameter and return summarized data', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse?encounter=Encounter/1&_summary=true',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.subject.reference, 'Patient/1', 'body should contain the matching QuestionnaireResponse')
      t.equal(body.entry[0].resource.questionnaire.reference, 'Questionnaire/1', 'body should contain the matching QuestionnaireResponse')

      t.notOk(body.entry[0].resource.group, 'Should not have the group object on the response resource')
      done()
    })
  })
})

tap.test('should respond with bad request OperationOutcome if unsupported query parameter used', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/QuestionnaireResponse?language=notsupported',
      headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 400, 'response status code should be 400')
      t.ok(body)
      t.equal(body.resourceType, 'OperationOutcome', 'result should be an OperationOutcome')
      t.equal(body.issue[0].severity, 'error', 'outcome severity should be \'error\'')
      done()
    })
  })
})

tap.test('QuestionnaireResponse should be saved correctly', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const questionnaireresponse = _.cloneDeep(QuestionnaireResponse)
      delete questionnaireresponse.id

      request.post({
        url: 'http://localhost:3447/fhir/QuestionnaireResponse',
        headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
        body: questionnaireresponse,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201, 'response status code should be 201')

        t.ok(res.headers.location, 'should have a location header set')
        t.match(res.headers.location, /\/fhir\/QuestionnaireResponse\/[\w-]+\/_history\/[\w-]+/, 'should return a location with both id and vid present')

        const c = db.collection('QuestionnaireResponse')
        c.findOne((err, result) => {
          t.error(err)
          t.ok(result, 'result should exist in the mongo')

          t.equal(result.questionnaire.reference, 'Questionnaire/1', 'should have correct questionnaire reference')

          t.ok(result.meta, 'should have meta set')
          t.ok(result.meta.lastUpdated, 'should have meta.lastUpdated set')
          t.ok(result.meta.versionId, 'should have meta.versionId set')
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

tap.test('QuestionnaireResponse endpoint should return an error for incorrect POST body (supplied ID property)', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const questionnaireresponse = _.cloneDeep(QuestionnaireResponse)

      request.post({
        url: 'http://localhost:3447/fhir/QuestionnaireResponse',
        headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
        body: questionnaireresponse,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 400, 'response status code should be 400')
        t.equal(body.resourceType, 'OperationOutcome', 'should return an operation outcome object')
        t.equal(body.issue[0].diagnostics, 'Specifying an id is not allowed on a create action', 'Should contain correct error message')

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

tap.test('QuestionnaireResponse should be read correctly', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    const c = db.collection('QuestionnaireResponse')
    c.findOne((err, result) => {
      t.error(err)
      t.ok(result, 'result should exist in the mongo')

      t.equal(result.questionnaire.reference, 'Questionnaire/1', 'should have correct questionnaire reference')

      request({
        url: `http://localhost:3447/fhir/QuestionnaireResponse/${result.id}`,
        headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'QuestionnaireResponse', 'result should be an QuestionnaireResponse')
        t.equal(body.id, result.id, 'result should have correct id')

        t.equal(body.questionnaire.reference, result.questionnaire.reference, 'result should have correct questionnaire reference')
        t.equal(body.subject.reference, result.subject.reference, 'result should have correct subject reference')
        t.equal(body.encounter.reference, result.encounter.reference, 'result should have correct encounter reference')
        done()
      })
    })
  })
})

tap.test('QuestionnaireResponse should be read correctly, and summarized when parameter supplied', (t) => {
  basicQuestionnaireResponseTest(t, (db, done) => {
    const c = db.collection('QuestionnaireResponse')
    c.findOne((err, result) => {
      t.error(err)
      t.ok(result, 'result should exist in the mongo')

      t.equal(result.questionnaire.reference, 'Questionnaire/1', 'should have correct questionnaire reference')

      request({
        url: `http://localhost:3447/fhir/QuestionnaireResponse/${result.id}?_summary=true`,
        headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'QuestionnaireResponse', 'result should be an QuestionnaireResponse')
        t.equal(body.id, result.id, 'result should have correct id')

        t.equal(body.questionnaire.reference, result.questionnaire.reference, 'result should have correct questionnaire reference')
        t.equal(body.subject.reference, result.subject.reference, 'result should have correct subject reference')
        t.equal(body.encounter.reference, result.encounter.reference, 'result should have correct encounter reference')

        t.notOk(body.group, 'Should not have the group object on the response resource')
        done()
      })
    })
  })
})
