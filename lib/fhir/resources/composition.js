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
const constants = require('../../constants')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

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

        let query = { $and: [] }

        if (queryObject['status']) {
          query['$and'].push({ status: queryObject['status'][constants.NO_MODIFER] })
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        if (queryObject['entry']) {
          query['$and'].push(queryUtils.referenceToMongoClause('section.entry.reference', queryObject['entry'][constants.NO_MODIFER]))
        }

        if (queryObject['patient']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
        }
        if (queryObject['subject']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['subject'][constants.NO_MODIFER], 'Patient') })
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
