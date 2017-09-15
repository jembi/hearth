 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const logger = require('winston')

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  let afterReadHook = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.identifier
      delete data.telecom
      delete data.photo
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
      const supportedParams = {
        identifier: {},
        given: {},
        family: {},
        role: {},
        organization: {},
        telecom: {}
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (queryObject['given']) {
          query['$and'].push(queryUtils.nameToMongoClause('given', queryObject['given'][constants.NO_MODIFER]))
        }

        if (queryObject['family']) {
          query['$and'].push(queryUtils.nameToMongoClause('family', queryObject['family'][constants.NO_MODIFER]))
        }

        if (queryObject['role']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('practitionerRole.role.coding', queryObject['role'][constants.NO_MODIFER]))
        }

        if (queryObject['organization']) {
          let clause = {}
          clause['practitionerRole'] = {
            $elemMatch: {
              managingOrganization: {
                reference: queryUtils.paramAsReference(queryObject['organization'][constants.NO_MODIFER], 'Organization')
              }
            }
          }
          query['$and'].push(clause)
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
