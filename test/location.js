/**
* Copyright (c) 2017-present, Jembi Health Systems NPC.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict'

const _ = require('lodash')
const tap = require('tap')
const request = require('request')

const env = require('./test-env/init')()
const server = require('../lib/server')
const locationTemplate = require('./resources/Location-1.json')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const setupTestEnv = (t, test) => {
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

tap.test('Location tests', { autoend: true }, (t) => {
  t.test('should use query builder to search on defined parameters', (t) => {
    setupTestEnv(t, (db, done) => {
      // given
      const findMe = _.cloneDeep(locationTemplate)
      const skipMe = _.cloneDeep(locationTemplate)
      delete findMe.id
      delete skipMe.id
      skipMe.name = 'Yellow wood clinic'
      env.createResource(t, findMe, 'Location', () => {
        env.createResource(t, skipMe, 'Location', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/Location?name=Greenwood',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(1, body.total, 'total should be one')
            t.equals(body.resourceType, 'Bundle', 'should return a Bundle')
            t.equals(body.entry[0].resource.resourceType, 'Location', 'should return a resource of type Location')
            t.equals(body.entry[0].resource.name, 'Greenwood Clinical Practice', 'should return resource with name Greenwood')
            done()
          })
        })
      })
    })
  })

  t.test('should support queries on all Locations', (t) => {
    setupTestEnv(t, (db, done) => {
      // given
      const location1 = _.cloneDeep(locationTemplate)
      const location2 = _.cloneDeep(locationTemplate)
      delete location1.id
      delete location2.id
      location2.name = 'Yellow wood clinic'
      env.createResource(t, location1, 'Location', () => {
        env.createResource(t, location2, 'Location', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/Location',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(2, body.total, 'total should be two')
            t.equals(body.resourceType, 'Bundle', 'should return a Bundle')
            t.equals(body.entry[0].resource.resourceType, 'Location', 'should return a resource of type Location')
            t.equals(body.entry[0].resource.name, 'Greenwood Clinical Practice', 'should return resource with name Greenwood')
            t.equals(body.entry[1].resource.resourceType, 'Location', 'should return a resource of type Location')
            t.equals(body.entry[1].resource.name, 'Yellow wood clinic', 'should return resource with name Greenwood')
            done()
          })
        })
      })
    })
  })

  t.test('should support _summary parameter on read', (t) => {
    setupTestEnv(t, (db, done) => {
      // given
      const location1 = _.cloneDeep(locationTemplate)
      delete location1.id
      env.createResource(t, location1, 'Location', (err, ref) => {
        t.error(err)

        // when
        request({
          url: `http://localhost:3447/fhir/Location/${ref.split('/').pop()}?_summary=true`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.name, 'Greenwood Clinical Practice', 'should return correct resource')

          t.notOk(body.telecom)
          t.notOk(body.address)
          t.notOk(body.position)

          done()
        })
      })
    })
  })

  t.test('should read hook should return all data when no _summary param is present', (t) => {
    setupTestEnv(t, (db, done) => {
      // given
      const location1 = _.cloneDeep(locationTemplate)
      delete location1.id
      env.createResource(t, location1, 'Location', (err, ref) => {
        t.error(err)

        // when
        request({
          url: `http://localhost:3447/fhir/Location/${ref.split('/').pop()}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(body.name, 'Greenwood Clinical Practice', 'should return correct resource')

          t.ok(body.telecom)
          t.ok(body.address)
          t.ok(body.position)

          done()
        })
      })
    })
  })

  t.test('should return 400 on unsupported parameter', (t) => {
    setupTestEnv(t, (db, done) => {
      // when
      request({
        url: 'http://localhost:3447/fhir/Location?notsupported=meh',
        headers: headers,
        json: true
      }, (err, res, body) => {
        // then
        t.error(err)

        t.equal(res.statusCode, 400, 'response status code should be 400')
        done()
      })
    })
  })
})
