 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const env = require('./test-env/init')()
const server = require('../lib/server')
const tap = require('tap')
const request = require('request')
const _ = require('lodash')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

const basicPatientTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createPatient(t, env.testPatients().charlton, () => {
        env.createPatient(t, env.testPatients().emmarentia, () => { // use emmarentia for filtering
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
}

tap.test('patient should support searches on identifier', (t) => {
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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
  basicPatientTest(t, (db, done) => {
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

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
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
        t.match(res.headers['location'], /\/fhir\/Patient\/[\w-]+\/_history\/[\w-]+/, 'should return a location with both id and vid present')

        const c = db.collection('Patient')
        c.findOne((err, result) => {
          t.error(err)
          t.ok(result, 'result should exist in the mongo')

          t.equal(result.identifier[0].value, '1007211154902', 'should have correct identifier')
          t.equal(result.identifier[1].value, '1001113333933', 'should have correct identifier')

          t.ok(result.meta, 'should have meta set')
          t.ok(result.meta.versionId, 'should have meta.versionId set')
          t.ok(result.meta.lastUpdated, 'should have meta.lastUpdated set')
          t.ok(result._transforms, 'should have _transforms set')
          t.ok(result._request, 'should have _request set')
          t.equal(result._request.method, 'POST', 'should have _request.method set to POST')

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

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))

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

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const id = res.headers['location'].replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')

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

          t.ok(body.meta, 'should have meta set')
          t.ok(body.meta.versionId, 'should have versionId set')

          t.notOk(body._transforms, 'should not expose _transforms')
          t.notOk(body._request, 'should not expose _request')
          t.notOk(body._id, 'should not expose mongo _id')

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
  basicPatientTest(t, (db, done) => {
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

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
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
          t.ok(body.meta.versionId, 'body should contain the versionId')

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

tap.test('vread should respond with 404 if version not found', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const id = res.headers['location'].replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')

        request({
          url: `http://localhost:3447/fhir/Patient/${id}/_history/2222`,
          headers: headers,
          json: true
        }, (err, res, body) => {
          t.error(err)

          t.equal(res.statusCode, 404, 'response status code should be 404')

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

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const originalLocation = res.headers['location']
        const id = res.headers['location'].replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')
        const update = {
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
              url: `http://localhost:3447${originalLocation}`,
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

tap.test('patient should support multiple updates', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const originalLocation = res.headers['location']
        const id = res.headers['location'].replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')
        const update = {
          resourceType: 'Patient',
          id: id,
          active: true,
          name: [
            {
              given: ['Update1']
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

          const updateLocation = res.headers['location']

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
            t.equal(body.name[0].given[0], 'Update1', 'body should contain the latest patient')

            // vread - history should contain original
            request({
              url: `http://localhost:3447${originalLocation}`,
              headers: headers,
              json: true
            }, (err, res, body) => {
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equal(body.resourceType, 'Patient', 'result should be a patient')
              t.equal(body.name[0].given[0], 'Charlton', 'body should contain the original patient')

              const update2 = {
                resourceType: 'Patient',
                id: id,
                active: true,
                name: [
                  {
                    given: ['Update2']
                  }
                ]
              }

              // update
              request.put({
                url: `http://localhost:3447/fhir/Patient/${id}`,
                headers: headers,
                body: update2,
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
                  t.equal(body.name[0].given[0], 'Update2', 'body should contain the latest patient')

                  // vread - history should contain original
                  request({
                    url: `http://localhost:3447${originalLocation}`,
                    headers: headers,
                    json: true
                  }, (err, res, body) => {
                    t.error(err)

                    t.equal(res.statusCode, 200, 'response status code should be 200')
                    t.ok(body)
                    t.equal(body.resourceType, 'Patient', 'result should be a patient')
                    t.equal(body.name[0].given[0], 'Charlton', 'body should contain the original patient')

                    // vread - history should contain the first update
                    request({
                      url: `http://localhost:3447${updateLocation}`,
                      headers: headers,
                      json: true
                    }, (err, res, body) => {
                      t.error(err)

                      t.equal(res.statusCode, 200, 'response status code should be 200')
                      t.ok(body)
                      t.equal(body.resourceType, 'Patient', 'result should be a patient')
                      t.equal(body.name[0].given[0], 'Update1', 'body should contain the original patient')

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
      })
    })
  })
})

tap.test('update should replace existing documents', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pat = _.cloneDeep(require('./resources/Patient-1.json'))
      delete pat.id

      // save
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        headers: headers,
        body: pat,
        json: true
      }, (err, res, body) => {
        t.error(err)

        const id = res.headers['location'].replace('/fhir/Patient/', '').replace(/\/_history\/.*/, '')
        const update = {
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

            // resource should be completely replaced by the updated document
            // should not contain fields from the original document that aren't present in the update
            t.notOk(body.name[0].family, 'body should not contain the family name')
            t.notOk(body.identifier, 'body should not contain the identifier')
            t.notOk(body.gender, 'body should not contain gender')
            t.notOk(body.address, 'body should not contain address')

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

tap.test('read should respond with 404 not found if invalid value for id is used', (t) => {
  basicPatientTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient/th%21s%21sb%24d',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})

tap.test('vread should respond with 404 not found if invalid value for vid is used', (t) => {
  basicPatientTest(t, (db, done) => {
    request({
      url: 'http://localhost:3447/fhir/Patient/1234/_history/th%21s%21sb%24d',
      headers: headers,
      json: true
    }, (err, res, body) => {
      t.error(err)

      t.equal(res.statusCode, 404, 'response status code should be 404')
      done()
    })
  })
})
