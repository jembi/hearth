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
    name: 'Composition',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        entry: { allowArray: true },
        patient: { modifiers: { exact: true } },
        status: { modifiers: { exact: true } },
        subject: { modifiers: { exact: true } },
        type: { modifiers: { exact: true } },
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
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
