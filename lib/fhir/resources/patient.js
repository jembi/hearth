 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const logger = require('../../logger')

const config = require('../../config')
const FhirCommon = require('../common')
const PixmService = require('../services/pixm')
const atnaAudit = require('../../atna-audit')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')
const QueryBuilder = require('../query-builder')

const structDefMap = require(`../definitions/${config.getConf('server:fhirVersion')}/structure-definition-map.json`)

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const pixmService = PixmService(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  let afterReadHook = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.telecom
      delete data.communication
      delete data.address
      delete data.photo
      delete data.contact
      delete data.extension
      return callback(null, null, data)
    }

    fhirCommon.dereferenceAttachment(data, (err) => {
      if (err) {
        logger.warn(err)
      }
      callback(null, null, data)
    })
  }

  let afterSearchHook = (ctx, data, callback) => {
    if (ctx.operation === '$ihe-pix') {
      pixmService.afterSearchHook(ctx, data.entry, callback)
    } else {
      // If an identifier system does not exist in mongo return a 404
      if (data.entry.length === 0 && ctx.query['identifier']) {
        mongo.getDB((err, db) => {
          if (err) {
            return callback(err)
          }

          let domains = queryUtils.removeIdentifiersFromTokens(ctx.query['identifier'])
          if (!domains) {
            return callback(null, null, data)
          }

          const propertyDefObj = structDefMap.Patient.elements.identifier
          let query = queryUtils.tokenToSystemValue('identifier', domains, propertyDefObj)

          const c = db.collection('Patient')
          c.find(query).toArray((err, results) => {
            if (err) {
              return callback(err)
            }

            if (results && results.length > 0) {
              return callback(null, null, data)
            }

            callback(null, fhirCommon.buildHTTPOutcome(404, 'error', 'invalid', 'targetSystem not found'))
          })
        })
      } else {
        callback(null, null, data)
      }
    }
  }

  return {
    name: 'Patient',

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
      search: afterSearchHook,
      read: afterReadHook,
      vread: afterReadHook
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query

      if (ctx.operation === '$ihe-pix') {
        const auditMsg = atnaAudit.buildPIXmAuditMsg(ctx)
        atnaAudit.sendAuditEvent(auditMsg, function (err) {
          if (err) {
            return logger.warn(err)
          }
        })

        return pixmService.buildPIXmQuery(ctx, callback)
      }

      // PDQm ATNA Audit
      const auditMsg = atnaAudit.buildPDQmAuditMsg(ctx)
      atnaAudit.sendAuditEvent(auditMsg, function (err) {
        if (err) {
          return logger.warn(err)
        }
      })

      const customSupportedParams = {
        multipleBirthInteger: {
          path: 'multipleBirthInteger',
          type: 'number'
        } // IHE Query Paramater
      }

      queryValidator.validateQueryParams('Patient', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject, (err, query) => {
          if (err) {
            return callback(err)
          }

          /*
          The IHE query parameters for "mothersMaidenName.family" and "mothersMaidenName.given"
          is handled in the queryparams-extentions config - ./config/queryparam-extensions.json
          */

          if (queryObject['multipleBirthInteger']) {
            query['$and'].push({ multipleBirthInteger: Number(queryObject['multipleBirthInteger'][constants.NO_MODIFER]) })
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
