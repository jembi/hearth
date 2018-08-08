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
const {ObjectId} = require('mongodb')

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
  const {port} = server.address()
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
    conf.setConf('authentication:jwt', null)
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

  t.test('should have 401 status when the token is invalid', (t) => {
    conf.setConf('authentication:jwt', null)
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
      pubKey: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDdlatRjRjogo3WojgGHFHYLugd
UWAY9iR3fy4arWNA1KoS8kVw33cJibXr8bvwUAUparCwlvdbH6dvEOfou0/gCFQs
HUfQrSDv+MuSUMAe8jzKE4qW+jK+xQU9a03GUnKHkkle+Q0pX/g6jXZ7r1/xAK5D
o2kQ+X5xK9cipRgEKwIDAQAB
-----END PUBLIC KEY-----`,
      privKey: `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQDdlatRjRjogo3WojgGHFHYLugdUWAY9iR3fy4arWNA1KoS8kVw
33cJibXr8bvwUAUparCwlvdbH6dvEOfou0/gCFQsHUfQrSDv+MuSUMAe8jzKE4qW
+jK+xQU9a03GUnKHkkle+Q0pX/g6jXZ7r1/xAK5Do2kQ+X5xK9cipRgEKwIDAQAB
AoGAD+onAtVye4ic7VR7V50DF9bOnwRwNXrARcDhq9LWNRrRGElESYYTQ6EbatXS
3MCyjjX2eMhu/aF5YhXBwkppwxg+EOmXeh+MzL7Zh284OuPbkglAaGhV9bb6/5Cp
uGb1esyPbYW+Ty2PC0GSZfIXkXs76jXAu9TOBvD0ybc2YlkCQQDywg2R/7t3Q2OE
2+yo382CLJdrlSLVROWKwb4tb2PjhY4XAwV8d1vy0RenxTB+K5Mu57uVSTHtrMK0
GAtFr833AkEA6avx20OHo61Yela/4k5kQDtjEf1N0LfI+BcWZtxsS3jDM3i1Hp0K
Su5rsCPb8acJo5RO26gGVrfAsDcIXKC+bQJAZZ2XIpsitLyPpuiMOvBbzPavd4gY
6Z8KWrfYzJoI/Q9FuBo6rKwl4BFoToD7WIUS+hpkagwWiz+6zLoX1dbOZwJACmH5
fSSjAkLRi54PKJ8TFUeOP15h9sQzydI8zJU+upvDEKZsZc/UhT/SySDOxQ4G/523
Y0sz/OZtSWcol/UMgQJALesy++GdvoIDLfJX5GBQpuFgFenRiRDabxrE9MNUZ2aP
FaFp+DyAe+b4nDwuJaW2LURbr8AEZga7oQj0uYxcYw==
-----END RSA PRIVATE KEY-----`,
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
        Authorization: `Bearer xyz`
      }
    })

    conf.setConf('authentication:jwt:issuer', 'no-match')

    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 500)
      t.end()
    })
  })

  t.end()
}))
