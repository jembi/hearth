/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')

require('./test-env/init')()
const config = require('../lib/config')
const constants = require('../lib/constants')
const queryValidator = require('../lib/fhir/query-validator')()

const FHIR_VERSION = config.getConf('server:fhirVersion')
const searchParamsMap = require(`../lib/fhir/definitions/${FHIR_VERSION}/search-parameters-map.json`)

tap.test('.validateQueryParams should validate searchParams', (t) => {
  let queryParams = { test1: '1', test2: 2 }
  let customSupported = {
    test1: {
      path: 'test1',
      type: 'number'
    },
    test2: {
      path: 'test2',
      type: 'number'
    }
  }

  queryValidator.validateQueryParams('Patient', queryParams, customSupported, (badRequest, queryObject) => {
    t.error(badRequest)
    const expected = {
      test1: {
        'no-modifier': '1'
      },
      test2: {
        'no-modifier': 2
      }
    }
    t.deepEqual(queryObject, expected, 'Should return queryObject if query params are supported')
  })

  queryParams = { test1: '1' }
  customSupported = {
    test1: {
      path: 'test1',
      type: 'number',
      required: true
    },
    test2: {
      path: 'test2',
      type: 'number',
      required: true
    },
    test3: {
      path: 'test2',
      type: 'number'
    }
  }

  queryValidator.validateQueryParams('Patient', queryParams, customSupported, (badRequest, queryObject) => {
    t.ok(badRequest)
    t.equal(badRequest.message, 'This endpoint has the following required query parameters: ["test1","test2"]', 'Should return error message if required params are missing')
  })

  queryParams = { 'test1:exact': '1' }
  customSupported = {
    test1: {
      path: 'test1',
      type: 'number'
    }
  }

  queryValidator.validateQueryParams('Patient', queryParams, customSupported, (badRequest, queryObject) => {
    t.error(badRequest)
    const expected = {
      test1: {
        exact: '1'
      }
    }
    t.deepEqual(queryObject, expected, 'Should return a queryObject with supplied modifier')
  })

  t.end()
})

const testFHIRResourcesSearchParams = () => {
  const setupQueryParams = (resourceParamsObj) => {
    const query = {}

    for (const param in resourceParamsObj) {
      query[param] = 'SomeRandomValue'
    }

    return query
  }

  const setupExpected = (resourceParamsObj) => {
    const expected = {}

    for (const param in resourceParamsObj) {
      if (!expected[param]) {
        expected[param] = {}
      }

      expected[param][constants.NO_MODIFER] = 'SomeRandomValue'
    }

    return expected
  }

  const setupResourceTest = (resourceType, resourceParamsObj) => {
    tap.test(`.validateQueryParams() for resource: ${resourceType}`, (t) => {
      // All valid parameters should return a 200 with queryObject
      let queryParams = setupQueryParams(resourceParamsObj)
      const expected = setupExpected(resourceParamsObj)

      queryValidator.validateQueryParams(resourceType, queryParams, {}, (badRequest, queryObject) => {
        t.ok(queryObject)
        t.deepEqual(queryObject, expected, 'Should contain all valid query parameters for resource')
      })

      // One invalid parameter should return a 400 Bad Request response
      queryParams = setupQueryParams(resourceParamsObj)
      queryParams.unsupported = 'SomeRandomValue'

      queryValidator.validateQueryParams(resourceType, queryParams, {}, (badRequest, queryObject) => {
        t.ok(badRequest)
        t.equal(badRequest.message, 'This endpoint does not support the query parameter: unsupported', 'Should have a Bad Request error message for the unsupported parameter')
      })

      t.end()
    })
  }

  for (const resource in searchParamsMap) {
    setupResourceTest(resource, searchParamsMap[resource])
  }
}

testFHIRResourcesSearchParams()
