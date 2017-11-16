 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

process.env.NODE_ENV = 'test'
require('../lib/init')
const tap = require('tap')

const commonFactory = require('../lib/fhir/common')
const mongoFactory = require('../lib/mongo')
const env = require('./test-env/init')()
const common = commonFactory(env.mongo())

tap.test('should resolve references', (t) => {
  // given
  let testResource = {
    resourceType: 'Test',
    patient: {
      reference: 'Test/123'
    },
    list: [
      { author: { reference: 'Test/123' } },
      { author: { reference: 'Test/123' } },
      { author: 'blank' }
    ],
    nested: { patient: { reference: 'Test/123' } },
    nochange: { reference: 'Test/456' }
  }
  // when
  common.util.resolveReferences(testResource, 'Test/123', 'Test/321')
  // then
  t.ok(testResource)
  t.equals(testResource.patient.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.list[0].author.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.list[1].author.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.list[2].author, 'blank', 'should not replace random properties')
  t.equals(testResource.nested.patient.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.nochange.reference, 'Test/456', 'should not change non matching references')
  t.end()
})

tap.test('.util.validateID should validate FHIR id types', (t) => {
  t.ok(common.util.validateID('123'), '123 -> true')
  t.ok(common.util.validateID('1.2.3'), '1.2.3 -> true')
  t.ok(common.util.validateID('bcba5f3d-7bc5-4271-b8f8-e817b5052e23'), 'UUID -> true')
  t.notOk(common.util.validateID('$$$'), '$$$ -> false')
  t.notOk(common.util.validateID('$$$a'), '$$$a -> false')
  t.notOk(common.util.validateID('$a$$'), '$a$$ -> false')
  t.notOk(common.util.validateID('a$$$'), 'a$$$ -> false')
  t.ok(common.util.validateID('a'.repeat(64)), 'len(64) -> true')
  t.notOk(common.util.validateID('a'.repeat(65)), 'len(65) -> false')

  t.end()
})

tap.test('testing include resources', (t) => {
  const mongo = mongoFactory()
  const common = commonFactory(mongo)
  const testPatients = env.testPatients()
  const testLocation = require('./resources/Location-1')

  t.tearDown(() => {
    mongo.closeDB(() => { })
  })

  t.test('should return an error when results parameter is null', (t) => {
    t.rejects(common.includeResources({ test: true }, null), 'Invalid results parameter "null"')
    t.end()
  })

  t.test('should return an error when results parameter is undefined', (t) => {
    t.rejects(common.includeResources({ test: true }, void 0), 'Invalid results parameter "undefined"')
    t.end()
  })

  t.test('should resolve with empty array when results parameter is empty', (t) => {
    common.includeResources({ test: true }, [])
      .then((res) => {
        t.deepEqual(res, [])
        t.end()
      })
  })

  t.test('should not error when there is a non existent resource property', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = ['AllergyIntolerance.recorder']

      const results = [referencedPatient.allergy]

      common.includeResources(testContext, results).then((result) => {
        t.deepEqual(result, [])
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
    })
  }))

  t.test('should return an error when there is an invalid resource property', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = 'lastOccurrence'

      let results = []
      results.push(referencedPatient.allergy)

      t.rejects(common.includeResources(testContext, results), 'Invalid format for include parameter')
      t.end()
    })
  }))

  t.test('should not error when there is a reference without a reference property', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = ['AllergyIntolerance.recorder']

      const results = [
        Object.assign(
          {},
          referencedPatient.allergy,
          {
            recorder: {
              display: 'Dr Bones'
            }
          }
        )
      ]

      common.includeResources(testContext, results).then((result) => {
        t.deepEqual(result, [])
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
    })
  }))

  t.test('should return an error when the include parameter is an array with nulls values', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = [null]

      let results = []
      results.push(referencedPatient.allergy)

      t.rejects(common.includeResources(testContext, results), 'Undefined include parameter')
      t.end()
    })
  }))

  t.test('should return an error when the include parameter is an array with undefined values', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = [void 0]

      let results = []
      results.push(referencedPatient.allergy)

      t.rejects(common.includeResources(testContext, results), 'Undefined include parameter')
      t.end()
    })
  }))

  t.test('should not include any resource in the results object', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = 'Patient.managingOrganization'

      let results = []
      results.push(referencedPatient.patient)

      common.includeResources(testContext, results)
        .then((res) => {
          t.equal(res.length, 0)
          t.end()
        }).catch((err) => {
          t.error(err)
          t.end()
        })
    })
  }))

  t.test('should include one resource in the results object', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      const testContext = 'AllergyIntolerance.patient'

      let results = []
      results.push(referencedPatient.allergy)

      common.includeResources(testContext, results)
        .then((res) => {
          t.equal(res.length, 1)
          t.equal(res[0].id, referencedPatient.id)
          t.end()
        }).catch((err) => {
          t.error(err)
          t.end()
        })
    })
  }))

  t.test('should include one resource with nested search object in the results object', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      createTestLocation(db, (error, referencedLocation) => {
        t.error(error)

        const testContext = 'Encounter.location.location'

        let results = []
        results.push(referencedPatient.encounter)

        common.includeResources(testContext, results)
          .then((res) => {
            t.equal(res.length, 1)
            t.equal(res[0].id, referencedLocation.id)
            t.end()
          }).catch((err) => {
            t.error(err)
            t.end()
          })
      })
    })
  }))

  t.test('should include multiple resources with nested search object in the results object', withDB((t, db) => {
    createTestPatients(db, (err, referencedPatients) => {
      t.error(err)

      createTestLocation(db, (error, referencedLocation) => {
        t.error(error)

        const testContext = 'Patient.link.other'

        let results = []
        results.push(referencedPatients[0].patient)

        common.includeResources(testContext, results)
          .then((res) => {
            t.equal(res.length, 2)
            t.equal('Patient/' + res[0].id, referencedPatients[1].patient.link[0].other.reference)
            t.end()
          }).catch((err) => {
            t.error(err)
            t.end()
          })
      })
    })
  }))

  t.test('should not include any resources in the results object but still succeed, context empty string', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      let testContext = ''
      let results = []
      results.push(referencedPatient.allergy)

      common.includeResources(testContext, results)
        .then((res) => {
          t.deepEqual(res, [])
          t.end()
        })
    })
  }))

  t.test('should not include any resources in the results object but still succeed, context empty array', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      let testContext = []
      let results = []
      results.push(referencedPatient.allergy)

      common.includeResources(testContext, results)
        .then((res) => {
          t.equal(res.length, 0)
          t.end()
        })
    })
  }))

  t.test('should not include any resources in the results object but still succeed, context undefined', withDB((t, db) => {
    createTestPatient(db, (err, referencedPatient) => {
      t.error(err)

      let testContext = void 0
      let results = []
      results.push(referencedPatient.allergy)

      common.includeResources(testContext, results)
        .then((res) => {
          t.deepEqual(res, [])
          t.end()
        })
    })
  }))

  t.test('should include multiple resource in the results object', withDB((t, db) => {
    createTestPatients(db, (err, referencedPatients) => {
      t.error(err)

      const testContext = [
        'Encounter.patient',
        'Encounter.location.location'
      ]

      let results = []
      results.push(referencedPatients[0].encounter)

      common.includeResources(testContext, results)
        .then((res) => {
          t.equals(res.length, 2)
          t.equals(res[0].email, 'charlton@email.com')
          t.equals(res[1].resourceType, 'Location')
          t.equals(res[1].id, '1')
          t.end()
        })
    })
  }))

  t.test('should resolve duplicate resource parameters to results object with no duplicates', withDB((t, db) => {
    createTestPatients(db, (err, referencedPatients) => {
      t.error(err)

      const testContext = [
        'Encounter.patient',
        'Encounter.patient'
      ]

      let results = []
      results.push(referencedPatients[0].encounter)

      common.includeResources(testContext, results)
        .then((res) => {
          t.equals(res.length, 1)
          t.equals(res[0].email, 'charlton@email.com')
          t.end()
        })
    })
  }))

  t.test('should map search parameter names to paths where name is same as path', (t) => {
    common.mapSearchNameToPath('AllergyIntolerance:patient')
      .then((data) => {
        t.equals(data.length, 1)
        t.deepEqual(data[0], 'AllergyIntolerance.patient')
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should map search parameter names to paths where name is different to path', (t) => {
    common.mapSearchNameToPath('AuditEvent:participant')
      .then((data) => {
        t.equals(data.length, 1)
        t.deepEqual(data[0], 'AuditEvent.participant.reference')
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should map search parameter names to paths where name maps to array of paths', (t) => {
    common.mapSearchNameToPath('AuditEvent:patient')
      .then((data) => {
        t.equals(data.length, 2)
        t.equals(data[0], 'AuditEvent.object.reference')
        t.equals(data[1], 'AuditEvent.participant.reference')
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should map array of search parameter names to paths with no duplicates', (t) => {
    common.mapSearchNameToPath(['AuditEvent:patient', 'AuditEvent:participant'])
      .then((data) => {
        t.equals(data.length, 2)
        t.equals(data[0], 'AuditEvent.object.reference')
        t.equals(data[1], 'AuditEvent.participant.reference')
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should map search parameter names to paths where name is same as path', (t) => {
    t.rejects(common.mapSearchNameToPath('AllergyIntolerance'))
    t.end()
  })

  t.test('should return nothing since search parameter null', (t) => {
    common.mapSearchNameToPath(null)
      .then((data) => {
        t.true(!data)
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
  })

  t.test('should return nothing since search parameter undefined', (t) => {
    common.mapSearchNameToPath(void 0)
      .then((data) => {
        t.true(!data)
        t.end()
      }).catch((err) => {
        t.error(err)
        t.end()
      })
  })

  // contains object tests
  t.test('should resolve to true that array contains string', (t) => {
    const sut = common.containsObject('AuditEvent:patient', ['AuditEvent:patient', 'AuditEvent:participant'])

    t.equals(sut, true)
    t.end()
  })

  t.test('should resolve to true that array contains string', (t) => {
    const sut = common.containsObject('Hello.world', ['AuditEvent:patient', 'AuditEvent:participant'])

    t.equals(sut, false)
    t.end()
  })

  t.test('should resolve to true that array contains object', (t) => {
    const sut = common.containsObject({ test: true }, [{ test: true }, { something: 'test' }])

    t.equals(sut, true)
    t.end()
  })

  t.test('should resolve to false that array does not contains object', (t) => {
    const sut = common.containsObject({ test: true }, [{ hello: 'world' }, { something: 'test' }])

    t.equals(sut, false)
    t.end()
  })

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
    let testPatient = testPatients.charlton
    testPatient.id = '1'
    const referencedPatient = Object.assign({}, testPatient)
    db.collection('Patient').remove({ id: referencedPatient.id }, (err) => {
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

  function createTestLocation (db, callback) {
    db.collection('Location').remove({ id: testLocation.id }, (err) => {
      if (err) {
        return callback(err)
      }

      db.collection('Location').insertOne(testLocation, (err) => {
        if (err) {
          return callback(err)
        }
        callback(null, testLocation)
      })
    })
  }

  function createTestPatients (db, callback) {
    let referencedPatients = []
    let promises = []

    referencedPatients.push(testPatients.charlton)
    referencedPatients.push(testPatients.emmarentia)
    referencedPatients.push(testPatients.nikita)

    referencedPatients.forEach((item, index) => {
      item.id = `${index + 1}`

      promises.push(new Promise((resolve, reject) => {
        db.collection('Patient').remove({ id: item.id }, (err) => {
          if (err) {
            reject(err)
          }
          db.collection('Patient').insertOne(item, (err, res) => {
            if (err) {
              reject(err)
            }

            resolve(item)
          })
        })
      }))
    })

    Promise.all(promises).then((res) => {
      return callback(null, res)
    }).catch((err) => {
      return callback(err)
    })
  }
})
