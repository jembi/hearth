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

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'PractitionerRole',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        _id: {},
        _lastUpdated: {},
        //organization: {},
        //type: {},
        practitioner: {},
        //'address-country': { modifiers: { exact: true } },
        _format: {},
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['_id']) {
          query['$and'].push(queryUtils.tokenToMongoClause('id', queryObject['_id'][constants.NO_MODIFER]))
        }

        if (queryObject['_lastUpdated']) {
          query['$and'].push(queryUtils.dateToMongoClause('meta.lastUpdated', queryObject['_lastUpdated'][constants.NO_MODIFER]))
        }

        if (queryObject['practitioner']) {
          query['$and'].push({ 'practitioner.reference': queryUtils.paramAsReference(queryObject['practitioner'][constants.NO_MODIFER], 'Practitioner') })
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
