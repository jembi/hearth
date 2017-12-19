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

const env = require('./test-env/init')()
let server = require('../lib/server')
const User = require('../lib/custom-api/user')
const config = require('../lib/config')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let basicUserTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createUser(t, env.testUsers().jane, () => {
        env.createUser(t, env.testUsers().john, () => {
          env.createUser(t, env.testUsers().locked, () => {
            env.createUser(t, env.testUsers().megan, () => {
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
    })
  })
}

tap.test('user should load the default user if it doesn\'t exist', (t) => {
  env.initDB(false, (err, db) => {
    t.error(err)
    const user = User(env.mongo())
    user.loadDefaultSysadmin((err) => {
      t.error(err)
      const user = db.collection('user')
      user.findOne({ email: 'sysadmin@jembi.org' }, (err, u) => {
        t.error(err)
        t.ok(u, 'the sysadmin user should exist')
        t.end()
      })
    })
  })
})

tap.test('user should return if sysadmin user already exists', (t) => {
  env.initDB(true, (err, db) => {
    t.error(err)
    const user = User(env.mongo())
    user.loadDefaultSysadmin((err) => {
      t.error(err)
      t.end()
    })
  })
})

tap.test('user should be able to authenticate', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/authenticate/jane@test.org',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.ok(body.salt, 'response should include a salt')
      t.ok(body.ts, 'response should include a server timestamp')
      done()
    })
  })
})

tap.test('user authenticate should return status 404 if user doesn\'t exist', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/authenticate/meh@test.org',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('user authenticate should return status 423 if user is locked', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/authenticate/locked@test.org',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 423, 'response status code should be 423')
      done()
    })
  })
})

tap.test('user should support reads on email', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user/jane@test.org',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equals(body.email, 'jane@test.org', 'the correct user should be returned')
      done()
    })
  })
})

tap.test('user read should return not found if the user doesn\'t exist', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user/meh@test.org',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 200')
      done()
    })
  })
})

tap.test('user should return forbidden if a normal user tries to read someone other than themselves', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user/bob@test.org',
      headers: env.getTestAuthHeaders('megan@test.org'),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 403, 'response status code should be 403')
      done()
    })
  })
})

tap.test('user should be created on a POST', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user',
      method: 'POST',
      headers: headers,
      body: {
        email: 'created@test.org',
        type: 'sysadmin',
        password: 'test'
      },
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equals(res.statusCode, 201, 'should respond with a status code of 201')
      const user = db.collection('user')
      user.findOne({ email: 'created@test.org' }, (err, u) => {
        t.error(err)

        t.ok(u, 'a user object should be returned')
        t.equals(u.type, 'sysadmin', 'type should be sysadmin')
        t.ok(u.hash, 'hash should be set')
        t.ok(u.salt, 'salt should be set')
        done()
      })
    })
  })
})

tap.test('user create should return conflict if user already exists', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user',
      method: 'POST',
      headers: headers,
      body: {
        email: 'jane@test.org',
        type: 'sysadmin',
        password: 'test'
      },
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equals(res.statusCode, 409, 'should respond with a status code of 409')
      done()
    })
  })
})

tap.test('user should be updated', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user/jane@test.org',
      method: 'PUT',
      headers: headers,
      body: {
        type: 'updated'
      },
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equals(res.statusCode, 200, 'should respond with a status code of 200')
      const user = db.collection('user')
      user.findOne({ email: 'jane@test.org' }, (err, u) => {
        t.error(err)

        t.ok(u, 'a user object should be returned')
        t.equals(u.type, 'updated', 'type should be updated')
        done()
      })
    })
  })
})

tap.test('user update should return 404 if the user isn\'t found', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user/meh@test.org',
      method: 'PUT',
      headers: headers,
      body: {
        type: 'updated'
      },
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equals(res.statusCode, 404, 'should respond with a status code of 200')
      done()
    })
  })
})

tap.test('user update should return 403 if a normal user tries to update someone other than themselves', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user/bob@test.org',
      method: 'PUT',
      headers: env.getTestAuthHeaders('megan@test.org'),
      body: {
        type: 'updated'
      },
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equals(res.statusCode, 403, 'should respond with a status code of 403')
      done()
    })
  })
})

tap.test('user should allow public user creation when config is set', (t) => {
  config.setConf('authentication:enablePublicUserCreation', true)

  // invalidate server file require so we can require a fresh copy of the server
  // file. This is needed because the auth option is set as soon as the server
  // file is required.
  delete require.cache[require.resolve('../lib/server')]
  delete require.cache[require.resolve('../lib/fhir/core')]
  delete require.cache[require.resolve('../lib/fhir/hooks')]
  delete require.cache[require.resolve('../lib/custom-api/user')]
  server = require('../lib/server')

  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user',
      method: 'POST', // NO auth headers
      body: {
        email: 'created@test.org',
        type: 'sysadmin',
        password: 'test'
      },
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equals(res.statusCode, 201, 'should respond with a status code of 201')
      const user = db.collection('user')
      user.findOne({ email: 'created@test.org' }, (err, u) => {
        t.error(err)

        t.ok(u, 'a user object should be returned')
        t.equals(u.type, 'sysadmin', 'type should be sysadmin')
        t.ok(u.hash, 'hash should be set')
        t.ok(u.salt, 'salt should be set')
        done()
      })
    })
  })
})

tap.test('user search should return user with matching resource parameter', (t) => {
  basicUserTest(t, (db, done) => {
    const c = db.collection('user')
    c.findOneAndUpdate({ email: 'jane@test.org' }, { $set: { resource: 'Practitioner/1234' } }, (err) => {
      t.error(err)

      request({
        url: 'http://localhost:3447/api/user?resource=Practitioner/1234',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equals(body.email, 'jane@test.org', 'the correct user should be returned')
        done()
      })
    })
  })
})

tap.test('user search should return 404 when no users found on supported query parameter', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user?resource=Practitioner/1234',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('user search should return 400 when query parameter not supported', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 400, 'response status code should be 400')
      done()
    })
  })
})

tap.test('user search should return 403 if the user searching does not have the allowUserManagement priviledge', (t) => {
  basicUserTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/api/user',
      headers: env.getTestAuthHeaders('megan@test.org'),
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 403, 'response status code should be 403')
      done()
    })
  })
})
