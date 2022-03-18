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
const QueryBuilder = require('../query-builder')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  const transformHandler = (ctx, resource, callback) => {
    resource._transforms = {}
    if (resource.indexed) {
      resource._transforms.indexed = queryUtils.transformDate(resource.indexed)
    }
    if (resource.context && resource.context.period) {
      resource._transforms.context = { period: {} }
      if (resource.context.period.start) {
        resource._transforms.context.period.start = queryUtils.transformDate(resource.context.period.start)
      }
      if (resource.context.period.end) {
        resource._transforms.context.period.end = queryUtils.transformDate(resource.context.period.end)
      }
    }
    callback()
  }

  return {
    name: 'DocumentReference',

    before: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {
        indexed: {},
        period: {}
      }

      queryValidator.validateQueryParams('DocumentReference', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject, (err, query) => {
          if (err) {
            return callback(err)
          }

          if (queryObject.indexed) {
            query.$and.push(queryUtils.paramAsDateRangeClause('_transforms.indexed', queryObject.indexed[constants.NO_MODIFER]))
          }

          if (queryObject.period) {
            query.$and.push(queryUtils.paramAsDateRangeClause({
              start: '_transforms.context.period.start',
              end: '_transforms.context.period.end'
            },
            queryObject.period[constants.NO_MODIFER]
            ))
          }

          if (query.$and.length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        })
      })
    }
  }
}
