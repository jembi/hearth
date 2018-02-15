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

  return {
    name: 'RelatedPerson',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('RelatedPerson', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        let query = { $and: [] }

        if (queryObject['_id']) {
          for (const modifier in queryObject['_id']) {
            query['$and'].push({ 'id': queryObject['_id'][modifier] })
          }
        }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        // relatedPerson name search paramater can match in given or family name
        if (queryObject['name']) {
          const nameQuery = {
            '$or': []
          }

          for (const modifier in queryObject['name']) {
            nameQuery['$or'].push(queryUtils.nameToMongoClause('given', queryObject['name'][modifier], modifier))
            nameQuery['$or'].push(queryUtils.nameToMongoClause('family', queryObject['name'][modifier], modifier))
          }

          query['$and'].push(nameQuery)
        }

        if (queryObject['gender']) {
          query['$and'].push({ gender: queryObject['gender'][constants.NO_MODIFER] })
        }

        if (queryObject['birthDate']) {
          query['$and'].push(queryUtils.dateToMongoClause('birthDate', queryObject['birthDate'][constants.NO_MODIFER]))
        }

        if (queryObject['address']) {
          for (const modifier in queryObject['address']) {
            query['$and'].push(queryUtils.addressToMongoClause('address', queryObject['address'][modifier], modifier))
          }
        }

        if (queryObject['telecom']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('telecom', queryObject['telecom'][constants.NO_MODIFER]))
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
