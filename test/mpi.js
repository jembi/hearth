const tap = require('tap')
const request = require('request')

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const basicMpiTest = (t, test) => {
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

const bodyTemplate = {
  resourceType: 'Parameters',
  parameter: [
    {
      name: 'resource',
      resource: {
        resourceType: 'Binary'
      }
    }
  ]
}

tap.test('should return 400 if posted parameters resourceType is not of type Parameters', (t) => {
  // Given
  const testBody = Object.assign({}, bodyTemplate)
  testBody.resourceType = 'Patient'
  basicMpiTest(t, (db, done) => {
    // When
    request({
      url: `http://localhost:3447/fhir/Patient/$match`,
      method: 'POST',
      body: testBody,
      headers: headers,
      json: true
    }, (err, res, body) => {
      // Then
      t.error(err)
      t.equal(res.statusCode, 400, 'response status code should be 400')
      t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
      t.equal(body.issue[0].severity, 'error')
      t.equal(body.issue[0].code, 'invalid')
      t.equal(body.issue[0].details.text, 'Expected Parameters resource type')
      done()
    })
  })
})

tap.test('should return 400 if posted parameters resourceType does not match url resourceType', (t) => {
  // Given
  const testBody = Object.assign({}, bodyTemplate)
  basicMpiTest(t, (db, done) => {
    // When
    request({
      url: `http://localhost:3447/fhir/Patient/$match`,
      method: 'POST',
      body: testBody,
      headers: headers,
      json: true
    }, (err, res, body) => {
      // Then
      t.error(err)
      t.equal(res.statusCode, 400, 'response status code should be 400')
      t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
      t.equal(body.issue[0].severity, 'error')
      t.equal(body.issue[0].code, 'invalid')
      t.equal(body.issue[0].details.text, 'Invalid resource type')
      done()
    })
  })
})

tap.test('should return 400 if posted parameters resource resourceType does not have matching config', (t) => {
  // Given
  const testBody = Object.assign({}, bodyTemplate)
  basicMpiTest(t, (db, done) => {
    // When
    request({
      url: `http://localhost:3447/fhir/Binary/$match`,
      method: 'POST',
      body: testBody,
      headers: headers,
      json: true
    }, (err, res, body) => {
      // Then
      t.error(err)
      t.equal(res.statusCode, 400, 'response status code should be 400')
      t.equal(body.resourceType, 'OperationOutcome', 'Reponse body should be an Operation Outcome')
      t.equal(body.issue[0].severity, 'error')
      t.equal(body.issue[0].code, 'invalid')
      t.equal(body.issue[0].details.text, 'Match operation not supported on resource type')
      done()
    })
  })
})
