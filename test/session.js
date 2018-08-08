 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const hearth = require('../lib/server')
const tap = require('tap')
const request = require('request')
const config = require('../lib/config')
const sinon = require('sinon')

tap.test('Create session', withServer((t, server) => {
  const configStub = sinon.stub(config, 'getConf')
  configStub.withArgs('authentication:type').returns('jwt')
  configStub.withArgs('authentication:jwt').returns(null)
  configStub.withArgs('authentication:secret').returns('test secret')
  configStub.callThrough()

  t.tearDown(() => {
    configStub.restore()
    hearth.mongo.closeDB(logError)
  })

  const {port} = server.address()
  const requestOptions = {
    method: 'POST',
    url: {
      protocol: 'http:',
      hostname: 'localhost',
      pathname: '/api/session',
      port
    },
    json: true
  }

  t.test('should return 400 status when body contains no email', (t) => {
    const options = Object.assign({}, requestOptions, {
      json: {
        password: 'password'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 400)
      t.end()
    })
  })

  t.test('should return 400 status when body contains no password', (t) => {
    const options = Object.assign({}, requestOptions, {
      json: {
        email: 'test@example.com'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 400)
      t.end()
    })
  })

  t.test('should return 401 status when no user is found', (t) => {
    const options = Object.assign({}, requestOptions, {
      json: {
        email: 'test@example.com',
        password: 'password'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 401)
      t.end()
    })
  })

  t.test('should return 201 status when a session is created with backward compatible jwt config', withUser((t, user) => {
    const options = Object.assign({}, requestOptions, {
      json: {
        email: user.email,
        password: 'password'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 201)
      t.type(body.token, 'string')
      t.end()
    })
  }))

  t.test('should ereturn 201 status when a session is created with new jwt config - symmetric algorithm', withUser((t, user) => {
    configStub.withArgs('authentication:jwt').returns({
      algorithm: 'HS256',
      secret: 'new secret',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const options = Object.assign({}, requestOptions, {
      json: {
        email: user.email,
        password: 'password'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 201)
      t.type(body.token, 'string')
      t.end()
    })
  }))

  t.test('should ereturn 201 status when a session is created with new jwt config - asymmetric algorithm', withUser((t, user) => {
    configStub.withArgs('authentication:jwt').returns({
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
    const options = Object.assign({}, requestOptions, {
      json: {
        email: user.email,
        password: 'password'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 201)
      t.type(body.token, 'string')
      t.end()
    })
  }))

  t.test('should error when there is an invalid algorithm', withUser((t, user) => {
    configStub.withArgs('authentication:jwt').returns({
      algorithm: 'xyz',
      secret: 'new secret',
      issuer: 'hearth',
      setAudience: 'hearth:example-app1',
      validateAudience: '^hearth:example-app\\d+$'
    })
    const options = Object.assign({}, requestOptions, {
      json: {
        email: user.email,
        password: 'password'
      }
    })
    request(options, (err, res, body) => {
      t.error(err)
      t.equal(res.statusCode, 500)
      t.end()
    })
  }))

  t.end()
}))

function withServer (test) {
  return (t) => {
    const server = hearth.app.listen(() => {
      t.tearDown(() => {
        server.close()
      })
      test(t, server)
    })
  }
}

function withUser (test) {
  return (t) => {
    const user = {
      email: 'test@example.com',
      type: 'sysadmin',
      hash: 'a329837e2c11b806aa3c2ff0b9659a224d12aaa6fe6b35bbf42c8d1e81bbe26fbe0e44d47c33e9173a0242830f4749da63ea113bc4a2cb0ac65c90635ca26d36',
      salt: 'c5251bb1-3532-4abb-8b76-2d999c4a190d'
    }
    hearth.mongo.getDB((err, db) => {
      t.error(err)

      db.collection('user').insertOne(user, (err, res) => {
        t.error(err)

        const newUser = res.ops[0]

        t.tearDown(() => {
          db.collection('user').remove({_id: newUser._id}, logError)
        })

        test(t, newUser)
      })
    })
  }
}

function logError (err) {
  if (err) {
    console.error(err)
  }
}
