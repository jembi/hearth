 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const constants = require('../../constants')
const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()

  return {
    name: 'Questionnaire',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('Questionnaire', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}
