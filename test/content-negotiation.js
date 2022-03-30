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
const libxmljs = require('libxmljs')
const FHIR = require('fhir')

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

tap.test('server should reject requests that arent apart of the accepted contentTypes list', (t) => {
  basicPatientTest(t, (db, done) => {
    const updatedHeaders = _.assign({ accept: ['text/turtle'] }, headers) // not yet supported

    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902',
      headers: updatedHeaders
    }, (err, res, body) => {
      t.error(err)

      t.ok(body)
      t.equal(res.statusCode, 406, 'response status code should be 200')
      t.equals(body, 'Not Acceptable')

      done()
    })
  })
})

tap.test('patient should support searches on identifier and return the payload in XML', (t) => {
  basicPatientTest(t, (db, done) => {
    const updatedHeaders = _.assign({ accept: ['application/xml', 'application/xml+fhir'] }, headers)

    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902',
      headers: updatedHeaders
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.notOk(body.resourceType, 'should have a resourceType property as the response is XML')

      const xmlDoc = libxmljs.parseXml(body)
      const namespace = 'http://hl7.org/fhir'

      // xpath queries
      const xmlValues = {
        total: xmlDoc.get('//xmlns:total', namespace).attr('value').value(),
        identifier: xmlDoc.get('//xmlns:identifier[1]/xmlns:value', namespace).attr('value').value(),
        familyName: xmlDoc.get('//xmlns:Patient[1]/xmlns:name/xmlns:family', namespace).attr('value').value()
      }

      t.equal(xmlDoc.errors.length, 0, 'should not have any XML errors')
      t.equal(xmlValues.total, '1', 'body should contain one result')
      t.equal(xmlValues.identifier, '1007211154902', 'body should contain the matching patient - identifier')
      t.equal(xmlValues.familyName, 'Matinyana', 'body should contain the matching patient - family name')
      done()
    })
  })
})

tap.test('patient should respond with en empty searchset if no matches and return the payload in XML', (t) => {
  basicPatientTest(t, (db, done) => {
    const updatedHeaders = _.assign({ accept: ['application/xml', 'application/xml+fhir'] }, headers)

    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=NOTTHERE',
      headers: updatedHeaders
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.notOk(body.resourceType, 'should have a resourceType property as the response is XML')

      const xmlDoc = libxmljs.parseXml(body)
      const namespace = 'http://hl7.org/fhir'

      // xpath queries
      const xmlValues = {
        total: xmlDoc.get('//xmlns:total', namespace).attr('value').value()
      }

      t.equal(xmlDoc.errors.length, 0, 'should not have any XML errors')
      t.equal(xmlValues.total, '0', 'should have a total of 0')
      done()
    })
  })
})

tap.test('patient should be saved correctly when body is in XML format', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      const fhir = new FHIR(FHIR.DSTU2)
      const patientXML = fhir.JsonToXml(JSON.stringify(pat))

      const updatedHeaders = _.assign({ accept: ['application/xml', 'application/xml+fhir'], 'Content-Type': 'application/xml' }, headers)

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: updatedHeaders,
        body: patientXML
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

tap.test('_format parameter support', { autoend: true }, (t) => {
  t.test('should reject requests using the _format param that arent a part of the accepted contentTypes list', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&_format=text/turtle',
        headers: headers
      }, (err, res, body) => {
        t.error(err)

        t.ok(body)
        t.equal(res.statusCode, 406, 'response status code should be 200')
        t.equals(body, 'Not Acceptable')

        done()
      })
    })
  })

  t.test('should support _format param and return the payload in XML', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&_format=application/fhir%2Bxml',
        headers: headers
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.notOk(body.resourceType, 'should have a resourceType property as the response is XML')

        const xmlDoc = libxmljs.parseXml(body)
        const namespace = 'http://hl7.org/fhir'

        // xpath queries
        const xmlValues = {
          total: xmlDoc.get('//xmlns:total', namespace).attr('value').value(),
          identifier: xmlDoc.get('//xmlns:identifier[1]', namespace).get('//xmlns:value', namespace).attr('value').value(),
          familyName: xmlDoc.get('//xmlns:Patient[1]/xmlns:name/xmlns:family', namespace).attr('value').value()
        }

        t.equal(xmlDoc.errors.length, 0, 'should not have any XML errors')
        t.equal(xmlValues.total, '1', 'body should contain one result')
        t.equal(xmlValues.identifier, '1007211154902', 'body should contain the matching patient - identifier')
        t.equal(xmlValues.familyName, 'Matinyana', 'body should contain the matching patient - family name')
        done()
      })
    })
  })

  t.test('should support _format param and return the payload in JSON', (t) => {
    basicPatientTest(t, (db, done) => {
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&_format=application/fhir%2Bjson',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equals(body.resourceType, 'Bundle', 'should have a resourceType property as JSON')
        t.equal(body.total, 1, 'body should contain one result')
        t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient - identifier')
        t.equal(body.entry[0].resource.name[0].family[0], 'Matinyana', 'body should contain the matching patient - family name')
        done()
      })
    })
  })
})
