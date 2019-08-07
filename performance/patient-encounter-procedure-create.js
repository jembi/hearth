import http from 'k6/http'
import {check, sleep} from 'k6'
import {patientResource} from './resources/patient.js'
import {encounterResource} from './resources/encounter.js'
import {procedureResource} from './resources/procedure.js'

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
  return response.headers.Location.split("/").pop()
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
  return response.headers.Location.split("/").pop()
}

const createProcedure = (encounterId, patientId) => {
  procedureResource.encounter.reference = `Encounter/${encounterId}`
  procedureResource.subject.reference = `Patient/${patientId}`

  const response = http.post(
    `${BASE_URL}/fhir/Procedure`,
    JSON.stringify(procedureResource),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json+fhir'
      },
      tags: {
        name: `Create Procedure resource`
      }
    }
  )
  check(response, {
    'status code for procedure create is 201': r => r.status === 201
  })

   // Return procedure id
   return response.headers.Location.split("/").pop()
}

const getProcedure = (procedureId) => {
  const response = http.get(
    `${BASE_URL}/fhir/Procedure/?_id=${procedureId}`,
    {
      headers: {
        Accept: 'application/json'
      },
      tags: {
        name: 'Get procedure request'
      }
    }
  )
  check(response, {
    'status code for procedure retrieval is 200': r => r.status === 200
  })
}

const think = () => {
  sleep(Math.random() * 0.5)
}

export default function () {
  const patientId = createPatient()
  think()
  const encounterId = createEncounter(patientId)
  think()
  const procedureid_1 = createProcedure(encounterId, patientId)
  think()
  const procedureid_2 = createProcedure(encounterId, patientId)
  think()
  getProcedure(procedureid_1)
  think()
  getProcedure(procedureid_2)
}
