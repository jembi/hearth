'use strict'
const tap = require('tap')
const request = require('request')

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let binaryTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createResource(t, env.testBinaryFiles().doc1, 'Binary', () => { // contenttype = application/json
        env.createResource(t, env.testBinaryFiles().doc2, 'Binary', () => { // contenttype = application/pdf
          env.createResource(t, env.testBinaryFiles().doc3, 'Binary', () => { // contenttype = application/pdf
            env.createResource(t, env.testBinaryFiles().doc4, 'Binary', () => { // contenttype = application/xml
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

tap.test('Binary - should return all results when there are no parameters', (t) => {
  // given
  binaryTestEnv(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equals(4, body.total, 'total should be four')
      t.equals('Bundle', body.resourceType, 'should return a Bundle')
      t.equals('Binary', body.entry[0].resource.resourceType, 'should return a resource of type Binary')
      t.equals('Binary', body.entry[1].resource.resourceType, 'should return a resource of type Binary')
      t.equals('Binary', body.entry[2].resource.resourceType, 'should return a resource of type Binary')
      t.equals('Binary', body.entry[3].resource.resourceType, 'should return a resource of type Binary')
      done()
    })
  })
})

tap.test('Binary - should search by contentType', (t) => {
  // given
  binaryTestEnv(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary?contenttype=application/pdf',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equals(2, body.total, 'total should be two')
      t.equals('Bundle', body.resourceType, 'should return a Bundle')
      t.equals('Binary', body.entry[0].resource.resourceType, 'should return a resource of type Binary')
      t.equals('Binary', body.entry[1].resource.resourceType, 'should return a resource of type Binary')
      t.equals('application/pdf', body.entry[0].resource.contentType, 'should return a contentType of application/pdf')
      t.equals('application/pdf', body.entry[1].resource.contentType, 'should return a contentType of application/pdf')
      done()
    })
  })
})

tap.test('Binary - should search by contentType - none found', (t) => {
  // given
  binaryTestEnv(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary?contenttype=application/x-binary',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equals(0, body.total, 'total should be zero')
      t.equals('Bundle', body.resourceType, 'should return a Bundle')
      done()
    })
  })
})

tap.test('Binary - should fail for invalid Binary resource ID', (t) => {
  // given
  binaryTestEnv(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary/77ssssssssssssssssssssss',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      t.ok(body)
      t.equals('not-found', body.issue[0].code, 'should return binary "not-found"')
      t.equals('OperationOutcome', body.resourceType, 'should return a OperationOutcome')
      done()
    })
  })
})

tap.test('Binary - should search for a specific Binary document', (t) => {
  // given
  binaryTestEnv(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary?contenttype=application/xml',
      headers: headers,
      json: true
    }, (err, res, body) => {
      // then
      t.error(err)

      request({
        url: `http://localhost:3447/fhir/Binary/${body.entry[0].resource.id}`,
        headers: headers,
        json: true
      }, (err, res, body) => {
        // then
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.ok(body.content, 'should have field "content"')
        t.equals('Binary', body.resourceType, 'should return a resource of type Binary')
        t.equals('application/xml', body.contentType, 'should return a contentType of application/xml')
        done()
      })
    })
  })
})
