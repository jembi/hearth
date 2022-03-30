/* global open __ENV */
/* eslint no-undef: "error" */

import http from 'k6/http'
import { check } from 'k6'

const patientResource = JSON.parse(open('./resources/patient.json'))
const encounterResource = JSON.parse(open('./resources/encounter.json'))
const heightObservation = JSON.parse(open('./resources/heightResource.json'))
const weightObservation = JSON.parse(open('./resources/weightResource.json'))

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3447'

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m' },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<600']
  },
  noVUConnectionReuse: true
}

const bundleResource = {
  resourceType: 'Bundle',
  type: 'transaction',
  timestamp: Date.now(),
  entry: [
    {
      resource: patientResource,
      request: {
        method: 'POST',
        url: 'Patient'
      }
    },
    {
      resource: encounterResource,
      request: {
        method: 'POST',
        url: 'Encounter'
      }
    },
    {
      resource: heightObservation,
      request: {
        method: 'POST',
        url: 'Observation'
      }
    },
    {
      resource: weightObservation,
      request: {
        method: 'POST',
        url: 'Observation'
      }
    },
    {
      request: {
        method: 'GET'
      }
    }
  ]
}

const makeBundleRequest = () => {
  // Create full urls for the resources so they can reference each other. The math random method is used to ensure the urls are unique.
  // The uuid npm library could have been used but K6 does not run in node, and the modules would have to be bundled.
  const patientResourceFullUrl = `urn:uuid:${Date.now() + Math.random() * 1000}`
  const encounterResourceFullUrl = `urn:uuid:${Date.now() + Math.random() * 1000}`

  bundleResource.entry[0].fullUrl = patientResourceFullUrl
  bundleResource.entry[1].fullUrl = encounterResourceFullUrl

  // This is so we can retrieve the observations created.
  const patientReference = `Patient/${Date.now() + Math.random() * 1000}`

  // set the request url to find the observations created for the Patient in the bundle
  bundleResource.entry[4].request.url = `Observation?subject=${patientReference}`

  encounterResource.patient.reference = patientResourceFullUrl
  heightObservation.context.reference = encounterResourceFullUrl
  weightObservation.context.reference = encounterResourceFullUrl
  heightObservation.subject.reference = patientReference
  weightObservation.subject.reference = patientReference

  const response = http.post(
    `${BASE_URL}/fhir`,
    JSON.stringify(bundleResource),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json+fhir'
      },
      tags: {
        name: 'Create Bundle Resource'
      }
    }
  )

  const responseBody = JSON.parse(response.body)
  const totalObservations = responseBody.entry[4].resource.total

  check(response, {
    'status code for bundle creation is 200': r => r.status === 200,
    'status code for patient creation is 201': r => responseBody.entry[0].response.status === '201',
    'status code for encounter creation is 201': r => responseBody.entry[1].response.status === '201',
    'status code for height observation creation is 201': r => responseBody.entry[2].response.status === '201',
    'status code for weight observation creation is 201': r => responseBody.entry[3].response.status === '201',
    'number of observations created should be two': r => totalObservations === 2
  })
}

export default function () {
  makeBundleRequest()
}
