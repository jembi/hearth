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
  vus: 10,
  iterations: 1000,
  thresholds: {
    http_req_receiving: ['p(95)<100'],
    http_req_duration: ['p(95)<100']
  },
  noVUConnectionReuse: true,
  discardResponseBodies: true
}

let patientResourceFullUrl
let encounterResourceFullUrl

const bundleResource = {
  resourceType: 'Bundle',
  type: 'transaction',
  timestamp: Date.now(),
  entry: [
    {
      fullUrl: patientResourceFullUrl,
      resource: patientResource,
      request: {
        method: 'POST',
        url: `Patient`
      }
    },
    {
      fullUrl: encounterResourceFullUrl,
      resource: encounterResource,
      request: {
        method: 'POST',
        url: `Encounter`
      }
    },
    {
      resource: heightObservation,
      request: {
        method: 'POST',
        url: `Observation`
      }
    },
    {
      resource: weightObservation,
      request: {
        method: 'POST',
        url: `Observation`
      }
    }
  ]
}

const makeBundleRequest = () => {
  // Create full urls for the resources so they can reference each other. THe math random method is used to ensure the urls are unique.
  // The uuid npm library could have been used but K6 does not run in node, and the modules would have to be bundled.
  patientResourceFullUrl = `urn:uuid:${Date.now() + Math.floor(Math.random() * 1000)}`
  encounterResourceFullUrl = `urn:uuid:${Date.now() + Math.floor(Math.random() * 1000)}`

  bundleResource.entry[0].fullUrl = patientResourceFullUrl
  bundleResource.entry[1].fullUrl = encounterResourceFullUrl

  encounterResource.patient.reference = patientResourceFullUrl
  heightObservation.context.reference = patientResourceFullUrl
  weightObservation.context.reference = patientResourceFullUrl
  heightObservation.subject.reference = encounterResourceFullUrl
  weightObservation.subject.reference = encounterResourceFullUrl

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

  check(response, {
    'status code for bundle creation is 200': r => r.status === 200
  })
}

export default function () {
  makeBundleRequest()
}
