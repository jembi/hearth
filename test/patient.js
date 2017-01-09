'use strict'
const env = require('./test-env/init')()
const server = require('../lib/server')
const tap = require('tap')
const request = require('request')
const _ = require('lodash')

// TODO these test should use the test data provided by env
// They currently 'break the glass' so that permissions don't kick in
// (the test data used here are insufficient)

const headers = _.assign(
  env.getTestAuthHeaders(env.users.sysadminUser.email),
  {
    Category: 'http://hl7.org/fhir/security-label#break-the-glass; scheme="http://hl7.org/fhir/tag/security"; label="Break The Glass"'
  }
)

let basicPatientTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      let patient = _.cloneDeep(require('./resources/Patient-1.json'))
      delete patient.id

      let c = db.collection('Patient')
      c.insert({ latest: patient }, (err) => {
        t.error(err)

        // insert a second patient that should be filtered in searches
        patient.identifier[0].value = 'FILTER-ME'
        patient.name = [{ given: ['FILTER-ME'], family: ['FILTER-ME'] }]

        c.insertOne({ latest: patient }, (err, r) => {
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
  })
}

tap.test('patient should support searches on identifier', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('patient should support searches on identifier with a system specified', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=pshr:sanid|1007211154902',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('patient should respond with en empty searchset if no matches', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=NOTTHERE',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 0, 'body should contain zero results')
      done()
    })
  })
})

tap.test('patient should support basic given name searches', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?given=Charlton',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('patient should support basic family name searches', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?family=Matinyana',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('name searches should be case-insensitive', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?given=charlton',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('name searches should match the first part of the string', (t) => {
  basicPatientTest(t, (done) => {
    // search for 'cha' should match 'Charlton'
    request({
      url: 'http://localhost:3447/fhir/Patient?given=cha',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')
      done()
    })
  })
})

tap.test('should search on both given and family name', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?given=charlton&family=matinyana',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')

      // shouldn't match charlton - family name 'doe'
      request({
        url: 'http://localhost:3447/fhir/Patient?given=charlton&family=doe',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })
})

tap.test('should search on identifier and name', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&given=charlton',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 200, 'response status code should be 200')
      t.ok(body)
      t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
      t.equal(body.total, 1, 'body should contain one result')
      t.equal(body.entry[0].resource.identifier[0].value, '1007211154902', 'body should contain the matching patient')

      // shouldn't match charlton - search on different name
      request({
        url: 'http://localhost:3447/fhir/Patient?identifier=1007211154902&given=jane',
        headers: headers,
        json: true
      }, (err, res, body) => {
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(body)
        t.equal(body.resourceType, 'Bundle', 'result should be a bundle')
        t.equal(body.total, 0, 'body should contain zero results')
        done()
      })
    })
  })
})

tap.test('patient should be saved correctly', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      let pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201, 'response status code should be 201')

        t.ok(res.headers['location'], 'should have a location header set')
        t.match(res.headers['location'], /\/fhir\/Patient\/[\da-f]+\/_history\/1/, 'should return a location with both id and vid present')

        let c = db.collection('Patient')
        c.findOne((err, result) => {
          t.error(err)
          t.ok(result, 'result should exist in the mongo')
          t.ok(result.latest, 'result should have a latest property')

          let pat = result.latest

          t.equal(pat.identifier[0].value, '1007211154902', 'should have correct identifier')
          t.equal(pat.identifier[1].value, '1001113333933', 'should have correct identifier')

          t.ok(pat.meta, 'should have meta set')
          t.ok(pat.meta.versionId, 'should have meta.versionId set')
          t.ok(pat.meta.lastUpdated, 'should have meta.lastUpdated set')

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

tap.test('patient endpoint should return an error', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      let pat = _.cloneDeep(require('./resources/Patient-1.json'))

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 400, 'response status code should be 400')
        t.equal(body.resourceType, 'OperationOutcome', 'should return an operation outcome object')

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

tap.test('patient should support read', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      let pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        let id = res.headers['location'].replace('/fhir/Patient/', '').replace('/_history/1', '')

        request({
          url: `http://localhost:3447/fhir/Patient/${id}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Patient', 'result should be a patient')
          t.equal(body.identifier[0].value, '1007211154902', 'body should contain the matching patient')

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

tap.test('patient read should respond with 404 if not found', (t) => {
  basicPatientTest(t, (done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient/573aff9fed5696d633aaaaaa',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('patient should support vread', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      let pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        request({
          url: `http://localhost:3447${res.headers.location}`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equal(body.resourceType, 'Patient', 'result should be a patient')
          t.equal(body.identifier[0].value, '1007211154902', 'body should contain the matching patient')
          t.equal(body.meta.versionId, '1', 'body should contain the versionId')

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

tap.test('patient should support update', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      let pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        let id = res.headers['location'].replace('/fhir/Patient/', '').replace('/_history/1', '')
        let update = {
          resourceType: 'Patient',
          id: id,
          active: true,
          name: [
            {
              given: ['Update']
            }
          ]
        }

        // update
        request.put({
          url: `http://localhost:3447/fhir/Patient/${id}`,
          headers: headers,
          body: update,
          json: true
        }, (err, res) => {
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')

          // read
          request({
            url: `http://localhost:3447/fhir/Patient/${id}`,
            headers: headers,
            json: true
          }, (err, res, body) => {
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equal(body.resourceType, 'Patient', 'result should be a patient')
            t.equal(body.name[0].given[0], 'Update', 'body should contain the latest patient')

            // vread - history should contain original
            request({
              url: `http://localhost:3447/fhir/Patient/${id}/_history/1`,
              headers: headers,
              json: true
            }, (err, res, body) => {
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equal(body.resourceType, 'Patient', 'result should be a patient')
              t.equal(body.name[0].given[0], 'Charlton', 'body should contain the original patient')

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
