'use strict'

const Chance = require('chance')
const moment = require('moment')

const env = require('../test-env/init')()
const patientTemplate = require('../resources/Patient-1.json')

const chance = new Chance()

module.exports = {
  setAuthHeaders: (requestParams, context, ee, next) => {
    if (!requestParams.headers) {
      requestParams.headers = {}
    }
    Object.assign(requestParams.headers, env.getTestAuthHeaders('sysadmin@jembi.org'))
    next()
  },

  createUniquePatient: (requestParams, context, ee, next) => {
    const patient = Object.assign({}, patientTemplate)
    delete patient.id

    patient.identifier = patient.identifier.slice(0, 1)
    patient.identifier[0].value = chance.ssn({ dashes: false })

    patient.name[0].prefix = [chance.prefix()]
    patient.name[0].given = [chance.first()]
    patient.name[0].family = [chance.last()]

    patient.gender = chance.gender().toLowerCase()
    patient.birthDate = moment(chance.birthday()).format('YYYY-MM-DD')

    patient.telecom[0].value = chance.email()
    patient.telecom[1].value = chance.phone({ formatted: false })

    patient.address[0].line = [chance.address()]
    patient.address[0].state = chance.state({ full: true })
    patient.address[0].city = chance.city()
    patient.address[0].postalCode = chance.zip()

    patient.contact[0].name[0].given = [chance.first()]
    patient.contact[0].name[0].family = [chance.last()]
    patient.contact[0].telecom[0].value = chance.phone({ formatted: false })
    patient.contact[0].telecom[1].value = chance.email()

    patient.extension[0].url = 'pshr:profession'
    patient.extension[0].valueString = chance.suffix({ full: true })
    patient.extension[1].url = 'pshr:partnerhiv:status'
    patient.extension[1].valueBoolean = chance.bool()
    patient.extension[2].url = 'pshr:firstposivehivtest:date'
    patient.extension[2].valueDate = moment(chance.birthday()).format('YYYY-MM-DD')
    patient.extension[3].url = 'pshr:firstposivehivtest:location'
    patient.extension[3].valueString = chance.address()

    requestParams.json = patient
    next()
  }
}
