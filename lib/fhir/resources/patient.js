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

  let readPostInteractionHandler = (ctx, data, callback) => {
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

  let searchPostInteractionHandler = (ctx, data, callback) => {
    if (ctx.operation === '$ihe-pix') {
      pixmService.searchPostInteractionHandler(ctx, data, callback)
    } else {
      // If an identifier system does not exist in mongo return a 404
      if (data.length === 0 && ctx.query['identifier']) {
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

    preInteractionHandlers: {
      create: (ctx, resource, callback) => {
        fhirCommon.referenceAttachment(resource, (err) => {
          if (err) {
            return callback(err)
          }
          callback()
        })
      }
    },

    postInteractionHandlers: {
      search: searchPostInteractionHandler,
      read: readPostInteractionHandler,
      vread: readPostInteractionHandler
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
        identifier: { allowArray: true },
        given: { allowArray: true, modifiers: { exact: true } },
        family: { allowArray: true, modifiers: { exact: true } },
        gender: {},
        birthDate: { allowArray: true },
        address: { allowArray: true, modifiers: { exact: true } },
        'mothersMaidenName.given': { allowArray: true, modifiers: { exact: true } },
        'mothersMaidenName.family': { allowArray: true, modifiers: { exact: true } },
        telecom: { allowArray: true },
        multipleBirthInteger: {}
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
