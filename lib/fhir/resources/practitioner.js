 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const logger = require('../../logger')

const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')
const QueryBuilder = require('../query-builder')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  let afterReadHook = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.photo
      delete data.qualification
      delete data.communication
      return callback(null, null, data)
    }

    fhirCommon.dereferenceAttachment(data, (err) => {
      if (err) {
        logger.warn(err)
      }
      callback(null, null, data)
    })
  }

  return {
    name: 'Practitioner',

    before: {
      create: (ctx, resource, callback) => {
        fhirCommon.referenceAttachment(resource, (err) => {
          if (err) {
            return callback(err)
          }
          callback()
        })
      }
    },

    after: {
      read: afterReadHook,
      vread: afterReadHook
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {}

      queryValidator.validateQueryParams('Practitioner', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject, (err, query) => {
          if (err) {
            return callback(err)
          }

          if (query['$and'].length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        })
      })
    }
  }
}
