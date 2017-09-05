 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

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

    patient.address[0].state = chance.state({ full: true })
    patient.address[0].district = chance.province({ full: true })
    patient.address[0].line = [chance.province({ full: true }), chance.city(), chance.address()]

    patient.contact[0].name[0].given = [chance.first()]
    patient.contact[0].name[0].family = [chance.last()]
    patient.contact[0].telecom[0].value = chance.phone({ formatted: false })
    patient.contact[0].telecom[1].value = chance.email()

    patient.extension = [ { url: 'rcbs:profession', valueString: chance.suffix({ full: true }) } ]

    requestParams.json = patient
    next()
  }
}
