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
const PixmService = require('../services/pixm')
const atnaAudit = require('../../atna-audit')
const Extensions = require('../extensions')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const pixmService = PixmService(mongo)
  const queryUtils = QueryUtils(mongo)

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

          let query = queryUtils.tokenToSystemValueElemMatch('identifier', domains)

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

      const supportedParams = {
        _id: { modifiers: { exact: true } },
        active: {},
        address: { allowArray: true, modifiers: { exact: true } },
        'address-city': { modifiers: { exact: true, contains: true } },
        'address-country': { modifiers: { exact: true, contains: true } },
        'address-postalcode': { modifiers: { exact: true, contains: true } },
        'address-state': { modifiers: { exact: true, contains: true } },
        birthdate: { allowArray: true },
        family: { allowArray: true, modifiers: { exact: true } },
        gender: {},
        given: { allowArray: true, modifiers: { exact: true } },
        identifier: { allowArray: true },
        telecom: { allowArray: true },
        'mothersMaidenName.family': { allowArray: true, modifiers: { exact: true } }, // IHE Query Paramater
        'mothersMaidenName.given': { allowArray: true, modifiers: { exact: true } }, // IHE Query Paramater
        multipleBirthInteger: {}, // IHE Query Paramater
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['_id']) {
          for (const modifier in queryObject['_id']) {
            query['$and'].push({ 'id': queryObject['_id'][modifier] })
          }
        }

        if (queryObject['active']) {
          query['$and'].push(queryUtils.boolToMongoClause('active', queryObject['active'][constants.NO_MODIFER]))
        }

        if (queryObject['address']) {
          for (const modifier in queryObject['address']) {
            query['$and'].push(queryUtils.addressToMongoClause('address', queryObject['address'][modifier], modifier))
          }
        }

        if (queryObject['address-city']) {
          for (const modifier in queryObject['address-city']) {
            query['$and'].push(queryUtils.stringToMongoClause('address.city', queryObject['address-city'][modifier], modifier))
          }
        }
        if (queryObject['address-country']) {
          for (const modifier in queryObject['address-country']) {
            query['$and'].push(queryUtils.stringToMongoClause('address.country', queryObject['address-country'][modifier], modifier))
          }
        }
        if (queryObject['address-postalcode']) {
          for (const modifier in queryObject['address-postalcode']) {
            query['$and'].push(queryUtils.stringToMongoClause('address.postalCode', queryObject['address-postalcode'][modifier], modifier))
          }
        }
        if (queryObject['address-state']) {
          for (const modifier in queryObject['address-state']) {
            query['$and'].push(queryUtils.stringToMongoClause('address.state', queryObject['address-state'][modifier], modifier))
          }
        }

        // TODO: query parameter: address-use
        // TODO: query parameter: animal-breed
        // TODO: query parameter: animal-species

        if (queryObject['birthdate']) {
          query['$and'].push(queryUtils.dateToMongoClause('birthDate', queryObject['birthdate'][constants.NO_MODIFER]))
        }

        // TODO: query parameter: careprovider
        // TODO: query parameter: deathdate
        // TODO: query parameter: deceased
        // TODO: query parameter: email

        if (queryObject['family']) {
          for (const modifier in queryObject['family']) {
            query['$and'].push(queryUtils.nameToMongoClause('family', queryObject['family'][modifier], modifier))
          }
        }

        if (queryObject['gender']) {
          query['$and'].push({ gender: queryObject['gender'][constants.NO_MODIFER] })
        }

        if (queryObject['given']) {
          for (const modifier in queryObject['given']) {
            query['$and'].push(queryUtils.nameToMongoClause('given', queryObject['given'][modifier], modifier))
          }
        }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        // TODO: query parameter: language
        // TODO: query parameter: link
        // TODO: query parameter: name
        // TODO: query parameter: organization
        // TODO: query parameter: phone
        // TODO: query parameter: phonetic

        if (queryObject['telecom']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('telecom', queryObject['telecom'][constants.NO_MODIFER]))
        }

        /*
          The IHE query parameters for "mothersMaidenName.family" and "mothersMaidenName.given"
          is handled in the queryparams-extentions config - ./config/queryparam-extensions.json
        */

        if (queryObject['multipleBirthInteger']) {
          query['$and'].push({ multipleBirthInteger: Number(queryObject['multipleBirthInteger'][constants.NO_MODIFER]) })
        }

        const exts = Extensions(mongo, queryObject, 'Patient')
        query['$and'] = query['$and'].concat(exts.generateSearchFiltersForExtensions())

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}
