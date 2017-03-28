'use strict'
process.env.NODE_ENV = 'test'
require('../../lib/init')

const Mongo = require('../../lib/mongo')
const crypto = require('crypto')
const request = require('request')
const moment = require('moment')
const _ = require('lodash')

const sysadminUser = {
  email: 'sysadmin@jembi.org',
  hash: '4956a991e772edd0576e62eae92f9c94fc693a2d0ee07f8f46ccce9c343d0836304f4de2ea64a41932fe0a6adc83d853a964fb785930fb4293fef8ee37448ac8',
  salt: '08f3a235-8660-49e9-93c3-5d4655b98c83',
  type: 'sysadmin'
}

module.exports = () => {
  let mongo = null
  let db = null

  // adapted from
  // https://github.com/jembi/openhim-core-js/blob/f69547897660983b07a16444ddff40e2ff47c548/test/testUtils.coffee#L165-L180
  const getTestAuthHeaders = (username) => {
    const authTS = new Date().toISOString()
    const requestsalt = '842cd4a0-1a91-45a7-bf76-c292cb36b2e8'
    const tokenhash = crypto.createHash('sha512')
    tokenhash.update(sysadminUser.hash)
    tokenhash.update(requestsalt)
    tokenhash.update(authTS)

    const auth = {
      'auth-username': username,
      'auth-ts': authTS,
      'auth-salt': requestsalt,
      'auth-token': tokenhash.digest('hex')
    }

    return auth
  }

  const getAuthHeaders = (username, password, callback) => {
    request({
      url: `http://localhost:3447/api/authenticate/${username}`,
      json: true
    }, (err, res, body) => {
      if (err) {
        return callback(err)
      }

      const passhash = crypto.createHash('sha512')
      passhash.update(body.salt)
      passhash.update(password)
      const tokenhash = crypto.createHash('sha512')
      tokenhash.update(passhash.digest('hex'))
      tokenhash.update(body.salt)
      tokenhash.update(body.ts)

      const auth = {
        'auth-username': username,
        'auth-ts': body.ts,
        'auth-salt': body.salt,
        'auth-token': tokenhash.digest('hex')
      }

      callback(null, auth)
    })
  }

  const updateTestOrganizationReferences = (testOrg, resource) => {
    testOrg.resource = resource
    testOrg.organization.id = resource.replace('Organization/', '')
    testOrg.location.managingOrganization.reference = resource
  }

  const updateTestPractitionerReferences = (testPrac, resource) => {
    testPrac.resource = resource
    testPrac.practitioner.id = resource.replace('Practitioner/', '')
  }

  const updateTestPatientReferences = (testPatient, location) => {
    const resource = location.replace('/fhir/', '').replace(/\/_history\/.*/, '')
    const vid = location.replace(/\/fhir\/Patient\/.*\/_history\//, '')
    testPatient.resource = resource
    testPatient.patient.id = resource.replace('Patient/', '')
    testPatient.patient.meta = {versionId: vid}
    testPatient.allergy.patient.reference = resource
    testPatient.encounter.patient.reference = resource
    testPatient.procedure.subject.reference = resource
    testPatient.preop.subject.reference = resource
    testPatient.preop.source.reference = resource
  }

  return {
    mongo: () => mongo,

    initDB: (createSysadmin, callback) => {
      // createSysadmin is optional - defaults to true
      if (typeof createSysadmin === 'function') {
        callback = createSysadmin
        createSysadmin = true
      }

      if (!mongo) {
        mongo = Mongo()
      }

      mongo.getDB((err, _db) => {
        if (err) {
          return callback(err)
        }

        _db.dropDatabase((err) => {
          if (err) {
            return callback(err)
          }
          db = _db

          if (createSysadmin) {
            const user = db.collection('user')
            user.insert(sysadminUser, (err) => {
              if (err) {
                return callback(err)
              }

              // all done
              callback(null, db)
            })
          } else {
            // all done
            callback(null, db)
          }
        })
      })
    },

    clearDB: (callback) => {
      if (!db) {
        return callback(new Error('db not initialized'))
      }

      db.dropDatabase((err) => {
        if (err) {
          return callback(err)
        }

        mongo.closeDB(callback)
        mongo = null
      })
    },

    users: {
      sysadminUser: sysadminUser
    },

    getTestAuthHeaders: getTestAuthHeaders,
    getAuthHeaders: getAuthHeaders,

    testOrganizations: () => {
      const testOrgs = {
        greenwood: {
          organization: _.cloneDeep(require('../resources/Organization-1.json')),
          location: _.cloneDeep(require('../resources/Location-1.json'))
        },
        redwood: {
          organization: _.cloneDeep(require('../resources/Organization-1.json')),
          location: _.cloneDeep(require('../resources/Location-1.json'))
        },
        goodhealth: {
          organization: _.cloneDeep(require('../resources/Organization-1.json')),
          location: _.cloneDeep(require('../resources/Location-1.json'))
        }
      }
      delete testOrgs.greenwood.organization.id
      delete testOrgs.greenwood.location.id
      delete testOrgs.redwood.organization.id
      delete testOrgs.redwood.location.id
      delete testOrgs.goodhealth.organization.id
      delete testOrgs.goodhealth.location.id
      testOrgs.redwood.organization.name = 'Redwood Clinical Practice'
      testOrgs.redwood.location.name = 'Redwood Clinical Practice'
      testOrgs.goodhealth.organization.name = 'Good Health Hospital Group Pty Ltd'
      testOrgs.goodhealth.location.name = 'Good Health Hospital Cape Town'
      testOrgs.goodhealth.location.type.coding[0].code = 'HOSP'

      return testOrgs
    },

    updateTestOrganizationReferences: updateTestOrganizationReferences,

    testPractitioners: () => {
      const testPrac = {
        alison: {
          email: 'drtobi@email.com',
          password: 'alison',
          practitioner: _.cloneDeep(require('../resources/Practitioner-1.json'))
        },
        henry: {
          email: 'drbaron@email.com',
          password: 'alison',
          practitioner: _.cloneDeep(require('../resources/Practitioner-1.json'))
        },
        edwino: {
          email: 'drrolles@email.com',
          password: 'edwino',
          practitioner: _.cloneDeep(require('../resources/Practitioner-1.json'))
        },
        ashmene: {
          email: 'drdavis@email.com',
          password: 'ashmene',
          practitioner: _.cloneDeep(require('../resources/Practitioner-1.json'))
        }
      }
      delete testPrac.alison.practitioner.id
      delete testPrac.henry.practitioner.id
      delete testPrac.edwino.practitioner.id
      delete testPrac.ashmene.practitioner.id
      testPrac.henry.practitioner.name.given = ['Henry']
      testPrac.henry.practitioner.name.family = ['Baron']
      testPrac.henry.practitioner.identifier[0].value = '1007211122222'
      testPrac.henry.practitioner.telecom[0].value = testPrac.henry.email
      testPrac.henry.practitioner.practitionerRole[0].role.coding[0].code = 'surgeon'
      testPrac.edwino.practitioner.name.given = ['Edwino']
      testPrac.edwino.practitioner.name.family = ['Rolles']
      testPrac.edwino.practitioner.identifier[0].value = '1007211133333'
      testPrac.edwino.practitioner.telecom[0].value = testPrac.edwino.email
      testPrac.edwino.practitioner.practitionerRole[0].role.coding[0].code = 'anaesthetist'
      testPrac.ashmene.practitioner.name.given = ['Ashmene']
      testPrac.ashmene.practitioner.name.family = ['Davis']
      testPrac.ashmene.practitioner.identifier[0].value = '1007211144444'
      testPrac.ashmene.practitioner.telecom[0].value = testPrac.ashmene.email
      testPrac.ashmene.practitioner.practitionerRole[0].role.coding[0].code = 'anaesthetist'

      return testPrac
    },

    updateTestPractitionerReferences: updateTestPractitionerReferences,

    testPatients: () => {
      const testPatients = {
        charlton: {
          email: 'charlton@email.com',
          password: 'charlton',
          patient: _.cloneDeep(require('../resources/Patient-1.json')),
          allergy: _.cloneDeep(require('../resources/AllergyIntolerance-1.json')),
          encounter: _.cloneDeep(require('../resources/Encounter-1.json')),
          procedure: _.cloneDeep(require('../resources/ProcedureRequest-1.json')),
          preop: _.cloneDeep(require('../resources/QuestionnaireResponse-1.json'))
        },
        emmarentia: {
          email: 'emmarentia@email.com',
          password: 'emmarentia',
          patient: _.cloneDeep(require('../resources/Patient-1.json')),
          allergy: _.cloneDeep(require('../resources/AllergyIntolerance-1.json')),
          encounter: _.cloneDeep(require('../resources/Encounter-1.json')),
          procedure: _.cloneDeep(require('../resources/ProcedureRequest-1.json')),
          preop: _.cloneDeep(require('../resources/QuestionnaireResponse-1.json'))
        },
        nikita: {
          email: 'nikita@email.com',
          password: 'nikita',
          patient: _.cloneDeep(require('../resources/Patient-1.json')),
          allergy: _.cloneDeep(require('../resources/AllergyIntolerance-1.json')),
          encounter: _.cloneDeep(require('../resources/Encounter-1.json')),
          procedure: _.cloneDeep(require('../resources/ProcedureRequest-1.json')),
          preop: _.cloneDeep(require('../resources/QuestionnaireResponse-1.json'))
        },
        mwawi: {
          email: 'mwawi@email.com',
          password: 'mwawi',
          patient: _.cloneDeep(require('../resources/Patient-1.json')),
          allergy: _.cloneDeep(require('../resources/AllergyIntolerance-1.json')),
          encounter: _.cloneDeep(require('../resources/Encounter-1.json')),
          procedure: _.cloneDeep(require('../resources/ProcedureRequest-1.json')),
          preop: _.cloneDeep(require('../resources/QuestionnaireResponse-1.json'))
        }
      }

      delete testPatients.charlton.patient.id
      delete testPatients.charlton.allergy.id
      delete testPatients.charlton.encounter.id
      delete testPatients.charlton.procedure.id
      delete testPatients.charlton.preop.id
      delete testPatients.emmarentia.patient.id
      delete testPatients.emmarentia.allergy.id
      delete testPatients.emmarentia.encounter.id
      delete testPatients.emmarentia.procedure.id
      delete testPatients.emmarentia.preop.id
      delete testPatients.nikita.patient.id
      delete testPatients.nikita.allergy.id
      delete testPatients.nikita.encounter.id
      delete testPatients.nikita.procedure.id
      delete testPatients.nikita.preop.id
      delete testPatients.mwawi.patient.id
      delete testPatients.mwawi.allergy.id
      delete testPatients.mwawi.encounter.id
      delete testPatients.mwawi.procedure.id
      delete testPatients.mwawi.preop.id
      testPatients.emmarentia.patient.name[0].prefix = ['Ms']
      testPatients.emmarentia.patient.name[0].given = ['Emmarentia']
      testPatients.emmarentia.patient.name[0].family = ['Cook']
      testPatients.emmarentia.patient.identifier[0].value = '1007211152222'
      testPatients.emmarentia.patient.birthDate = '1970-07-21'
      testPatients.emmarentia.patient.gender = 'female'
      testPatients.emmarentia.patient.telecom[0].value = testPatients.emmarentia.email
      testPatients.emmarentia.encounter.period.start = moment().format('YYYY-MM-DD')
      testPatients.nikita.patient.name[0].prefix = ['Mrs']
      testPatients.nikita.patient.name[0].given = ['Nikita', 'Becky']
      testPatients.nikita.patient.name[0].family = ['Sekhotla']
      testPatients.nikita.patient.identifier[0].value = '1007211153333'
      testPatients.nikita.patient.birthDate = '1970-01-16'
      testPatients.nikita.patient.gender = 'female'
      testPatients.nikita.patient.telecom[0].value = testPatients.nikita.email
      testPatients.nikita.encounter.period.start = moment().format('YYYY-MM-DD')
      testPatients.mwawi.patient.name[0].prefix = ['Ms']
      testPatients.mwawi.patient.name[0].given = ['Mwawi', 'Scot']
      testPatients.mwawi.patient.name[0].family = ['Ntshwanti']
      testPatients.mwawi.patient.identifier[0].value = '1007211154444'
      testPatients.mwawi.patient.birthDate = '1980-09-12'
      testPatients.mwawi.patient.gender = 'female'
      testPatients.mwawi.patient.telecom[0].value = testPatients.mwawi.email
      testPatients.mwawi.encounter.period.start = moment().format('YYYY-MM-DD')

      return testPatients
    },

    testUsers: () => {
      return {
        jane: {
          email: 'jane@test.org',
          hash: '4956a991e772edd0576e62eae92f9c94fc693a2d0ee07f8f46ccce9c343d0836304f4de2ea64a41932fe0a6adc83d853a964fb785930fb4293fef8ee37448ac8',
          salt: '08f3a235-8660-49e9-93c3-5d4655b98c83',
          type: 'sysadmin'
        },
        john: {
          email: 'john@test.org',
          hash: '4956a991e772edd0576e62eae92f9c94fc693a2d0ee07f8f46ccce9c343d0836304f4de2ea64a41932fe0a6adc83d853a964fb785930fb4293fef8ee37448ac8',
          salt: '08f3a235-8660-49e9-93c3-5d4655b98c83',
          type: 'sysadmin'
        },
        locked: {
          email: 'locked@test.org',
          hash: '4956a991e772edd0576e62eae92f9c94fc693a2d0ee07f8f46ccce9c343d0836304f4de2ea64a41932fe0a6adc83d853a964fb785930fb4293fef8ee37448ac8',
          salt: '08f3a235-8660-49e9-93c3-5d4655b98c83',
          type: 'sysadmin',
          locked: true
        }
      }
    },

    testBinaryFiles: () => {
      // read binary data
      var base64EncodedText = 'TG9yZW0gSXBzdW0gaXMgc2ltcGx5IGR1bW15IHRleHQgb2YgdGhlIHByaW50aW5nIGFuZCB0eXBlc2V0dGluZyBpbmR1c3RyeS4gTG9yZW0gSXBzdW0gaGFzIGJlZW4gdGhlIGluZHVzdHJ5J3Mgc3RhbmRhcmQgZHVtbXkgdGV4dCBldmVyIHNpbmNlIHRoZSAxNTAwcywgd2hlbiBhbiB1bmtub3duIHByaW50ZXIgdG9vayBhIGdhbGxleSBvZiB0eXBlIGFuZCBzY3JhbWJsZWQgaXQgdG8gbWFrZSBhIHR5cGUgc3BlY2ltZW4gYm9vay4g'

      return {
        doc1: {
          resourceType: 'Binary',
          contentType: 'application/json',
          content: base64EncodedText
        },
        doc2: {
          resourceType: 'Binary',
          contentType: 'application/pdf',
          content: base64EncodedText
        },
        doc3: {
          resourceType: 'Binary',
          contentType: 'application/pdf',
          content: base64EncodedText
        },
        doc4: {
          resourceType: 'Binary',
          contentType: 'application/xml',
          content: base64EncodedText
        }
      }
    },

    updateTestPatientReferences: updateTestPatientReferences,

    createOrganization: (t, testOrg, callback) => {
      request.post({
        url: 'http://localhost:3447/fhir/Organization',
        body: testOrg.organization,
        headers: getTestAuthHeaders(sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201)

        const ref = res.headers.location.replace('/fhir/', '').replace(/\/_history\/.*/, '')
        updateTestOrganizationReferences(testOrg, ref)

        request.post({
          url: 'http://localhost:3447/fhir/Location',
          body: testOrg.location,
          headers: getTestAuthHeaders(sysadminUser.email),
          json: true
        }, (err, res, body) => {
          t.error(err)
          t.equal(res.statusCode, 201)
          const id = res.headers.location.replace('/fhir/Location/', '').replace(/\/_history\/.*/, '')
          testOrg.location.id = id
          callback()
        })
      })
    },

    createPractitioner: (t, testPrac, testOrg, callback) => {
      testPrac.practitioner.practitionerRole[0].managingOrganization.reference = testOrg.resource

      request.post({
        url: 'http://localhost:3447/fhir/Practitioner',
        body: testPrac.practitioner,
        headers: getTestAuthHeaders(sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201)

        const ref = res.headers.location.replace('/fhir/', '').replace(/\/_history\/.*/, '')
        updateTestPractitionerReferences(testPrac, ref)
        callback()
      })
    },

    createPatient: (t, testPatient, callback) => {
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        body: testPatient.patient,
        headers: getTestAuthHeaders(sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201)

        updateTestPatientReferences(testPatient, res.headers.location)
        callback()
      })
    },

    // create a test patient with several clinical resources
    createPatientWithResources: (t, testPatient, provider1, provider2, hospital, callback) => {
      request.post({
        url: 'http://localhost:3447/fhir/Patient',
        body: testPatient.patient,
        headers: getTestAuthHeaders(sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201)

        updateTestPatientReferences(testPatient, res.headers.location)

        request.post({
          url: 'http://localhost:3447/fhir/AllergyIntolerance',
          body: testPatient.allergy,
          headers: getTestAuthHeaders(sysadminUser.email),
          json: true
        }, (err, res, body) => {
          t.error(err)
          t.equal(res.statusCode, 201)

          const id = res.headers.location.replace('/fhir/AllergyIntolerance/', '').replace(/\/_history\/.*/, '')
          testPatient.allergy.id = id

          testPatient.encounter.participant[0].individual.reference = provider1.resource
          testPatient.encounter.participant[1].individual.reference = provider2.resource
          testPatient.encounter.location[0].location.reference = `Location/${hospital.location.id}`

          request.post({
            url: 'http://localhost:3447/fhir/Encounter',
            body: testPatient.encounter,
            headers: getTestAuthHeaders(sysadminUser.email),
            json: true
          }, (err, res, body) => {
            t.error(err)
            t.equal(res.statusCode, 201)

            const encounterRef = res.headers.location.replace('/fhir/', '').replace(/\/_history\/.*/, '')
            testPatient.procedure.encounter.reference = encounterRef
            testPatient.encounter.id = encounterRef.replace('Encounter/', '')

            request.post({
              url: 'http://localhost:3447/fhir/ProcedureRequest',
              body: testPatient.procedure,
              headers: getTestAuthHeaders(sysadminUser.email),
              json: true
            }, (err, res, body) => {
              t.error(err)
              t.equal(res.statusCode, 201)

              const id = res.headers.location.replace('/fhir/ProcedureRequest/', '').replace(/\/_history\/.*/, '')
              testPatient.procedure.id = id
              testPatient.preop.encounter.reference = encounterRef

              request.post({
                url: 'http://localhost:3447/fhir/QuestionnaireResponse',
                body: testPatient.preop,
                headers: getTestAuthHeaders(sysadminUser.email),
                json: true
              }, (err, res, body) => {
                t.error(err)
                t.equal(res.statusCode, 201)

                const id = res.headers.location.replace('/fhir/QuestionnaireResponse/', '').replace(/\/_history\/.*/, '')
                testPatient.preop.id = id
                callback()
              })
            })
          })
        })
      })
    },

    createUser: (t, testUser, callback) => {
      request.post({
        url: 'http://localhost:3447/api/user',
        body: testUser,
        headers: getTestAuthHeaders(sysadminUser.email),
        json: true
      }, (err, res, body) => {
        t.error(err)
        t.equal(res.statusCode, 201)

        callback()
      })
    },

    createResource: (t, resource, resourceType, callback) => {
      request.post({
        url: `http://localhost:3447/fhir/${resourceType}`,
        body: resource,
        headers: getTestAuthHeaders(sysadminUser.email),
        json: true
      }, (err, res, body) => {
        if (err) {
          return callback(err)
        }

        t.equal(res.statusCode, 201, `should save test resource of type ${resourceType}`)

        const ref = res.headers.location.replace('/fhir/', '').replace(/\/_history\/.*/, '')
        callback(null, ref)
      })
    }
  }
}
