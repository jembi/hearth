'use strict'
const tap = require('tap')
const request = require('request')

const env = require('./test-env/init')()
const server = require('../lib/server')
const testDocManifest = require('./resources/DocumentManifest-1.json')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let docManifestTestEnv = (t, test) => {
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

tap.test('DocumentManifest - should return all results when there are no parameters', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe1 = Object.assign({}, testDocManifest)
    delete findMe1.id
    const findMe2 = Object.assign({}, testDocManifest)
    delete findMe2.id
    env.createResource(t, findMe1, 'DocumentManifest', () => {
      env.createResource(t, findMe2, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(2, body.total, 'total should be one')
          t.equals('Bundle', body.resourceType, 'should return a Bundle')
          t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
          t.equals('DocumentManifest', body.entry[1].resource.resourceType, 'should return a resource of type DocumentManifest')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by subject', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = Object.assign({}, testDocManifest)
    findMe.subject = 'Patient/123'
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?patient=Patient/123',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(1, body.total, 'total should be one')
          t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
          t.equals('Patient/123', body.entry[0].resource.subject, 'should have a subject of Patient/123')
          done()
        })
      })
    })
  })
})

// tap.test('DocumentManifest - should search by subject, even if it is a full URL', (t) => {
//   // given
//   docManifestTestEnv(t, (db, done) => {
//     const findMe = Object.assign({}, testDocManifest)
//     findMe.subject = 'Patient/123'
//     delete findMe.id
//     const skipMe = Object.assign({}, testDocManifest)
//     delete skipMe.id
//     env.createResource(t, findMe, 'DocumentManifest', () => {
//       env.createResource(t, skipMe, 'DocumentManifest', () => {
//         // when
//         request({
//           url: 'http://localhost:3447/fhir/DocumentManifest?patient=http://localhost:3447/fhir/Patient/123',
//           headers: headers,
//           json: true
//         }, (err, res, body) => {
//           // then
//           t.error(err)
//
//           t.equal(res.statusCode, 200, 'response status code should be 200')
//           t.ok(body)
//           t.equals(1, body.total, 'total should be one')
//           t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
//           t.equals('Patient/123', body.entry[0].resource.subject, 'should have a subject of Patient/123')
//           done()
//         })
//       })
//     })
//   })
// })

tap.test('DocumentManifest - should perform chained search by patient.identifier', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    let testPatients = env.testPatients()
    const findMe = Object.assign({}, testDocManifest)
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createPatient(t, testPatients.charlton, () => {
      findMe.subject = `Patient/${testPatients.charlton.patient.id}`
      env.createResource(t, findMe, 'DocumentManifest', () => {
        env.createResource(t, skipMe, 'DocumentManifest', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/DocumentManifest?patient.identifier=pshr:sanid|1007211154902',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(1, body.total, 'total should be one')
            t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
            t.equals(`Patient/${testPatients.charlton.patient.id}`, body.entry[0].resource.subject, 'should have correct subject reference')
            done()
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by patient.identifier and return multiple documents for multiple matching patients', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    let testPatients = env.testPatients()
    const findMe1 = Object.assign({}, testDocManifest)
    delete findMe1.id
    const findMe2 = Object.assign({}, testDocManifest)
    delete findMe2.id
    env.createPatient(t, testPatients.charlton, () => {
      findMe1.subject = `Patient/${testPatients.charlton.patient.id}`
      env.createPatient(t, testPatients.emmarentia, () => {
        findMe2.subject = `Patient/${testPatients.emmarentia.patient.id}`
        env.createResource(t, findMe1, 'DocumentManifest', () => {
          env.createResource(t, findMe2, 'DocumentManifest', () => {
            // when
            request({
              url: 'http://localhost:3447/fhir/DocumentManifest?patient.identifier=pshr:passport:za|1001113333933',
              headers: headers,
              json: true
            }, (err, res, body) => {
              // then
              t.error(err)

              t.equal(res.statusCode, 200, 'response status code should be 200')
              t.ok(body)
              t.equals(body.total, 2, 'total should be two')
              done()
            })
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by patient.identifier and return no results if the reference doesn\'t exist', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = Object.assign({}, testDocManifest)
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?patient.identifier=pshr:sanid|no-exist',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(0, body.total, 'total should be one')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by author.given', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    let testPractitioners = env.testPractitioners()
    let testOrganizations = env.testOrganizations()
    const findMe = Object.assign({}, testDocManifest)
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createPractitioner(t, testPractitioners.alison, testOrganizations.greenwood, () => {
      findMe.author = `Practitioner/${testPractitioners.alison.practitioner.id}`
      env.createResource(t, findMe, 'DocumentManifest', () => {
        env.createResource(t, skipMe, 'DocumentManifest', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/DocumentManifest?author.given=Alison',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(1, body.total, 'total should be one')
            t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
            t.equals(`Practitioner/${testPractitioners.alison.practitioner.id}`, body.entry[0].resource.author, 'should have correct author reference')
            done()
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should perform chained search by author.family', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    let testPractitioners = env.testPractitioners()
    let testOrganizations = env.testOrganizations()
    const findMe = Object.assign({}, testDocManifest)
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createPractitioner(t, testPractitioners.alison, testOrganizations.greenwood, () => {
      findMe.author = `Practitioner/${testPractitioners.alison.practitioner.id}`
      env.createResource(t, findMe, 'DocumentManifest', () => {
        env.createResource(t, skipMe, 'DocumentManifest', () => {
          // when
          request({
            url: 'http://localhost:3447/fhir/DocumentManifest?author.family=Tobi',
            headers: headers,
            json: true
          }, (err, res, body) => {
            // then
            t.error(err)

            t.equal(res.statusCode, 200, 'response status code should be 200')
            t.ok(body)
            t.equals(1, body.total, 'total should be one')
            t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
            t.equals(`Practitioner/${testPractitioners.alison.practitioner.id}`, body.entry[0].resource.author, 'should have correct author reference')
            done()
          })
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by type', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = Object.assign({}, testDocManifest)
    findMe.type = {
      coding: [
        {
          system: 'otherSys',
          code: 'otherCode'
        }, {
          system: 'testSys',
          code: 'testCode'
        }
      ],
      text: 'a test code'
    }
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?type=testSys|testCode',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(1, body.total, 'total should be one')
          t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
          t.equals('testSys', body.entry[0].resource.type.coding[1].system, 'should have correct type system')
          t.equals('testCode', body.entry[0].resource.type.coding[1].code, 'should have correct type code')
          done()
        })
      })
    })
  })
})

tap.test('DocumentManifest - should search by status', (t) => {
  // given
  docManifestTestEnv(t, (db, done) => {
    const findMe = Object.assign({}, testDocManifest)
    findMe.status = 'superseded'
    delete findMe.id
    const skipMe = Object.assign({}, testDocManifest)
    delete skipMe.id
    env.createResource(t, findMe, 'DocumentManifest', () => {
      env.createResource(t, skipMe, 'DocumentManifest', () => {
        // when
        request({
          url: 'http://localhost:3447/fhir/DocumentManifest?status=superseded',
          headers: headers,
          json: true
        }, (err, res, body) => {
          // then
          t.error(err)

          t.equal(res.statusCode, 200, 'response status code should be 200')
          t.ok(body)
          t.equals(1, body.total, 'total should be one')
          t.equals('DocumentManifest', body.entry[0].resource.resourceType, 'should return a resource of type DocumentManifest')
          t.equals('superseded', body.entry[0].resource.status, 'should have correct status')
          done()
        })
      })
    })
  })
})
