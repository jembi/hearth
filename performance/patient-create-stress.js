/* global open */
/* eslint no-undef: "error" */

import http from 'k6/http'
import { check } from 'k6'

const patient = open('./resources/patient.json')

/* global __ENV */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3447'

// PATH - the path to the resource. Default is path to the patient resource
const RESOURCE_PATH = '/fhir/Patient'

export const options = {
  vus: 100,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<60']
  },
  noVUConnectionReuse: true,
  discardResponseBodies: true
}

const makePostRequest = () => {
  const response = http.post(`${BASE_URL}${RESOURCE_PATH}`,
    patient,
    {
      headers: {
        'Content-Type': 'application/json'
      },
      tags: {
        name: 'Create Patient Stress Test'
      }
    })
  check(response, {
    'status code is 201': r => r.status === 201
  })
}

export default function () {
  makePostRequest()
}
