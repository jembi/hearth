'use strict'

const tap = require('tap')
const fs = require('fs')
const request = require('request')

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const compositionTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createResource(t, fs.readFileSync('test/resources/Composition-1.json'), 'Composition', (err, ref1) => {
        t.error(err)

        test(() => {
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

tap.test('composition should be found with matching status', (t) => {
  compositionTestEnv(t, (done) => {
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
      t.equals(body.entry[0].resoruce.status, 'final')

      done()
    })
  })
})

tap.test('composition should be found with matching status', (t) => {
  compositionTestEnv(t, (done) => {
    request({
      url: `http://localhost:3447/fhir/Composition?status=preliminary`,
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
