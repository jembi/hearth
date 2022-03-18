/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const config = require('../config')
const constants = require('../constants')

const standardFHIRParams = ['_summary', '_count', '_getpagesoffset', '_include', '_revinclude']
const standardFHIRSearchParams = ['_content', '_id', '_lastUpdated', '_profile', '_query', '_security', '_tag']
const FHIR_VERSION = config.getConf('server:fhirVersion')
const searchParamsMap = require(`./definitions/${FHIR_VERSION}/search-parameters-map.json`)
const extensionConf = require('../../config/queryparam-extensions.json')

module.exports = () => {
  return {
    standardFHIRParams: standardFHIRParams,
    standardFHIRSearchParams: standardFHIRSearchParams,

    validateQueryParams: (resourceType, queryParams, customSupported, callback) => {
      const supportedParams = Object.assign({}, searchParamsMap[resourceType], customSupported, extensionConf[resourceType])

      const getRequiredParams = (obj) => {
        const requiredParams = []
        for (const key in obj) {
          if (obj[key].required) {
            requiredParams.push(key)
          }
        }
        return requiredParams
      }

      const queryObject = {}
      // sanitize object for required check
      for (const key in queryParams) {
        const keySplit = key.split(':')
        const keyActual = keySplit[0]
        const keyModifier = keySplit[1] || constants.NO_MODIFER

        // valid param if key found in standardFHIRParams
        if (standardFHIRParams.indexOf(keyActual) !== -1) {
          continue
        }

        // valid param if key found in standardFHIRSearchParams - add to supportedParams for processing
        if (standardFHIRSearchParams.indexOf(keyActual) !== -1) {
          supportedParams[keyActual] = queryParams[key]
        }

        // parameter not supported and allow all chained parameter through (params with a '.'' in them)
        if (!supportedParams[keyActual] && !keyActual.includes('.')) {
          return callback(new Error(`This endpoint does not support the query parameter: ${keyActual}`))
        }

        if (!queryObject[keyActual]) {
          queryObject[keyActual] = {}
        }
        queryObject[keyActual][keyModifier] = queryParams[key]
      }

      // check required fields first
      for (const key in customSupported) {
        // required value not in queryParams
        if (customSupported[key].required && !queryObject[key]) {
          const requiredParams = getRequiredParams(customSupported)
          return callback(new Error(`This endpoint has the following required query parameters: ${JSON.stringify(requiredParams)}`))
        }
      }

      callback(null, queryObject)
    }
  }
}
