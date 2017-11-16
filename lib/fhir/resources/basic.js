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

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'Basic',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        code: {},
        subject: {},
        author: {},
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['code']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('code.coding', queryObject['code'][constants.NO_MODIFER]))
        }

        if (queryObject['subject']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['subject'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['author']) {
          query['$and'].push({ 'author.reference': queryUtils.paramAsReference(queryObject['author'][constants.NO_MODIFER], 'Patient') })
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
