'use strict'
const logger = require('winston')
const FhirCommon = require('../common')
const PixmService = require('../services/pixm')

const atnaAudit = require('../../atna-audit')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const pixmService = PixmService(mongo)

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
      callback(null, null, data)
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

      const supportedParams = {
        identifier: { allowArray: true, required: false, operators: { exact: true } },
        given: { allowArray: true, operators: { exact: false } },
        family: { allowArray: true, operators: { } },
        gender: { operators: { } }
      }

      fhirCommon.util.validateQueryParamsReturnQueryObject(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
        }

        let query = { $and: [] }

        if (queryObject['identifier']) {
          query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryObject['identifier'].value))
        }

        if (queryObject['given']) {
          query['$and'].push(fhirCommon.util.nameToMongoClause('given', queryObject['given'].value))
        }

        if (queryObject['family']) {
          query['$and'].push(fhirCommon.util.nameToMongoClause('family', queryObject['family'].value))
        }

        if (queryParams['gender']) {
          query['$and'].push({ gender: queryParams['gender'] })
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
