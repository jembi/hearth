'use strict'

const Chance = require('chance')
const moment = require('moment')

const env = require('../test/test-env/init')()
const locationTemplate1 = require('../resources/Location-Ghana-1.json')
const locationTemplate1 = require('../resources/Location-Ghana-2.json')
const locationTemplate1 = require('../resources/Location-Ghana-3.json')
const locationTemplate1 = require('../resources/Location-Ghana-4.json')
const locationTemplate1 = require('../resources/Location-Ghana-5.json')

const chance = new Chance()

module.exports = {
  setAuthHeaders: (requestParams, context, ee, next) => {
    if (!requestParams.headers) {
      requestParams.headers = {}
    }
    Object.assign(requestParams.headers, env.getTestAuthHeaders('sysadmin@jembi.org'))
    next()
  },

  createLocation1: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate1)
    delete location.id

    location.identifier = location.identifier.slice(0, 1)
    location.identifier[0].value = chance.ssn({ dashes: false })

    requestParams.json = location
    next()
  }

  createLocation2: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate2)
    delete location.id

    location.identifier = location.identifier.slice(0, 1)
    location.identifier[0].value = chance.ssn({ dashes: false })

    requestParams.json = location
    next()
  }

  createLocation3: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate3)
    delete location.id

    location.identifier = location.identifier.slice(0, 1)
    location.identifier[0].value = chance.ssn({ dashes: false })

    requestParams.json = location
    next()
  }

  createLocation4: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate4)
    delete location.id

    location.identifier = location.identifier.slice(0, 1)
    location.identifier[0].value = chance.ssn({ dashes: false })

    requestParams.json = location
    next()
  }

  createLocation5: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate5)
    delete location.id

    location.identifier = location.identifier.slice(0, 1)
    location.identifier[0].value = chance.ssn({ dashes: false })

    requestParams.json = location
    next()
  }
}
