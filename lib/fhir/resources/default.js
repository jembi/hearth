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

  return {
    name: 'Default',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams(ctx.resourceType, queryParams, customSupportedParams, (badRequest, queryObject) => {
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
