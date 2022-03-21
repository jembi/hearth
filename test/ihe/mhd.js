'use strict'

const fs = require('fs')
const path = require('path')
const tap = require('tap')
const uuid = require('uuid/v4')
const request = require('request')
const _ = require('lodash')
const moment = require('moment')
const faker = require('faker')

const mustache = require('mustache')
// disable html escaping
mustache.escape = (v) => v

const env = require('../test-env/init')()
const server = require('../../lib/server')

const host = 'http://localhost:3447/fhir'

const loadResource = (filename, conf) => {
  const resPath = path.join(__dirname, 'mhd-test-samples', filename)
  const res = fs.readFileSync(resPath).toString()
  return mustache.render(res, conf)
}

const post = (host, resourceType, headers, body, onSuccess) => {
  const url = `${host}/${resourceType}`
  request.post({
    url: url,
    body: body,
    headers: headers
  }, (err, res, body) => {
    if (err) {
      throw err
    }
    if (res.statusCode !== 201) {
      throw new Error(`Unexpected response: [${res.statusCode}] ${JSON.stringify(body)}`)
    }
    let reference
    if (res.headers.location) {
      reference = res.headers.location.replace(new RegExp(`.*(${resourceType}/[\\w\\-]+)/_history/.*`), '$1')
    }
    onSuccess(reference, body)
  })
}

const MHDScenario = (headers, t) => {
  const conf = {
    timeNow: moment().toISOString(),
    sourcePatId: uuid(),
    firstName: faker.name.firstName(1),
    lastName: faker.name.lastName(),
    providerFirstName: faker.name.firstName(1),
    providerLastName: faker.name.lastName(),
    docId: uuid(),
    manifestMID: uuid(),
    docManifestRef: `urn:uuid:${uuid()}`,
    docManifestTypeCodingSystem: 'http://hl7.org/fhir/ValueSet/c80-doc-typecodes',
    docManifestTypeCodingCode: '34117-2',
    docManifestSource: 'urn:oid:1.3.6.1.4.1.21367.2009.1.2.1',
    docManifestStatus: 'current',
    docRefMID1: uuid(),
    docRef1: `urn:uuid:${uuid()}`,
    docRefMID2: uuid(),
    docRef2: `urn:uuid:${uuid()}`,
    docRefMID3: uuid(),
    docRef3: `urn:uuid:${uuid()}`,
    binaryRef1: `urn:uuid:${uuid()}`,
    binaryRef2: `urn:uuid:${uuid()}`,
    binaryRef3: `urn:uuid:${uuid()}`
  }

  let documentBundle

  const buildDocumentBundle = () => {
    const cda = loadResource('CDA-APHP-1.xml', conf)
    conf.cdaBase64 = Buffer.from(cda).toString('base64')

    const image = loadResource('Image-1.png', conf)
    conf.imageBase64 = Buffer.from(image).toString('base64')

    const pdf = loadResource('pdf-sample.pdf', conf)
    conf.pdfBase64 = Buffer.from(pdf).toString('base64')

    const binary1 = loadResource('Binary-1.json', conf)
    const binary2 = loadResource('Binary-2.json', conf)
    const binary3 = loadResource('Binary-3.json', conf)
    const docRef1 = loadResource('DocumentReference-1.json', conf)
    const docRef2 = loadResource('DocumentReference-2.json', conf)
    const docRef3 = loadResource('DocumentReference-3.json', conf)
    const docManifest = loadResource('DocumentManifest-1.json', conf)

    documentBundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        {
          fullUrl: conf.binaryRef1,
          resource: JSON.parse(binary1),
          request: {
            method: 'POST',
            url: 'Binary'
          }
        },
        {
          fullUrl: conf.binaryRef2,
          resource: JSON.parse(binary2),
          request: {
            method: 'POST',
            url: 'Binary'
          }
        },
        {
          fullUrl: conf.binaryRef3,
          resource: JSON.parse(binary3),
          request: {
            method: 'POST',
            url: 'Binary'
          }
        },
        {
          fullUrl: conf.docRef1,
          resource: JSON.parse(docRef1),
          request: {
            method: 'POST',
            url: 'DocumentReference'
          }
        },
        {
          fullUrl: conf.docRef2,
          resource: JSON.parse(docRef2),
          request: {
            method: 'POST',
            url: 'DocumentReference'
          }
        },
        {
          fullUrl: conf.docRef3,
          resource: JSON.parse(docRef3),
          request: {
            method: 'POST',
            url: 'DocumentReference'
          }
        },
        {
          fullUrl: conf.docManifestRef,
          resource: JSON.parse(docManifest),
          request: {
            method: 'POST',
            url: 'DocumentManifest'
          }
        }
      ]
    }

    documentBundle = JSON.stringify(documentBundle)
  }

  const iti65ProvideDocumentBundle = (t, callback) => {
    t.test('ITI-65 Provide Document Bundle', { bail: true }, (t) => {
      request.post({
        url: host,
        body: documentBundle,
        headers: headers
      }, (err, res, body) => {
        t.error(err, `POST ${host}`)
        t.equals(res.statusCode, 200, 'status code should be 200')

        body = JSON.parse(body)
        t.equals(body.resourceType, 'Bundle', 'resource type should be Bundle')
        t.equals(body.type, 'transaction-response', 'bundle type should be \'transaction-response\'')
        t.equals(body.entry.length, 7, 'response should contain 7 entries')
        for (const e of body.entry) {
          // response.status is unbounded, so responses like '201 Created' are possible
          t.equals(e.response.status.substr(0, 3), '201', 'entry response status should be 201')

          if (e.response.location.indexOf('Binary') > -1) {
            // eslint-disable-next-line prefer-regex-literals
            const ref = e.response.location.replace(new RegExp('.*(Binary/[\\w\\-]+)/_history/.*'), '$1')

            if (conf.binaryResource1 && conf.binaryResource2 && !conf.binaryResource3) {
              conf.binaryResource3 = ref
            }

            if (conf.binaryResource1 && !conf.binaryResource2) {
              conf.binaryResource2 = ref
            }

            if (!conf.binaryResource1) {
              conf.binaryResource1 = ref
            }
          }
        }
        t.end()
        callback()
      })
    })
  }

  const searchManifest = (t, path) => {
    const url = `${host}/${path}`
    return new Promise((resolve) => {
      request({
        url: url,
        headers: headers
      }, (err, res, body) => {
        t.error(err, `GET ${url}`)
        t.equals(res.statusCode, 200, 'response status code should be 200')

        body = JSON.parse(body)
        t.equals(body.resourceType, 'Bundle', 'resource type should be Bundle')
        t.equals(body.type, 'searchset', 'bundle type should be \'searchset\'')

        t.equals(body.total, 1, 'searchset should contain 1 result')
        t.equals(body.entry[0].resource.resourceType, 'DocumentManifest', 'searchset should contain manifest')
        t.equals(body.entry[0].resource.masterIdentifier.value, conf.manifestMID, 'searchset should contain correct manifest')

        resolve()
      })
    })
  }

  const iti66FindDocumentManifests = (t, callback) => {
    t.test('ITI-66 Find Document Manifests', { bail: true }, (t) => {
      const promises = []

      promises.push(searchManifest(t, `DocumentManifest?patient=${conf.patientRef}`))
      promises.push(searchManifest(t, `DocumentManifest?patient.identifier=${conf.sourcePatId}`))

      promises.push(searchManifest(t, `DocumentManifest?created=${conf.timeNow}`))
      promises.push(searchManifest(t, `DocumentManifest?author.given=${conf.providerFirstName}`))
      promises.push(searchManifest(t, `DocumentManifest?author.family=${conf.providerLastName}`))
      promises.push(searchManifest(t, `DocumentManifest?type=${conf.docManifestTypeCodingSystem}|${conf.docManifestTypeCodingCode}`))
      promises.push(searchManifest(t, `DocumentManifest?type=${conf.docManifestTypeCodingCode}`))
      promises.push(searchManifest(t, `DocumentManifest?source=${conf.docManifestSource}`))
      promises.push(searchManifest(t, `DocumentManifest?status=${conf.docManifestStatus}`))

      Promise.all(promises).then(() => {
        t.end()
        callback()
      })
    })
  }

  const searchReferences = (t, path) => {
    const url = `${host}/${path}`
    return new Promise((resolve) => {
      request({
        url: url,
        headers: headers
      }, (err, res, body) => {
        t.error(err, `GET ${url}`)
        t.equals(res.statusCode, 200, 'response status code should be 200')

        body = JSON.parse(body)
        t.equals(body.resourceType, 'Bundle', 'resource type should be Bundle')
        t.equals(body.type, 'searchset', 'bundle type should be \'searchset\'')

        t.equals(body.total, 3, 'searchset should contain 3 result')
        t.equals(body.entry[0].resource.resourceType, 'DocumentReference', 'searchset should contain reference')
        t.equals(body.entry[0].resource.masterIdentifier.value, conf.docRefMID1, 'searchset should contain correct reference')
        t.equals(body.entry[1].resource.resourceType, 'DocumentReference', 'searchset should contain reference')
        t.equals(body.entry[1].resource.masterIdentifier.value, conf.docRefMID2, 'searchset should contain correct reference')
        t.equals(body.entry[2].resource.resourceType, 'DocumentReference', 'searchset should contain reference')
        t.equals(body.entry[2].resource.masterIdentifier.value, conf.docRefMID3, 'searchset should contain correct reference')

        resolve()
      })
    })
  }

  const iti67FindDocumentReferences = (t, callback) => {
    t.test('ITI-67 Find Document References', { bail: true }, (t) => {
      const promises = []

      promises.push(searchReferences(t, `DocumentReference?patient=${conf.patientRef}`))
      promises.push(searchReferences(t, `DocumentReference?patient.identifier=${conf.sourcePatId}`))
      promises.push(searchReferences(t, 'DocumentReference?status=current'))
      promises.push(searchReferences(t, `DocumentReference?indexed=eq${conf.timeNow}`))
      promises.push(searchReferences(t, `DocumentReference?indexed=eq${moment(conf.timeNow).format('YYYY')}`))
      promises.push(searchReferences(t, `DocumentReference?author.given=${conf.providerFirstName}`))
      promises.push(searchReferences(t, `DocumentReference?author.family=${conf.providerLastName}`))
      promises.push(searchReferences(t, 'DocumentReference?class=34117-2'))
      promises.push(searchReferences(t, 'DocumentReference?type=34117-2'))
      promises.push(searchReferences(t, 'DocumentReference?type=http://hl7.org/fhir/ValueSet/c80-doc-typecodes|34117-2'))
      promises.push(searchReferences(t, 'DocumentReference?setting=General%20Medicine'))
      promises.push(searchReferences(t, 'DocumentReference?period=ge2016-12-23'))
      promises.push(searchReferences(t, 'DocumentReference?facility=225732001'))
      promises.push(searchReferences(t, 'DocumentReference?event=ANNGEN'))
      promises.push(searchReferences(t, 'DocumentReference?securitylabel=N'))
      promises.push(searchReferences(t, 'DocumentReference?related-id=other-doc-1'))
      promises.push(searchReferences(t, 'DocumentReference?related-id=hearth:tests|other-doc-1'))

      Promise.all(promises).then(() => {
        t.end()
        callback()
      })
    })
  }

  const fetchBinary = (t, path, expected) => {
    const url = `${host}/${path}`
    return new Promise((resolve) => {
      request({
        url: url,
        headers: headers
      }, (err, res, body) => {
        t.error(err, `GET ${url}`)
        t.equals(res.statusCode, 200, 'response status code should be 200')

        body = JSON.parse(body)
        t.equals(body.resourceType, 'Binary', 'resource type should be Bundle')
        t.equals(body.content, expected, 'resource should contain correct content')

        resolve()
      })
    })
  }

  const fetchBinaryInContentTypeFormat = (t, path, expected, updatedHeaders) => {
    const url = `${host}/${path}`
    return new Promise((resolve) => {
      request({
        url: url,
        headers: updatedHeaders
      }, (err, res, body) => {
        t.error(err, `GET ${url}`)
        t.equals(res.statusCode, 200, 'response status code should be 200')

        t.ok(body)
        t.notOk(body.resourceType, 'should not have a resourceType property as its not a FHIR resource returned')

        const base64PDF = Buffer.from(body).toString('base64')
        t.equals(base64PDF, expected, 'resource should contain correct content')

        resolve()
      })
    })
  }

  const iti68RetrieveDocument = (t, callback) => {
    t.test('ITI-68 Retrieve Document', { bail: true }, (t) => {
      const promises = []

      promises.push(fetchBinary(t, conf.binaryResource1, conf.cdaBase64))
      promises.push(fetchBinary(t, conf.binaryResource2, conf.imageBase64))
      promises.push(fetchBinary(t, conf.binaryResource3, conf.pdfBase64))

      const updatedHeaders = _.assign({}, headers)
      updatedHeaders['content-type'] = 'application/pdf'

      promises.push(fetchBinaryInContentTypeFormat(t, conf.binaryResource3, conf.pdfBase64, updatedHeaders))

      Promise.all(promises).then(() => {
        t.end()
        callback()
      })
    })
  }

  return {
    init: (callback) => {
      const patient = loadResource('Patient-1.json', conf)
      post(host, 'Patient', headers, patient, (ref) => {
        conf.patientRef = ref
        const prac = loadResource('Practitioner-1.json', conf)
        post(host, 'Practitioner', headers, prac, (ref) => {
          conf.providerRef = ref

          buildDocumentBundle()
          callback()
        })
      })
    },

    execute: (callback) => {
      iti65ProvideDocumentBundle(t, () => {
        iti66FindDocumentManifests(t, () => {
          iti67FindDocumentReferences(t, () => {
            iti68RetrieveDocument(t, () => {
              callback()
            })
          })
        })
      })
    }
  }
}

const runTests = (Scenario, headers, t, callback) => {
  const scenario = Scenario(headers, t)
  scenario.init((err) => {
    t.error(err)

    scenario.execute((err) => {
      t.error(err)

      callback()
    })
  })
}

tap.test('MHD e2e integration test', (t) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      const headers = {
        'content-type': 'application/json+fhir'
      }

      env.getAuthHeaders('sysadmin@jembi.org', 'sysadmin', (err, auth) => {
        t.error(err)

        _.extend(headers, auth)
        runTests(MHDScenario, headers, t, () => {
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
