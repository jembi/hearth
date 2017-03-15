'use strict'
const logger = require('winston')
const FhirCommon = require('../common')
const _ = require('lodash')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

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
      if (data.length > 1) {
        return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'query not specific enough, more than one patient found'))
      }
      
      let filteredInPostInteractionHandler = false
      ctx.responseStatus = 200
      
      const targetIdentifierParameter = {
        name: 'targetIdentifier',
        valueIdentifier: {
          use: '',
          system: '',
          value: ''
        }
      }

      const targetIdParameter = {
        name: 'targetId',
        valueReference: ''
      }

      const parametersResource = {
        resourceType: 'Parameters',
        parameter: []
      }

      if (data.length === 0) {
        ctx.responseStatus = 404
        return callback(null, null, parametersResource)
      }

      const matchIdentifierToToken = (identifier) => {
        let matched = false
        let sourceId = ctx.query.sourceIdentifier
        const split = sourceId.split('|')

        if (split[1]) {
          if (split[0] === identifier.system && split[1] === identifier.value) {
            matched = true
          }
        }
        return matched
      }

      const matchIdentifierToStringArray = (identifier) => {
        let matched = false
        let targetSystems = ctx.query.targetSystem

        if (!targetSystems) { return true }

        if (typeof (targetSystems) === 'string') {
          targetSystems = [targetSystems]
        }

        const split = identifier.system.split('|')
        targetSystems.forEach((targetSys) => {
          if (split[0] === targetSys) {
            matched = true
          }
        })
        return matched
      }

      // check if the url passed in matches the sourceIdentifier query parameter
      const matchUrlToToken = (url) => {
        let matched = false
        let sourceId = ctx.query.sourceIdentifier
        const split = sourceId.split('|')

        if (split[1]) {
          if (url.includes(split[0]) && url.includes(split[1])) {
            filteredInPostInteractionHandler = true
            matched = true
          }
        }
        return matched
      }

      const matchUrlToStringArray = (url) => {
        let matched = false
        let targetSystems = ctx.query.targetSystem

        if (!targetSystems) { return true }

        if (typeof (targetSystems) === 'string') {
          targetSystems = [targetSystems]
        }

        let urlSplit = url.split('/')
        if (urlSplit.length >= 3) {
          let urlDomain = urlSplit.slice(0, 3).join('/')

          targetSystems.forEach((targetSys) => {
            if (urlDomain === targetSys) {
              matched = true
            }
          })
        }
        return matched
      }

      const parameters = []
      const vi = targetIdentifierParameter.valueIdentifier

      // Remove the identifier that was used in the query as per IHE PIXm specification
      if (data[0].identifier && data[0].identifier.length > 0) {
        data[0].identifier.forEach((identifier) => {
          if (!matchIdentifierToToken(identifier) && matchIdentifierToStringArray(identifier)) {
            Object.keys(vi).forEach((key) => {
              vi[key] = identifier[key]
            })
            parameters.push(_.cloneDeep(targetIdentifierParameter))
          }
        })
      }

      // Add other domains' patient urls to the response
      if (data[0].link && data[0].link.length > 0) {
        data[0].link.forEach((link) => {
          if (!matchUrlToToken(link.other) && matchUrlToStringArray(link.other)) {
            targetIdParameter.valueReference = link.other
            parameters.push(_.cloneDeep(targetIdParameter))
          }
        })
      }

      // Add this server's patient url to the response
      const patientUrl = ctx.fullUrl.split('$')[0] + data[0].id
      if (!matchUrlToToken(patientUrl) && matchUrlToStringArray(patientUrl)) {
        targetIdParameter.valueReference = patientUrl
        parameters.push(_.cloneDeep(targetIdParameter))
      }

      if (parameters.length === 0 && !filteredInPostInteractionHandler) {
        return callback(null, fhirCommon.buildHTTPOutcome(403, 'error', 'invalid', 'targetSystem not found'))
      }

      parametersResource.parameter = parameters

      callback(null, null, parametersResource)
    } else {
      callback(null, null, data)
    }
  }

  let buildPIXmQuery = (ctx, callback) => {
    const queryParams = ctx.query
    let supportedParams = ['sourceIdentifier', 'targetSystem']

    let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams, 'sourceIdentifier') ||
      fhirCommon.util.validateFullSourceIdentifierToken(queryParams['sourceIdentifier'])

    if (badRequest) {
      return callback(null, badRequest)
    }

    let query = { $or: [] }
    let projection = { _id: 0, id: 1, identifier: 1, link: 1 }

    if (queryParams['sourceIdentifier']) {
      let identifier = queryParams['sourceIdentifier']
      query['$or'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', identifier))
      query['$or'].push(fhirCommon.util.tokenToLinkElemMatch(identifier))

      if (identifier.split('|')[0] === ctx.domain) {
        query['$or'].push({ id: identifier.split('|')[1] })
      }
    }

    callback(null, null, query, projection)
  }

  let buildPDQmQuery = (queryParams, callback) => {
    let supportedParams = ['identifier', 'given', 'family']

    let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
    if (badRequest) {
      return callback(null, badRequest)
    }

    let query = { $and: [] }

    if (queryParams['identifier']) {
      query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('identifier', queryParams['identifier']))
    }

    if (queryParams['given']) {
      query['$and'].push(fhirCommon.util.nameToMongoClause('given', queryParams['given']))
    }

    if (queryParams['family']) {
      query['$and'].push(fhirCommon.util.nameToMongoClause('family', queryParams['family']))
    }

    if (query['$and'].length > 0) {
      query = mongo.util.collapseWhenSingleClause(query)
      callback(null, null, query)
    } else {
      callback()
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
        return buildPIXmQuery(ctx, callback)
      }

      buildPDQmQuery(queryParams, callback)
    }
  }
}
