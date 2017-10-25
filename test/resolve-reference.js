 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

process.env.NODE_ENV = 'test'
require('../lib/init')

const commonFactory = require('../lib/fhir/common')
const mongoFactory = require('../lib/mongo')
const tap = require('tap')
const testPatient = require('./resources/Patient-1')

tap.test('resolve reference', (t) => {
  const mongo = mongoFactory()
  const common = commonFactory(mongo)

  t.tearDown(() => {
    mongo.closeDB(() => {})
  })

  t.test('should return an error when the reference is undefined', (t) => {
    common.resolveReference(void 0, (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Invalid resource reference "undefined"')
      t.end()
    })
  })

  t.test('should return an error when the reference is null', (t) => {
    common.resolveReference(null, (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Invalid resource reference "null"')
      t.end()
    })
  })

  t.test('should return an error when the reference is invalid', (t) => {
    common.resolveReference('💥', (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Invalid resource reference "💥"')
      t.end()
    })
  })

  t.test('should return an error when the reference has an unknown resource type', (t) => {
    common.resolveReference('Nope/1', (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Invalid resource reference "Nope/1"')
      t.end()
    })
  })

  t.test('should return an error when the reference has an invalid id', (t) => {
    common.resolveReference('Patient/#1', (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Invalid resource reference "Patient/#1"')
      t.end()
    })
  })

  t.test('should return an error when the reference is an internal fragment', (t) => {
    common.resolveReference('#1', (err) => {
      t.type(err, Error)
      t.equal(err.message, 'Invalid resource reference "#1"')
      t.end()
    })
  })

  t.test('should return null when the referenced resource does not exist', (t) => {
    common.resolveReference('Patient/d959d05f-9e57-4897-be5a-362906e04558', (err, resolvedResource) => {
      t.error(err)
      t.equal(resolvedResource, null)
      t.end()
    })
  })

  t.test('should return the correct resource when resolving relative references', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      if (err) {
        return t.threw(err)
      }
      common.resolveReference(
        `Patient/${referencedPatient.id}`,
        (err, resolvedResource) => {
          t.error(err)
          t.deepEqual(resolvedResource, referencedPatient)
          t.end()
        }
      )
    })
  }))

  t.test('should return the correct resource when resolving absolute references', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      if (err) {
        return t.threw(err)
      }
      common.resolveReference(
        `http://localhost/Patient/${referencedPatient.id}`,
        (err, resolvedResource) => {
          t.error(err)
          t.deepEqual(resolvedResource, referencedPatient)
          t.end()
        }
      )
    })
  }))

  t.test('should return the correct resource when resolving relative references with a version', withDB((t, db) => {
    createTestPatientHistory(db, (err, referencedPatient) => {
      if (err) {
        return t.threw(err)
      }
      common.resolveReference(
        `Patient/${referencedPatient.id}/_history/${referencedPatient.meta.versionId}`,
        (err, resolvedResource) => {
          t.error(err)
          t.deepEqual(resolvedResource, referencedPatient)
          t.end()
        }
      )
    })
  }))

  t.end()

  function withDB (test) {
    return (t) => {
      mongo.getDB((err, db) => {
        if (err) {
          return t.threw(err)
        }
        test(t, db)
      })
    }
  }

  function createTestPatient (db, callback) {
    const referencedPatient = Object.assign({}, testPatient)
    db.collection('Patient').remove({id: referencedPatient.id}, (err) => {
      if (err) {
        return callback(err)
      }
      db.collection('Patient').insertOne(referencedPatient, (err) => {
        if (err) {
          return callback(err)
        }
        callback(null, referencedPatient)
      })
    })
  }

  function createTestPatientHistory (db, callback) {
    const referencedPatient = Object.assign({}, testPatient, {
      meta: Object.assign({}, testPatient.meta, {
        versionId: '5feb29f6-349a-4537-b620-0188cd30087a'
      })
    })
    db.collection('Patient_history').remove({id: referencedPatient.id}, (err) => {
      if (err) {
        return callback(err)
      }
      db.collection('Patient_history').insertOne(referencedPatient, (err) => {
        if (err) {
          return callback(err)
        }
        callback(null, referencedPatient)
      })
    })
  }
})
