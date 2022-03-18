/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

process.env.NODE_ENV = 'test'
require('../lib/init')

const conf = require('../lib/config')
const express = require('express')
const http = require('http')
const jwtAuthentication = require('../lib/security/jwt-authentication')()
const request = require('request')
const session = require('../lib/custom-api/session')
const tap = require('tap')
const { ObjectId } = require('mongodb')

function withServer (test) {
  return (t) => {
    const app = express()
    app.use(jwtAuthentication.authenticate)
    app.get('/', (req, res) => res.send(res.locals.authenticatedUser))

    const server = http.createServer(app)
    server.listen(() => {
      t.tearDown(() => {
        server.close()
      })
      test(t, server)
    })
  }
}

tap.test('JWT Authentication', withServer((t, server) => {
  const { port } = server.address()
  const requestOptions = {
    method: 'GET',
    url: {
      protocol: 'http:',
      hostname: 'localhost',
      port
    },
    json: true
  }

  t.test('should have 401 status when there is no authorization header', (t) => {
    request(requestOptions, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 401)
      t.end()
    })
  })

  t.test('should have 401 status when the authorization header is invalid', (t) => {
    const options = Object.assign({}, requestOptions, {
      headers: {
        Authorization: 'Basic c3lzYWRtaW5AamVtYmkub3JnOnN5c2FkbWlu'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 401)
      t.end()
    })
  })

  t.test('should have 401 status when the token is invalid using backwards compatible jwt config', (t) => {
    conf.setConf('authentication:jwt', null)
    conf.setConf('authentication:secret', 'test secret')
    const options = Object.assign({}, requestOptions, {
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InN5c2FkbWluQGplbWJpLm9yZyIsInR5cGUiOiJzeXNhZG1pbiIsImlhdCI6MTUwNzExNjM3NywiZXhwIjoxNTA3MjAyNzc3LCJpc3MiOiJIZWFydGgiLCJzdWIiOiJ1c2VyLzU5ZDQ5ZWQ1ZDM5YTMyMzA5ZDQ0NGM1ZiJ9.bA4bB7LD0j1nstE7V5ZHz2rtWe4RaAYWouKDfHnGX-g'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 401)
      t.end()
    })
  })

  t.test('should have 401 status when the token is invalid using new jwt config', (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'HS256',
      secret: 'new secret'
    })
    const options = Object.assign({}, requestOptions, {
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InN5c2FkbWluQGplbWJpLm9yZyIsInR5cGUiOiJzeXNhZG1pbiIsImlhdCI6MTUwNzExNjM3NywiZXhwIjoxNTA3MjAyNzc3LCJpc3MiOiJIZWFydGgiLCJzdWIiOiJ1c2VyLzU5ZDQ5ZWQ1ZDM5YTMyMzA5ZDQ0NGM1ZiJ9.bA4bB7LD0j1nstE7V5ZHz2rtWe4RaAYWouKDfHnGX-g'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 401)
      t.end()
    })
  })

  t.test('should have 200 status when the token is valid using backwards compatible jwt config', (t) => {
    conf.setConf('authentication:jwt', null)
    conf.setConf('authentication:secret', 'test secret')
    const user = {
      _id: new ObjectId(),
      email: 'sysadmin@jembi.org',
      type: 'sysadmin'
    }
    session.generateTokenForUser(user, (err, token) => {
      t.error(err)
      const options = Object.assign({}, requestOptions, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      request(options, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(body.email, user.email)
        t.equal(body.type, user.type)
        t.end()
      })
    })
  })

  t.test('should have 200 status when the token is valid using new jwt config and symmetric algorithms', (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'HS256',
      secret: 'new secret',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const user = {
      _id: new ObjectId(),
      email: 'sysadmin@jembi.org',
      type: 'sysadmin'
    }
    session.generateTokenForUser(user, (err, token) => {
      t.error(err)
      const options = Object.assign({}, requestOptions, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      request(options, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(body.email, user.email)
        t.equal(body.type, user.type)
        t.end()
      })
    })
  })

  t.test('should have 200 status when the token is valid using new jwt config and asymmetric algorithms', (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'RS256',
      pubKey: 'test/resources/jwt-certs/pubKey.pem',
      privKey: 'test/resources/jwt-certs/privKey.pem',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const user = {
      _id: new ObjectId(),
      email: 'sysadmin@jembi.org',
      type: 'sysadmin'
    }
    session.generateTokenForUser(user, (err, token) => {
      t.error(err)
      const options = Object.assign({}, requestOptions, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      request(options, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 200)
        t.equal(body.email, user.email)
        t.equal(body.type, user.type)
        t.end()
      })
    })
  })

  t.test('should have 500 status when public key path is invalid using new jwt config and asymmetric algorithms', (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'RS256',
      pubKey: 'test/resources/jwt-certs/pubKey.pem',
      privKey: 'test/resources/jwt-certs/privKey.pem',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const user = {
      _id: new ObjectId(),
      email: 'sysadmin@jembi.org',
      type: 'sysadmin'
    }
    session.generateTokenForUser(user, (err, token) => {
      t.error(err)
      const options = Object.assign({}, requestOptions, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      conf.setConf('authentication:jwt:pubKey', 'test/resources/INVALID/pubKey.pem')

      request(options, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 500)
        t.end()
      })
    })
  })

  t.test("should have 401 status when the audience doesn't match", (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'HS256',
      secret: 'new secret',
      issuer: 'hearth',
      setAudience: 'hearth:example-app-xyz',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const user = {
      _id: new ObjectId(),
      email: 'sysadmin@jembi.org',
      type: 'sysadmin'
    }
    session.generateTokenForUser(user, (err, token) => {
      t.error(err)
      const options = Object.assign({}, requestOptions, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      request(options, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 401)
        t.end()
      })
    })
  })

  t.test("should have 401 status when the issuer doesn't match", (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'HS256',
      secret: 'new secret',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const user = {
      _id: new ObjectId(),
      email: 'sysadmin@jembi.org',
      type: 'sysadmin'
    }
    session.generateTokenForUser(user, (err, token) => {
      t.error(err)
      const options = Object.assign({}, requestOptions, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      conf.setConf('authentication:jwt:issuer', 'no-match')

      request(options, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 401)
        t.end()
      })
    })
  })

  t.test('should have 500 status when algorithm is invalid', (t) => {
    conf.setConf('authentication:jwt', {
      algorithm: 'xyz',
      secret: 'new secret',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const options = Object.assign({}, requestOptions, {
      headers: {
        Authorization: 'Bearer xyz'
      }
    })

    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 500)
      t.end()
    })
  })

  t.end()
}))
