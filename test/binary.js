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
const mongodb = require('mongodb')
const sinon = require('sinon')
const logger = require('winston')
const _ = require('lodash')

const env = require('./test-env/init')()
const server = require('../lib/server')
const fhirRoot = require('../lib/fhir/root')()

const binaryResource = require('./resources/Binary-1')
const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let binaryTestEnv = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createResource(t, env.testBinaryFiles().doc1, 'Binary', (err, ref1) => { // contenttype = application/json
        t.error(err)
        env.createResource(t, env.testBinaryFiles().doc2, 'Binary', (err, ref2) => { // contenttype = application/pdf
          t.error(err)
          env.createResource(t, env.testBinaryFiles().doc3, 'Binary', (err, ref3) => { // contenttype = application/pdf
            t.error(err)
            env.createResource(t, env.testBinaryFiles().doc4, 'Binary', (err, ref4) => { // contenttype = application/xml
              t.error(err)
              test(db, [ref1, ref2, ref3, ref4], () => {
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
  binaryTestEnv(t, (db, refs, done) => {
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
  binaryTestEnv(t, (db, refs, done) => {
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
  binaryTestEnv(t, (db, refs, done) => {
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
  binaryTestEnv(t, (db, refs, done) => {
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
  binaryTestEnv(t, (db, refs, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary?contenttype=application/xml',
      headers: headers,
      json: true
    }, (err, res, searchBody) => {
      // then
      t.error(err)

      request({
        url: `http://localhost:3447/fhir/Binary/${searchBody.entry[0].resource.id}`,
        headers: headers,
        json: true
      }, (err, res, readBody) => {
        // then
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(readBody)
        t.ok(readBody.content, 'should have field "content"')
        t.equals('Binary', readBody.resourceType, 'should return a resource of type Binary')
        t.equals('application/xml', readBody.contentType, 'should return a contentType of application/xml')
        done()
      })
    })
  })
})

tap.test('Binary - preInteractionHandlers.create - should insert binary data', (t) => {
  // given
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      // when
      request.post({
        url: 'http://localhost:3447/fhir/Binary',
        headers: headers,
        body: binaryResource,
        json: true
      }, (err, res, body) => {
        // then
        t.error(err)

        t.equal(res.statusCode, 201, 'response status code should be 200')

        let c = db.collection('Binary')
        c.findOne({}, {}, (err, doc) => {
          t.error(err)

          t.equal(doc.resourceType, 'Binary')
          t.equal(doc.contentType, 'image/jpg')
          t.equal(doc.content, undefined)
          t.ok(doc._transforms.content, 'Binary resource successfully inserted')

          var bucket = new mongodb.GridFSBucket(db)
          let data = ''

          bucket.openDownloadStream(doc._transforms.content)
          .on('data', (chunk) => {
            data += chunk
          })
          .on('error', (err) => {
            t.error(err)
          })
          .on('end', () => {
            t.equal(data, binaryResource.content, 'GridFS returns expected binary data')
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

tap.test('Binary - preInteractionHandlers.update - should update reference to binary data', (t) => {
  // given
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      // when
      request.post({
        url: 'http://localhost:3447/fhir/Binary',
        headers: headers,
        body: binaryResource,
        json: true
      }, (err, res, body) => {
        // then
        t.error(err)
        t.equal(res.statusCode, 201, 'response status code should be 201')

        const cFiles = db.collection('fs.files')
        cFiles.findOne({}, {}, (err, file) => {
          t.error(err)

          const c = db.collection('Binary')
          c.findOne({}, {}, (err, doc) => {
            t.error(err)

            let idToUpdate = doc.id
            let br = JSON.parse(JSON.stringify(binaryResource))
            br.id = idToUpdate
            br.contentType = 'image/jpeg'
            request.put({
              url: 'http://localhost:3447/fhir/Binary/' + idToUpdate,
              headers: headers,
              body: br,
              json: true
            }, (err, res, body) => {
              // then
              t.error(err)
              t.equal(res.statusCode, 200, 'response status code should be 200')

              c.findOne({ id: doc.id }, {}, (err, doc) => {
                t.error(err)

                t.equal(doc.resourceType, 'Binary')
                t.equal(doc.contentType, 'image/jpeg')
                t.notOk(doc.content)

                const cHistory = db.collection('Binary_history')
                cHistory.findOne({ id: doc.id }, (err, history) => {
                  t.error(err)
                  t.ok(history, 'Binary resource history saved')

                  cFiles.findOne({ _id: doc._transforms.content }, {}, (err, file) => {
                    t.error(err)
                    t.ok(file, 'Binary resource link updated')

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

tap.test('Binary - preInteractionHandlers writeToGridFS - should return bad request when no content in binary resource', (t) => {
  // given
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      // when
      let testResource = JSON.parse(JSON.stringify(binaryResource))
      delete testResource.content
      request.post({
        url: 'http://localhost:3447/fhir/Binary',
        headers: headers,
        body: testResource,
        json: true
      }, (err, res, body) => {
        // then
        t.error(err)
        t.equal(res.statusCode, 400, 'response status code should be 400')
        t.equal(body.issue[0].severity, 'error', 'Should return correct issue severity')
        t.equal(body.issue[0].code, 'invalid', 'Should return correct issue code')
        t.equal(body.issue[0].details.text, 'No content in binary resource', 'Should return correct issue text')

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

tap.test('Binary - postInteractionHandlers.read - should fetch binary resource with binary data in content property', (t) => {
  // given
  binaryTestEnv(t, (db, refs, done) => {
    request({
      url: 'http://localhost:3447/fhir/Binary?contenttype=application/xml',
      headers: headers,
      json: true
    }, (err, res, searchBody) => {
      // then
      t.error(err)

      // check request binary data is same as original data
      request({
        url: `http://localhost:3447/fhir/Binary/${searchBody.entry[0].resource.id}`,
        headers: headers,
        json: true
      }, (err, res, readBody) => {
        // then
        t.error(err)

        t.equal(res.statusCode, 200, 'response status code should be 200')
        t.ok(readBody)
        t.ok(readBody.content, 'should have field "content"')
        t.equals(env.testBinaryFiles().doc4.content, readBody.content, 'should have same binary content as original insert document')
        done()
      })
    })
  })
})

tap.test('Binary - postInteractionHandlers.search - should fetch searched binary resources with binary data in content property', (t) => {
  // given
  binaryTestEnv(t, (db, refs, done) => {
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

      t.equals(refs[1], `Binary/${body.entry[0].resource.id}`, 'should return the correct resource')
      t.equals('Binary', body.entry[0].resource.resourceType, 'should return a resource of type Binary')
      t.equals(refs[2], `Binary/${body.entry[1].resource.id}`, 'should return the correct resource')
      t.equals('Binary', body.entry[1].resource.resourceType, 'should return a resource of type Binary')
      t.equals('application/pdf', body.entry[0].resource.contentType, 'should return a contentType of application/pdf')
      t.equals('application/pdf', body.entry[1].resource.contentType, 'should return a contentType of application/pdf')

      t.equals(env.testBinaryFiles().doc2.content, body.entry[0].resource.content, 'should have same binary content as original insert document')
      t.equals(env.testBinaryFiles().doc3.content, body.entry[1].resource.content, 'should have same binary content as original insert document')
      done()
    })
  })
})

tap.test('Binary - postInteractionHandlers.create - should convert the binary to json when content-type is application/json', (t) => {
  const sandbox = sinon.sandbox.create()
  sandbox.stub(fhirRoot, 'processRootBundle').callsFake((ctx, jsonObject, callback) => {
    t.equals(jsonObject.resourceType, 'Bundle')
    t.equals(jsonObject.type, 'document')
    t.equals(jsonObject.entry[0].id, 1)
    t.equals(jsonObject.entry[0].resourceType, 'Patient')
    callback()
  })

  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      env.createResource(t, env.testBinaryFiles().doc1, 'Binary', (err, ref1) => {
        t.error(err)

        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            sandbox.restore()
            t.end()
          })
        })
      })
    })
  })
})

tap.test('Binary - postInteractionHandlers.create - should not convert the binary to json when content-type is not application/json', (t) => {
  const sandbox = sinon.sandbox.create()
  const stub = sandbox.stub(logger, 'debug')

  stub.onCall(1).callsFake((arg) => {
    t.equals(arg, 'Cannot convert Binary with content type application/xml to Bundle', 'Should log a debug message', {skip: true})
  })

  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const testBinaryFile = _.cloneDeep(env.testBinaryFiles().doc1)
      testBinaryFile.contentType = 'application/xml'

      env.createResource(t, testBinaryFile, 'Binary', (err, ref1) => {
        t.error(err)

        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            sandbox.restore()
            t.end()
          })
        })
      })
    })
  })
})

tap.test('Binary - postInteractionHandlers.create - should log an error when the converted binary is not a valid fhir resource', (t) => {
  const sandbox = sinon.sandbox.create()
  sandbox.stub(logger, 'error').callsFake((arg) => {
    t.equals(arg.message, 'JSON content is not a valid FHIR resource')
  })

  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const base64EncodedJSON = Buffer.from(JSON.stringify({ test: 'Not a fhir resource' })).toString('base64')
      const testBinaryFile = _.cloneDeep(env.testBinaryFiles().doc1)
      testBinaryFile.content = base64EncodedJSON

      env.createResource(t, testBinaryFile, 'Binary', (err, ref1) => {
        t.error(err)

        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            sandbox.restore()
            t.end()
          })
        })
      })
    })
  })
})

tap.test('Binary - postInteractionHandlers.create - should log an error if resource could not be added to db by core', (t) => {
  const sandbox = sinon.sandbox.create()
  sandbox.stub(logger, 'error').callsFake((arg) => {
    t.equals(arg.message, 'Non 2xx status code: 404 while trying to process binary bundle', 'Should log the correct error')
  })

  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const patientClone = _.cloneDeep(require('./resources/Patient-1.json'))
      const base64EncodedJSON = Buffer.from(JSON.stringify(patientClone)).toString('base64')

      const testBinaryFile = {
        resourceType: 'Binary',
        contentType: 'application/json',
        content: base64EncodedJSON
      }

      env.createResource(t, testBinaryFile, 'Binary', (err, ref1) => {
        t.error(err)

        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            sandbox.restore()
            t.end()
          })
        })
      })
    })
  })
})

tap.test('Binary - should ensure that the bundle has been saved to the db', (t) => {
  binaryTestEnv(t, (db, refs, done) => {
    const c = db.collection('Patient')
    c.find().toArray((err, docs) => {
      t.error(err)

      t.equals(docs.length, 1)
      t.equals(docs[0].name[0].given[0], 'Charlton')
      done()
    })
  })
})

tap.test('Binary - postInteractionHandlers.create - should successfully add a transaction', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pats = env.testPatients()
      env.createPatient(t, pats.charlton, () => {
        env.createPatient(t, pats.emmarentia, () => {
          const cPatient = db.collection('Patient')
          const emmarentiaId = pats.emmarentia.patient.id

          cPatient.findOne({ id: emmarentiaId }, (err, doc) => {
            t.error(err)
            t.equal('' + doc.id, emmarentiaId, 'Ensure emmarentia exists before deletion')

            const testTransaction = _.cloneDeep(require('./resources/Transaction-success.json'))
            testTransaction.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
            testTransaction.entry[1].resource.id = pats.charlton.patient.id
            testTransaction.entry[2].request.url = `Patient/${pats.charlton.patient.id}`
            testTransaction.entry[3].request.url = `Patient/${pats.charlton.patient.id}/_history/${pats.charlton.patient.meta.versionId}`
            testTransaction.entry[5].request.url = `Patient/${emmarentiaId}`
            const base64EncodedJSON = Buffer.from(JSON.stringify(testTransaction)).toString('base64')

            const testBinaryFile = {
              resourceType: 'Binary',
              contentType: 'application/json+fhir',
              content: base64EncodedJSON
            }

            env.createResource(t, testBinaryFile, 'Binary', (err, doc) => {
              t.error(err)

              const cBinary = db.collection('Binary')
              cBinary.find().toArray((err, resource) => {
                t.error(err)

                t.equals(resource.length, 1)
                t.equals(resource[0].resourceType, 'Binary')
                t.equals(resource[0].contentType, 'application/json+fhir')

                cPatient.find().toArray((err, docs) => {
                  t.error(err)

                  t.equals(docs[0].name[0].given[0], 'John', 'should have updated a patient correctly')
                  t.equals(docs[0].name[0].family[0], 'Doe', 'should have updated a patient correctly')
                  t.equals(docs[1].name[0].given[0], 'Peter', 'should have updated a patient correctly')
                  t.equals(docs[1].name[0].family[0], 'Chalmers', 'should have updated a patient correctly')

                  cPatient.findOne({ id: emmarentiaId }, (err, doc) => {
                    t.error(err)
                    t.notOk(doc, 'Resource should be deleted')

                    const cHistory = db.collection('Patient_history')
                    cHistory.findOne({ id: emmarentiaId }, (err, doc) => {
                      t.error(err)
                      t.equal('' + doc.id, emmarentiaId, 'Deleted resource should appear in history')

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

tap.test('Binary - postInteractionHandlers.create - should successfully rollback a transaction if one entry fails', (t) => {
  const sandbox = sinon.sandbox.create()
  sandbox.stub(logger, 'error').callsFake((arg) => {
    t.equals(arg.message, 'Non 2xx status code: 400 while trying to process binary bundle', 'Should log the correct error')
  })

  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const pats = env.testPatients()
      env.createPatient(t, pats.charlton, () => {
        const testTransaction = _.cloneDeep(require('./resources/Transaction-fail.json'))
        testTransaction.entry[1].request.url = `Patient/${pats.charlton.patient.id}`
        testTransaction.entry[1].resource.id = pats.charlton.patient.id
        testTransaction.entry[3].request.url = `Patient/${pats.charlton.patient.id}`

        const base64EncodedJSON = Buffer.from(JSON.stringify(testTransaction)).toString('base64')

        const testBinaryFile = {
          resourceType: 'Binary',
          contentType: 'application/fhir+json',
          content: base64EncodedJSON
        }

        env.createResource(t, testBinaryFile, 'Binary', (err, ref1) => {
          t.error(err)

          const cPatient = db.collection('Patient')
          cPatient.findOne({ 'name.given': 'Peter' }, (err, result) => {
            t.error(err)
            t.notOk(result, 'should have reverted the created patient')

            cPatient.findOne({ 'name.given': 'Charlton' }, (err, result) => {
              t.error(err)
              t.ok(result, 'should have reverted the updated patient')

              const cBinary = db.collection('Binary')
              cBinary.find().toArray((err, resource) => {
                t.error(err)

                t.equals(resource.length, 1)
                t.equals(resource[0].resourceType, 'Binary')
                t.equals(resource[0].contentType, 'application/fhir+json')

                env.clearDB((err) => {
                  t.error(err)
                  server.stop(() => {
                    sandbox.restore()
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
