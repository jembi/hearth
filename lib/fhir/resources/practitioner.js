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
const atnaAudit = require('../../atna-audit')
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

      if ( ctx.hasOwnProperty('fullUrl') ) {
        const auditMsg = atnaAudit.buildmCSDAuditMsg(ctx, 'ITI-90', 'Selective')
        logger.warn(auditMsg)
        atnaAudit.sendAuditEvent(auditMsg, function (err) {
          if (err) {
            return logger.warn(err)
          }
        })
      }

      const supportedParams = {
        _id : {},
        _lastUpdated : {},
        active: {},
        identifier: { allowArray: true },
        given: { allowArray: true, modifiers: { exact: true, contains: true } },
        family: { allowArray: true, modifiers: { exact: true, contains: true } },
        name: { allowArray: true, modifiers: { exact: true, contains: true } },
        role: {},
        telecom: {},
        communication: {},
        address: { allowArray: true, modifiers: { exact: true } },
        'address-state': { allowArray: true, modifiers: { exact: true } },
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

        if (queryObject['active']) {
          query['$and'].push(queryUtils.boolToMongoClause('active', queryObject['active'][constants.NO_MODIFER]))
        }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (queryObject['given']) {
          for (const modifier in queryObject['given']) {
            query['$and'].push(queryUtils.nameToMongoClause('given', queryObject['given'][modifier], modifier))
          }
        }

        if (queryObject['family']) {
          for (const modifier in queryObject['family']) {
            query['$and'].push(queryUtils.nameToMongoClause('family', queryObject['family'][modifier], modifier))
          }
        }

        if (queryObject['name']) {
          for (const modifier in queryObject['name']) {
            query['$and'].push(queryUtils.nameToMongoClause('name', queryObject['name'][modifier], modifier))
          }
        }

        if (queryObject['role']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('practitionerRole.role.coding', queryObject['role'][constants.NO_MODIFER]))
        }

        if (queryObject['telecom']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('telecom', queryObject['telecom'][constants.NO_MODIFER]))
        }
        
        if (queryObject['communication']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('communication.coding', queryObject['communication'][constants.NO_MODIFER]))
        }

        if (queryObject['address']) {
          for (const modifier in queryObject['address']) {
            query['$and'].push(queryUtils.addressToMongoClause('address', queryObject['address'][modifier], modifier))
          }
        }

        if (queryObject['address-state']) {
          for (const modifier in queryObject['address-state']) {
            query['$and'].push(queryUtils.addressToMongoClause('state', queryObject['address-state'][modifier], modifier))
          }
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
