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

  let afterReadHook = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.telecom
      delete data.address
      delete data.position
      return callback(null, null, data)
    }

    callback(null, null, data)
  }

  return {
    name: 'Location',

    after: {
      read: afterReadHook,
      vread: afterReadHook
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('Location', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        let query = { $and: [] }

        if (queryObject['organization']) {
          query['$and'].push({ 'managingOrganization.reference': queryUtils.paramAsReference(queryObject['organization'][constants.NO_MODIFER], 'Organization') })
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
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
