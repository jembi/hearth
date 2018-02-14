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
const QueryBuilder = require('../query-builder')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryBuilder = QueryBuilder(mongo)

  return {
    name: 'Default',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query

      queryUtils.validateAndParseQueryParams(queryParams, '*', (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        const query = queryBuilder.buildQuery(ctx.resourceType, queryObject)

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}
