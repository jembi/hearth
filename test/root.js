'use strict'
const tap = require('tap')
const request = require('request')
const _ = require('lodash')

const env = require('./test-env/init')()
const server = require('../lib/server')
const testTransaction = require('./resources/Transaction-1.json')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let testEnv = (t, test) => {
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

tap.test('Transaction should process all entries correctly', (t) => {
  // given
  testEnv(t, (db, done) => {
    // when
    request({
      url: 'http://localhost:3447/fhir',
      method: 'POST',
      headers: headers,
      body: _.cloneDeep(testTransaction),
      json: true
    }, (err, res, body) => {
      t.error(err)
      console.log(JSON.stringify(body, null, 2))
      t.equals(res.statusCode, 200, 'should return a 200 status')
      done()
    })
  })
})
