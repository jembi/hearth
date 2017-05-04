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
    return next()
  },

  createUniquePatient: (requestParams, context, ee, next) => {
    const patient = Object.assign({}, patientTemplate)
    delete patient.id
    patient.identifier = patient.identifier.slice(0, 1)
    patient.identifier[0].value = chance.ssn({ dashes: false })
    patient.name[0].prefix = [chance.prefix()]
    patient.name[0].given = [chance.first()]
    patient.name[0].family = [chance.last()]
    patient.gender = chance.gender()
    patient.birthDate = moment(chance.birthday()).format('YYYY-MM-DD')
    requestParams.json = patient
    module.exports.setAuthHeaders(requestParams, context, ee, next)
  }
}
