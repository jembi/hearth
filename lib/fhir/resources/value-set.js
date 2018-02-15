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
const QueryValidator = require('../query-validator')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryValidator = QueryValidator()

  return {
    name: 'ValueSet',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('ValueSet', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        let query = { $and: [] }

        if (queryObject['url']) {
          query['$and'].push({ 'url': queryObject['url'][constants.NO_MODIFER] })
        }

        if (queryObject['system']) {
          query['$and'].push({ 'codeSystem.system': queryObject['system'][constants.NO_MODIFER] })
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
