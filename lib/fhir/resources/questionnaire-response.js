 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()

  let summarize = (data) => {
    fhirCommon.addSubsettedSecurityLabel(data)
    delete data.group
  }

  let afterReadHook = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      summarize(data)
      return callback(null, null, data)
    }

    callback(null, null, data)
  }

  return {
    name: 'QuestionnaireResponse',

    after: {
      read: afterReadHook,
      vread: afterReadHook,
      search: (ctx, data, callback) => {
        if (ctx.query && ctx.query._summary && data.resourceType === 'Bundle') {
          data.entry.forEach((e) => summarize(e.resource))
        }
        callback(null, null, data)
      }
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('QuestionnaireResponse', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
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
