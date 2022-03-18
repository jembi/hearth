/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')
const QueryBuilder = require('../query-builder')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  const afterReadHook = (ctx, data, callback) => {
    const removeProperties = (data) => {
      delete data.resource.telecom
      delete data.resource.address
      delete data.resource.extension
    }
    if (ctx.query && ctx.query._summary && ctx.query._summary === 'true') {
      if (Array.isArray(data.entry)) {
        data.entry.forEach((entry) => {
          fhirCommon.addSubsettedSecurityLabel(entry.resource)
          removeProperties(entry)
        })
      } else {
        fhirCommon.addSubsettedSecurityLabel(data)
        removeProperties(data)
      }
    }

    callback(null, null, data)
  }

  return {
    name: 'Organization',

    after: {
      search: afterReadHook,
      read: afterReadHook,
      vread: afterReadHook
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('Organization', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject, (err, query) => {
          if (err) {
            return callback(err)
          }

          if (query.$and.length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        })
      })
    }
  }
}
