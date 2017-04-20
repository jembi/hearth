'use strict'

const tap = require('tap')
const request = require('request')
const crypto = require('crypto')

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)
const testPatients = env.testPatients()

const charlton = testPatients.charlton.patient
charlton.id = '1111111111'
const emmarentia = testPatients.emmarentia.patient
const nikita = testPatients.nikita.patient

const basicMatchingTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const patients = []

      patients.push(
        charlton,
        emmarentia,
        nikita
      )

      const c = db.collection('Patient')
      c.insertMany(patients, (err, doc) => {
        t.error(err)
        t.ok(doc)
        t.equal(doc.insertedIds.length, patients.length)

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
}

const hashAndSortEntryArray = (entry) => {
  return entry.map((entry) => {
    return crypto.createHash('sha256').update(JSON.stringify(entry), 'utf-8').digest('hex')
  }).sort()
}

const requestAndAssertResponseBundle = (tp, t, done) => {
  // When
  request({
    url: `http://localhost:3447/fhir/Patient/$match`,
    headers: headers,
    method: 'POST',
    body: tp.body,
    json: true
  }, (err, res, body) => {
    // Then
    t.error(err)
    t.equal(res.statusCode, tp.statusCode, 'Response has expected status code')

    t.equal(body.resourceType, 'Bundle')
    t.equal(body.total, tp.expectedResponse.total)

    const actual = hashAndSortEntryArray(body.entry)
    t.deepEqual(actual, tp.expectedResponse.entry, 'Response contains expected entries')
    done()
  })
}

const matchOperationBodyTemplate = {
  resourceType: 'Parameters',
  parameter: [
    {
      name: 'resource',
      resource: {
        resourceType: 'Patient',
        'name': [
          {
            'family': [
              'Matinyana'
            ],
            'given': [
              'Charlton'
            ]
          }
        ]
      }
    }, {
      name: 'count',
      valueInteger: 2
    }
  ]
}

tap.test('should return 200 and a bundle of patients with search scores exactly matching the posted parameters resource', (t) => {
  // Given
  const testBody = Object.assign({}, matchOperationBodyTemplate)

  basicMatchingTest(t, (db, done) => {
    delete charlton._id
    const expectedResponse = {
      total: 1,
      entry: [
        {
          fullUrl: 'http://localhost:3447/fhir/Patient/1111111111',
          resource: charlton,
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
              valueCode: 'certain'
            },
            score: 1
          }
        }
      ]
    }
    expectedResponse.entry = hashAndSortEntryArray(expectedResponse.entry)

    const testParams = {
      body: testBody,
      expectedResponse: expectedResponse,
      statusCode: 200
    }

    requestAndAssertResponseBundle(testParams, t, done)
  })
})
