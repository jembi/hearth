 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')
const env = require('./test-env/init')()
const server = require('../lib/server')
const request = require('request')

const Transaction = require('../lib/fhir/transaction')
const testBundle = require('./resources/Transaction-1.json')

tap.test('Transaction resource .sortTransactionBundle() should sort interactions correctly', (t) => {
  // given
  const transaction = Transaction()
  // when
  let sortedBundle = transaction.sortTransactionBundle(testBundle)
  // then
  t.ok(sortedBundle)
  t.equals(sortedBundle.entry.length, testBundle.entry.length, 'should have the same number of entries as the original bundle')
  t.equals(sortedBundle.entry[0].request.method, 'DELETE')
  t.equals(sortedBundle.entry[1].request.method, 'DELETE')
  t.equals(sortedBundle.entry[2].request.method, 'POST')
  t.equals(sortedBundle.entry[3].request.method, 'POST')
  t.equals(sortedBundle.entry[4].request.method, 'POST')
  t.equals(sortedBundle.entry[5].request.method, 'PUT')
  t.equals(sortedBundle.entry[6].request.method, 'PUT')
  t.equals(sortedBundle.entry[7].request.method, 'PUT')
  t.equals(sortedBundle.entry[8].request.method, 'GET')
  t.equals(sortedBundle.entry[9].request.method, 'GET')
  t.end()
})

tap.test('Transaction resource .sortTransactionBundle() should do nothing on an empty bundle', (t) => {
  // given
  const transaction = Transaction()
  // when
  let sortedBundle = transaction.sortTransactionBundle({
    type: 'transaction',
    entry: []
  })
  // then
  t.ok(sortedBundle)
  t.equals(sortedBundle.entry.length, 0)
  t.end()
})

tap.test('Transaction resource .sortTransactionBundle() should throw an error if request.method isn\'t specified', (t) => {
  t.plan(1)
  // given
  const transaction = Transaction()
  // when and then
  t.throws(() => {
    transaction.sortTransactionBundle({
      type: 'transaction',
      entry: [
        {
          request: {
            method: 'PUT'
          }
        },
        { /* fail */ },
        {
          request: {
            method: 'POST'
          }
        }
      ]
    })
  }, {}, 'should throw an error object')
})

tap.test('Transaction resource .revertCreate() should remove a newly created resource', (t) => {
  env.initDB((err, db) => {
    t.error(err)
    server.start((err) => {
      t.error(err)

      const patients = env.testPatients()
      env.createPatient(t, patients.charlton, () => {
        const idToDelete = patients.charlton.patient.id
        const transaction = Transaction(env.mongo())

        transaction.revertCreate('Patient', idToDelete, (err, success) => {
          t.error(err)
          t.true(success, 'should respond with success status as true')

          request({
            url: `http://localhost:3447/fhir/Patient/${idToDelete}`,
            headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
            json: true
          }, (err, res) => {
            t.error(err)
            t.equal(res.statusCode, 404, 'resource should not be available')

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

tap.test('Transaction resource .revertCreate() should respond with success=false if unknown resource', (t) => {
  env.initDB((err, db) => {
    t.error(err)
    const transaction = Transaction(env.mongo())
    transaction.revertCreate('Patient', '5aaaaaaaaaaaaaaaaaaaaaaa', (err, success) => {
      t.error(err)
      t.false(success, 'should respond with success status as false')

      env.clearDB((err) => {
        t.error(err)
        t.end()
      })
    })
  })
})

tap.test('Transaction resource .revertUpdate() should remove a newly updated resource', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

       // create a new resource
      const resourceType = 'Patient'
      const patients = env.testPatients()
      env.createPatient(t, patients.charlton, () => {
        const idToUpdate = patients.charlton.patient.id
        const transaction = Transaction(env.mongo())

        let c = db.collection(resourceType)
        c.findOne({ id: idToUpdate }, { fields: { id: 1 } }, (err, doc) => {
          t.error(err)
          t.equals('' + doc.id, idToUpdate, 'Patient has been created')

           // update the created resource
          patients.charlton.patient.telecom[0].value = 'charliebrown@fanmail.com'
          request.put({
            url: `http://localhost:3447/fhir/${resourceType}/${idToUpdate}`,
            body: patients.charlton.patient,
            headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
            json: true
          }, (err, res) => {
            t.error(err)
            t.equal(res.statusCode, 200)
            t.equal(res.body, 'OK')

            c.findOne({ id: idToUpdate }, {}, (err, doc) => {
              t.error(err)
              t.equals(doc.telecom[0].value, 'charliebrown@fanmail.com', 'Resource latest has been updated')
              t.equals(doc._request.method, 'PUT', 'Resource request has been updated')

               // revert the updated resource
              const idToRevert = idToUpdate
              transaction.revertUpdate(resourceType, idToRevert, (err, success) => {
                t.error(err)
                t.true(success, 'should respond with success status as true')

                c.findOne({ id: idToRevert }, {}, (err, doc) => {
                  t.error(err)
                  t.equals(doc.telecom[0].value, 'charlton@email.com', 'Resource latest has been reverted')
                  t.equals(doc._request.method, 'POST', 'Resource request has been reverted')

                  request({
                    url: `http://localhost:3447/fhir/Patient/${idToRevert}`,
                    headers: env.getTestAuthHeaders(env.users.sysadminUser.email),
                    json: true
                  }, (err, res) => {
                    t.error(err)
                    t.equal(res.statusCode, 200, 'Resource should be available')

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

tap.test('Transaction resource .revertUpdate() should respond with success=false if unknown resource', (t) => {
  env.initDB((err, db) => {
    t.error(err)
    const transaction = Transaction(env.mongo())
    transaction.revertUpdate('Patient', '5aaaaaaaaaaaaaaaaaaaaaaa', (err, success) => {
      t.error(err)
      t.false(success, 'should respond with success status as false')

      env.clearDB((err) => {
        t.error(err)
        t.end()
      })
    })
  })
})

tap.test('Transaction resource .revertDelete() should restore a newly deleted resource', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

       // create a new resource
      const resourceType = 'Patient'
      const patients = env.testPatients()
      env.createPatient(t, patients.charlton, () => {
        const id = patients.charlton.patient.id
        const transaction = Transaction(env.mongo())

        const c = db.collection(resourceType)
        const cHistory = db.collection(`${resourceType}_history`)

        c.findOne({ id: id }, { fields: { id: 1 } }, (err, doc) => {
          t.error(err)
          t.equals('' + doc.id, id, 'Patient has been created')

          // delete the created resource
          request({
            url: `http://localhost:3447/fhir/${resourceType}/${id}`,
            method: 'DELETE',
            headers: env.getTestAuthHeaders(env.users.sysadminUser.email)
          }, (err, res) => {
            t.error(err)
            t.equal(res.statusCode, 204)
            t.notOk(res.body, 'Does not return body')

            c.findOne({ id: id }, {}, (err, doc) => {
              t.error(err)
              t.notOk(doc, 'Resource should be deleted')

              cHistory.findOne({ id: id }, (err, doc) => {
                t.error(err)
                t.equals('' + doc.id, id, 'Deleted resource should be in history collection')

                // revert the deleted resource
                transaction.revertDelete(resourceType, id, (err, success) => {
                  t.error(err)
                  t.true(success, 'should respond with success status as true')

                  c.findOne({ id: id }, {}, (err, doc) => {
                    t.error(err)
                    t.equals('' + doc.id, id, 'Deleted resource has been restored')

                    cHistory.findOne({ id: id }, (err, doc) => {
                      t.error(err)
                      t.notOk(doc, 'Deleted resource history reverted')

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

tap.test('Transaction resource .revertDelete() should respond with success=false if unknown resource', (t) => {
  env.initDB((err, db) => {
    t.error(err)
    const transaction = Transaction(env.mongo())
    transaction.revertDelete('Patient', '5aaaaaaaaaaaaaaaaaaaaaaa', (err, success) => {
      t.error(err)
      t.false(success, 'should respond with success status as false')

      env.clearDB((err) => {
        t.error(err)
        t.end()
      })
    })
  })
})
