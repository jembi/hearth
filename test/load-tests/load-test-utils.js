/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
