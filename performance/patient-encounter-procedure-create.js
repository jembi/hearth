import http from 'k6/http'
import {check, sleep} from 'k6'
import {patientResource} from './resources/patient.js'
import {encounterResource} from './resources/encounter.js'
import {heightObservation, weightObservation} from './resources/observation.js'

/* global __ENV */
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3447'

export const options = {
  stages: [
    {duration: '30s', target: 100},
    {duration: '1m'},
    {duration: '30s', target: 0}
  ],
  thresholds: {
    http_req_duration: ['p(95)<600']
  },
  noVUConnectionReuse: true,
  discardResponseBodies: true
}

const createPatient = () => {
  const response = http.post(
    `${BASE_URL}/fhir/Patient`,
    JSON.stringify(patientResource),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json+fhir'
      },
      tags: {
        name: 'Create Patient Resource'
      }
    }
  )
  check(response, {
    'status code for patient create is 201': r => r.status === 201
  })

  // Return patient id
  return response.headers.Location.split("/")[3]
}

const createEncounter = (patientId) => {
  encounterResource.patient.reference = `Patient/${patientId}`
  
  const response = http.post(
    `${BASE_URL}/fhir/Encounter`,
    JSON.stringify(encounterResource),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json+fhir'
      },
      tags: {
        name: 'Create Encounter Resource'
      }
    }
  )
  check(response, {
    'status code for encounter create is 201': r => r.status === 201
  })

  // Return encounter id
  return response.headers.Location.split("/")[3]
}

const createObservation = (observation, patientId, encounterId) => {
  observation.context.reference = `Encounter/${encounterId}`
  observation.subject.reference = `Patient/${patientId}`

  const response = http.post(
    `${BASE_URL}/fhir/Observation`,
    JSON.stringify(observation),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json+fhir'
      },
      tags: {
        name: `Create Observation resource`
      }
    }
  )
  check(response, {
    'status code for observation create is 201': r => r.status === 201
  })
}

// get observations performed for the patient in the encounter
const getObservations = (patientId, encounterId) => {  
  const response = http.get(
    `${BASE_URL}/fhir/Observation?subject=Patient/${patientId}&encounter=Encounter/${encounterId}`,
    {
      headers: {
        Accept: 'application/json'
      },
      tags: {
        name: 'Get Observations request'
      }
    }
  )
  check(response, {
    'status code for observations retrieval is 200': r => r.status === 200
  })
}

export default function () {
  const patientId = createPatient()
  const encounterId = createEncounter(patientId)

  createObservation(weightObservation, patientId, encounterId)
  createObservation(heightObservation, patientId, encounterId)
  getObservations(patientId, encounterId)
}
