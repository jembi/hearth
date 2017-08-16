'use strict'

const env = require('../test/test-env/init')()
const locationTemplate1 = require('../test/resources/Location-Ghana-1.json')
const locationTemplate2 = require('../test/resources/Location-Ghana-2.json')
const locationTemplate3 = require('../test/resources/Location-Ghana-3.json')
const locationTemplate4 = require('../test/resources/Location-Ghana-4.json')
const locationTemplate5 = require('../test/resources/Location-Ghana-5.json')

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

    requestParams.json = location
    next()
  },

  createLocation2: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate2)
    delete location.id

    requestParams.json = location
    next()
  },

  createLocation3: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate3)
    delete location.id

    requestParams.json = location
    next()
  },

  createLocation4: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate4)
    delete location.id

    requestParams.json = location
    next()
  },

  createLocation5: (requestParams, context, ee, next) => {
    const location = Object.assign({}, locationTemplate5)
    delete location.id

    requestParams.json = location
    next()
  }
}
