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

  t.test('should return 201 status when a session is created', withUser((t, user) => {
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
