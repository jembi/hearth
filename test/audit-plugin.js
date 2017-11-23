 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')
const moment = require('moment')
const request = require('request')
const _ = require('lodash')

const env = require('./test-env/init')()
const server = require('../lib/server')

const headers = env.getTestAuthHeaders(env.users.sysadminUser.email)

let auditPlugin

const fhirResources = { AuditEvent: { name: 'AuditEvent', searchFilters: () => {} } }

const testServerInit = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    auditPlugin = require('../lib/plugins/audit')(env.mongo(), fhirResources)

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

const testResourceTemplate = {
  'resourceType': 'Patient',
  'id': '1',
  'active': true,
  'identifier': [
    {
      'use': 'official',
      'system': 'pshr:passport:za',
      'value': '1001113333933',
      'assigner': {
        'display': 'Passport South Africa'
      }
    }
  ],
  'name': [
    {
      'use': 'official',
      'prefix': [
        'Mr'
      ],
      'family': [
        'Matinyana'
      ],
      'given': [
        'Charlton',
        'Joseph'
      ]
    }
  ],
  'gender': 'male',
  'birthDate': '1970-07-21'
}

const testBundleTemplate = {
  'resourceType': 'Bundle',
  'total': 2,
  'entry': [
    {
      'resource': {
        'resourceType': 'Questionnaire',
        'id': '1234567890'
      }
    },
    {
      'resource': {
        'resourceType': 'Questionnaire',
        'id': '0987654321'
      }
    }
  ]
}

tap.test('Audit Plugin - getSuccessOrFailed()', { autoend: true }, (t) => {
  t.test('should determine the event outcome value for a successful request', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const resource = JSON.parse(JSON.stringify(testResourceTemplate))

      // when
      const successOrFailValue = auditPlugin.getSuccessOrFailed(resource)

      t.equal(successOrFailValue, '0', `should return a success/fail value of 0 - Success`)

      done()
    })
  })

  t.test('should determine the event outcome value for a unsuccessful request', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const resource = {
        resourceType: 'OperationOutcome',
        issue: [{ 'severity': 'information', 'code': 'gone', 'details': { 'text': 'Gone' } }]
      }

      // when
      const successOrFailValue = auditPlugin.getSuccessOrFailed(resource)

      t.equal(successOrFailValue, '4', `should return a success/fail value of 4 - Minor Failure`)

      done()
    })
  })
})

tap.test('Audit Plugin - buildEventObj()', { autoend: true }, (t) => {
  t.test('should build the eventObj object', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const resource = JSON.parse(JSON.stringify(testResourceTemplate))

      // when
      const eventObj = auditPlugin.buildEventObj('read', resource)

      t.ok(eventObj)

      t.equals(eventObj.type.code, 'rest', 'should have a value of \'rest\'')
      t.equals(eventObj.type.display, 'Restful Operation', 'should have a value of \'Restful Operation\'')
      t.equals(eventObj.subtype[0].code, 'read', 'should have a value of \'read\'')
      t.equals(eventObj.subtype[0].display, 'read', 'should have a value of \'read\'')
      t.equals(moment(eventObj.dateTime).isValid(), true, 'should be a valid timestamp value')
      t.equals(eventObj.outcome, '0', 'should have a value of \'0\'')

      done()
    })
  })
})

tap.test('Audit Plugin - buildParticipantObj()', { autoend: true }, (t) => {
  t.test('should build the participantObj object', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const ctx = {
        authenticatedUser: {
          email: 'user@hearth.org',
          type: 'practitioner',
          resource: 'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b'
        },
        url: '/fhir/Questionnaire?identifier=preoperative-questionnaire',
        query: { identifier: 'preoperative-questionnaire' },
        headers: {
          referer: 'http://localhost:9000/'
        }
      }

      // when
      const participantObj = auditPlugin.buildParticipantObj(ctx)

      t.ok(participantObj)

      t.equals(participantObj.role[0].coding[0].system, 'hearth:user-roles', 'should have a value of \'hearth:user-roles\'')
      t.equals(participantObj.role[0].coding[0].code, 'practitioner', 'should have a value of \'practitioner\'')
      t.equals(participantObj.reference.reference, 'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b', 'should have a value of \'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b\'')
      t.equals(participantObj.userId.system, 'hearth:resource-reference', 'should have a value of \'hearth:resource-reference\'')
      t.equals(participantObj.userId.value, 'b7aeb450-8bde-11e7-812f-bbfc0872406b', 'should have a value of \'b7aeb450-8bde-11e7-812f-bbfc0872406b\'')
      t.equals(participantObj.altId, 'user@hearth.org', 'should have a value of \'user@hearth.org\'')
      t.equals(participantObj.requester, true, 'should have a value of \'true\'')

      done()
    })
  })
})

tap.test('Audit Plugin - buildSourceObj()', { autoend: true }, (t) => {
  t.test('should build the sourceObj object', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const ctx = {
        authenticatedUser: {
          email: 'jenny@sssa.org',
          type: 'practitioner',
          resource: 'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b'
        },
        url: '/fhir/Questionnaire?identifier=preoperative-questionnaire',
        query: { identifier: 'preoperative-questionnaire' },
        headers: {
          referer: 'http://localhost:9000/'
        }
      }

      // when
      const sourceObj = auditPlugin.buildSourceObj(ctx)

      t.ok(sourceObj)

      t.equals(sourceObj.site, 'Cloud', 'should have a value of \'Cloud\'')
      t.equals(sourceObj.identifier.value, 'http://localhost:9000/', 'should have a value of \'http://localhost:9000/\'')
      t.equals(sourceObj.type[0].system, 'http://hl7.org/fhir/security-source-type', 'should have a value of \'http://hl7.org/fhir/security-source-type\'')
      t.equals(sourceObj.type[0].code, 3, 'should have a value of \'3\'')
      t.equals(sourceObj.type[0].display, 'Web Server', 'should have a value of \'Web Server\'')

      done()
    })
  })
})

tap.test('Audit Plugin - buildObjectArray()', { autoend: true }, (t) => {
  t.test('should build the objectObj object', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const ctx = {
        authenticatedUser: {
          email: 'jenny@sssa.org',
          type: 'practitioner',
          resource: 'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b'
        },
        url: '/fhir/Questionnaire?identifier=preoperative-questionnaire',
        query: { identifier: 'preoperative-questionnaire' },
        headers: {
          referer: 'http://localhost:9000/'
        }
      }
      const bundle = JSON.parse(JSON.stringify(testBundleTemplate))

      // when
      const objectArray = auditPlugin.buildObjectArray(ctx, bundle)

      t.ok(objectArray)

      t.equals(objectArray[0].query, '/fhir/Questionnaire?identifier=preoperative-questionnaire', `should have a value of '/fhir/Questionnaire?identifier=preoperative-questionnaire'`)
      t.equals(objectArray[0].reference.reference, 'Questionnaire/1234567890', 'should have a value of \'Questionnaire/1234567890\'')
      t.equals(objectArray[1].reference.reference, 'Questionnaire/0987654321', 'should have a value of \'Questionnaire/0987654321\'')

      done()
    })
  })
})

tap.test('Audit Plugin - buildAuditEvent()', { autoend: true }, (t) => {
  t.test('should build the AuditEvent object', (t) => {
    testServerInit(t, (db, done) => {
      // given
      const resource = JSON.parse(JSON.stringify(testResourceTemplate))
      const ctx = {
        authenticatedUser: {
          email: 'jenny@sssa.org',
          type: 'practitioner',
          resource: 'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b'
        },
        url: '/fhir/Questionnaire?identifier=preoperative-questionnaire',
        query: { identifier: 'preoperative-questionnaire' },
        headers: {
          referer: 'http://localhost:9000/'
        }
      }

      // when
      const auditEvent = auditPlugin.buildAuditEvent('read', ctx, 'Patient', resource)

      t.ok(auditEvent)
      t.ok(auditEvent.event)
      t.ok(auditEvent.participant)
      t.ok(auditEvent.source)
      t.ok(auditEvent.object)

      done()
    })
  })
})

tap.test('Audit Plugin - create audit via fhirCore.create()', { autoend: true }, (t) => {
  t.test('should build and create a new audit event in the AuditEvent collection', (t) => {
    testServerInit(t, (db, done) => {
      // when
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

        const cPatient = db.collection('Patient')
        cPatient.findOne({}, (err, patient) => {
          t.error(err)
          t.ok(patient, 'patient should exist in mongo')

          const c = db.collection('AuditEvent')
          c.findOne({}, (err, result) => {
            t.error(err)
            t.ok(result, 'result should exist in mongo')

            t.equals(result.participant[0].role[0].coding[0].system, 'hearth:user-roles', 'should have a value of \'hearth:user-roles\'')
            t.equals(result.participant[0].role[0].coding[0].code, 'sysadmin', 'should have a value of \'sysadmin\'')
            t.equals(result.participant[0].altId, 'sysadmin@jembi.org')
            t.equals(result.object[0].reference.reference, `Patient/${patient.id}`)

            done()
          })
        })
      })
    })
  })
})
