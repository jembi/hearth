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
let server = require('../lib/server')
const config = require('../lib/config')
let basic

let serverTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      basic = _.cloneDeep(require('./resources/Basic-1.json'))
      delete basic.id

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

const runContentTypeTest = (t, contentType) => {
  serverTestEnv(t, (db, done) => {
    request.post({
      url: 'http://localhost:3447/fhir/Basic',
      headers: _.extend(
        env.getTestAuthHeaders(env.users.sysadminUser.email),
        {
          'content-type': contentType
        }
      ),
      body: JSON.stringify(basic)
    }, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 201, 'response status code should be 201')
      done()
    })
  })
}

tap.test('server - should support application/json content-type header', (t) => {
  runContentTypeTest(t, 'application/json')
})

tap.test('server - should support application/json content-type header with charset specified', (t) => {
  runContentTypeTest(t, 'application/json; charset=utf-8')
})

tap.test('server - should support application/json content-type header with charset specified (bad whitespace)', (t) => {
  runContentTypeTest(t, 'application/json ;charset=utf-8')
})

tap.test('server - should support application/json+fhir content-type header', (t) => {
  runContentTypeTest(t, 'application/json+fhir')
})

const runAcceptTest = (t, accept, expectAccept) => {
  if (!expectAccept) {
    expectAccept = accept
  }

  serverTestEnv(t, (db, done) => {
    request.post({
      url: 'http://localhost:3447/fhir/Basic',
      headers: _.extend(
        env.getTestAuthHeaders(env.users.sysadminUser.email),
        {
          'content-type': 'application/json+fhir'
        }
      ),
      body: JSON.stringify(basic)
    }, (err, res, body) => {
      t.error(err)

      request({
        url: `http://localhost:3447${res.headers.location}`,
        headers: _.extend(
          env.getTestAuthHeaders(env.users.sysadminUser.email),
          {
            'accept': accept
          }
        )
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 200, 'response status code should be 200')

        t.equal(res.headers['content-type'].split(';')[0], expectAccept, `response content-type should be equal to ${expectAccept}`)

        t.doesNotThrow(() => JSON.parse(body), 'response body should contain valid json content')
        t.equal(JSON.parse(body).resourceType, 'Basic', 'response body should contain valid fhir content')

        done()
      })
    })
  })
}

tap.test('server - should support application/json accept header', (t) => {
  runAcceptTest(t, 'application/json')
})

tap.test('server - should support application/json+fhir accept header', (t) => {
  runAcceptTest(t, 'application/json+fhir')
})

tap.test('server - should support */* accept header', (t) => {
  runAcceptTest(t, '*/*', 'application/json+fhir')
})

tap.test('server - should support multiple accept header values (*/*)', (t) => {
  runAcceptTest(t, 'text/html, application/xhtml+xml, application/xml, */*', 'application/json+fhir')
})

tap.test('server - should support multiple accept headers (application/json)', (t) => {
  runAcceptTest(t, 'text/html, application/xhtml+xml, application/json, */*', 'application/json')
})

tap.test('server - should support multiple accept headers (weighted application/json)', (t) => {
  runAcceptTest(t, 'text/html, application/json+fhir;q=0.1, application/json;q=0.9', 'application/json')
})

tap.test('server - should support multiple accept headers (weighted application/json+fhir)', (t) => {
  runAcceptTest(t, 'text/html, application/json+fhir;q=0.9, application/json;q=0.1', 'application/json+fhir')
})

tap.test('server - should respond with 406 Not Acceptable when accept not supported', (t) => {
  serverTestEnv(t, (db, done) => {
    request.post({
      url: 'http://localhost:3447/fhir/Basic',
      headers: _.extend(
        env.getTestAuthHeaders(env.users.sysadminUser.email),
        {
          'content-type': 'application/json+fhir'
        }
      ),
      body: JSON.stringify(basic)
    }, (err, res, body) => {
      t.error(err)

      request({
        url: `http://localhost:3447${res.headers.location}`,
        headers: _.extend(
          env.getTestAuthHeaders(env.users.sysadminUser.email),
          {
            'accept': 'application/xml+fhir'
          }
        )
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 406, 'response status code should be 406')
        done()
      })
    })
  })
})

tap.test('server - should respond with 406 Not Acceptable when accept not supported (multiple)', (t) => {
  serverTestEnv(t, (db, done) => {
    request.post({
      url: 'http://localhost:3447/fhir/Basic',
      headers: _.extend(
        env.getTestAuthHeaders(env.users.sysadminUser.email),
        {
          'content-type': 'application/json+fhir'
        }
      ),
      body: JSON.stringify(basic)
    }, (err, res, body) => {
      t.error(err)

      request({
        url: `http://localhost:3447${res.headers.location}`,
        headers: _.extend(
          env.getTestAuthHeaders(env.users.sysadminUser.email),
          {
            'accept': 'text/html, application/xhtml+xml, application/xml'
          }
        )
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 406, 'response status code should be 406')
        done()
      })
    })
  })
})

tap.test('server - should use application/json+fhir when no accept header present', (t) => {
  serverTestEnv(t, (db, done) => {
    request.post({
      url: 'http://localhost:3447/fhir/Basic',
      headers: _.extend(
        env.getTestAuthHeaders(env.users.sysadminUser.email),
        {
          'content-type': 'application/json+fhir'
        }
      ),
      body: JSON.stringify(basic)
    }, (err, res, body) => {
      t.error(err)

      request({
        url: `http://localhost:3447${res.headers.location}`,
        headers: env.getTestAuthHeaders(env.users.sysadminUser.email)
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 200, 'response status code should be 200')

        t.equal(res.headers['content-type'].split(';')[0], 'application/json+fhir', 'response content-type should be equal to application/json+fhir')

        t.doesNotThrow(() => JSON.parse(body), 'response body should contain valid json content')
        t.equal(JSON.parse(body).resourceType, 'Basic', 'response body should contain valid fhir content')

        done()
      })
    })
  })

  tap.test('server - should enable openhim-style authentication when correct config is set', (t) => {
    config.setConf('authentication:type', 'openhim-style')

    // invalidate server file require so we can require a fresh copy of the server
    // file. This is needed because the auth mechanism is set as soon as the server
    // file is required.
    delete require.cache[require.resolve('../lib/server')]
    delete require.cache[require.resolve('../lib/fhir/core')]
    delete require.cache[require.resolve('../lib/fhir/hooks')]
    server = require('../lib/server')

    serverTestEnv(t, (db, done) => {
      request.get({
        url: 'http://localhost:3447/fhir/Patient',
        headers: _.extend(
          env.getTestAuthHeaders(env.users.sysadminUser.email),
          {
            'content-type': 'application/json+fhir'
          }
        )
      }, (err, res) => {
        t.error(err)
        t.equals(res.statusCode, 200)
        done()
      })
    })
  })

  tap.test('server - should disable authentication when correct config is set', (t) => {
    config.setConf('authentication:type', 'disabled')

    // invalidate server file require so we can require a fresh copy of the server
    // file. This is needed because the auth mechanism is set as soon as the server
    // file is required.
    delete require.cache[require.resolve('../lib/server')]
    delete require.cache[require.resolve('../lib/fhir/core')]
    delete require.cache[require.resolve('../lib/fhir/hooks')]
    server = require('../lib/server')

    serverTestEnv(t, (db, done) => {
      request.get({
        url: 'http://localhost:3447/fhir/Patient',
        headers: {
          'content-type': 'application/json+fhir'
        }
      }, (err, res) => {
        t.error(err)
        t.equals(res.statusCode, 200)
        done()
      })
    })
  })

  tap.test('server - should default to an openhim-style authentication when an invalid config option is present', (t) => {
    config.setConf('authentication:type', 'not_valid')

    // invalidate server file require so we can require a fresh copy of the server
    // file. This is needed because the auth mechanism is set as soon as the server
    // file is required.
    delete require.cache[require.resolve('../lib/server')]
    delete require.cache[require.resolve('../lib/fhir/core')]
    delete require.cache[require.resolve('../lib/fhir/hooks')]
    server = require('../lib/server')

    serverTestEnv(t, (db, done) => {
      request.get({
        url: 'http://localhost:3447/fhir/Patient',
        headers: _.extend(
          env.getTestAuthHeaders(env.users.sysadminUser.email),
          {
            'content-type': 'application/json+fhir'
          }
        )
      }, (err, res) => {
        t.error(err)
        t.equals(res.statusCode, 200)
        done()
      })
    })
  })

  tap.test('server - should default to an openhim-style authentication when no config option is present', (t) => {
    config.setConf('authentication:type', undefined)

    // invalidate server file require so we can require a fresh copy of the server
    // file. This is needed because the auth mechanism is set as soon as the server
    // file is required.
    delete require.cache[require.resolve('../lib/server')]
    delete require.cache[require.resolve('../lib/fhir/core')]
    delete require.cache[require.resolve('../lib/fhir/hooks')]
    server = require('../lib/server')

    serverTestEnv(t, (db, done) => {
      request.get({
        url: 'http://localhost:3447/fhir/Patient',
        headers: _.extend(
          env.getTestAuthHeaders(env.users.sysadminUser.email),
          {
            'content-type': 'application/json+fhir'
          }
        )
      }, (err, res) => {
        t.error(err)
        t.equals(res.statusCode, 200)
        done()
      })
    })
  })
})
