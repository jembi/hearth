 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const _ = require('lodash')

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

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

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  // check if the identifier passed in matches the sourceIdentifier query parameter
  const matchIdentifierToSourceIdentifier = (identifier, sourceIdentifier) => {
    let matched = false
    const split = sourceIdentifier.split('|')

    if (split[1]) {
      if (split[0] === identifier.system && split[1] === identifier.value) {
        matched = true
      }
    }
    return matched
  }

  // check if the identifier passed in matches the targetSystem query parameter
  const matchIdentifierToTargetSystems = (identifier, targetSystems) => {
    let matched = false

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
  const matchUrlToSourceIdentifier = (url, sourceIdentifier) => {
    let matched = false
    const split = sourceIdentifier.split('|')

    if (split[1]) {
      if (url.includes(split[0]) && url.includes(split[1])) {
        matched = true
      }
    }
    return matched
  }

  // check if the url passed in matches the targetSystem query parameter
  const matchUrlToTargetSystems = (url, targetSystems) => {
    let matched = false

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

  const buildResponseWhenNoDataReturned = (ctx, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      let assigningAuthority = ctx.query['sourceIdentifier'].split('|')[0]
      let query = {
        $or: [
          { identifier: { $elemMatch: { system: assigningAuthority } } },
          { link: { $elemMatch: { other: { $regex: `^${assigningAuthority}` } } } }
        ]
      }

      const c = db.collection('Patient')

      c.find(query).toArray((err, results) => {
        if (err) {
          return callback(err)
        }
        if (results && results.length > 0) {
          ctx.responseStatus = 404
          callback(null, null, parametersResource)
        } else {
          if (assigningAuthority === ctx.domain) {
            ctx.responseStatus = 404
            return callback(null, null, parametersResource)
          }

          callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'sourceIdentifier Assigning Authority not found'))
        }
      })
    })
  }

  return {
    buildPIXmQuery: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        sourceIdentifier: { allowArray: true, required: true },
        targetSystem: { allowArray: true, modifiers: { exact: true } }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        badRequest = badRequest || queryUtils.validateFullSourceIdentifierToken(queryObject['sourceIdentifier'][constants.NO_MODIFER])

        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        const query = { $or: [] }
        const projection = { _id: 0, id: 1, identifier: 1, link: 1 }
        const identifier = queryObject['sourceIdentifier'][constants.NO_MODIFER]

        query['$or'].push(queryUtils.tokenToSystemValueElemMatch('identifier', identifier))
        query['$or'].push(queryUtils.tokenToLinkElemMatch(identifier))

        const split = identifier.split('|')
        if (split[0] === ctx.domain) {
          query['$or'].push({ id: split[1] })
        }

        callback(null, null, query, projection)
      })
    },

    afterSearchHook: (ctx, data, callback) => {
      if (data.length > 1) {
        return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'query not specific enough, more than one patient found'))
      }

      if (data.length === 0) {
        buildResponseWhenNoDataReturned(ctx, callback)
      }

      if (data.length === 1) {
        const parameters = []
        const sourceIdentifier = ctx.query.sourceIdentifier
        const targetSystems = ctx.query.targetSystem
        const vi = targetIdentifierParameter.valueIdentifier
        let queriedUrlFiltered = false

        // Remove the identifier that was used in the query as per IHE PIXm specification
        if (data[0].resource.identifier && data[0].resource.identifier.length > 0) {
          data[0].resource.identifier.forEach((identifier) => {
            if (!matchIdentifierToSourceIdentifier(identifier, sourceIdentifier) && matchIdentifierToTargetSystems(identifier, targetSystems)) {
              Object.keys(vi).forEach((key) => {
                vi[key] = identifier[key]
              })
              parameters.push(_.cloneDeep(targetIdentifierParameter))
            }
          })
        }

        // Add other domains' patient urls to the response
        if (data[0].resource.link && data[0].resource.link.length > 0) {
          data[0].resource.link.forEach((link) => {
            if (link.other) {
              queriedUrlFiltered = matchUrlToSourceIdentifier(link.other.reference, sourceIdentifier)
              if (!queriedUrlFiltered && matchUrlToTargetSystems(link.other.reference, targetSystems)) {
                targetIdParameter.valueReference = link.other.reference
                parameters.push(_.cloneDeep(targetIdParameter))
              }
            }
          })
        }

        // Add this server's patient url to the response
        const patientUrl = ctx.fullUrl.split('$')[0] + data[0].resource.id
        queriedUrlFiltered = matchUrlToSourceIdentifier(patientUrl, sourceIdentifier)
        if (!queriedUrlFiltered && matchUrlToTargetSystems(patientUrl, targetSystems)) {
          targetIdParameter.valueReference = patientUrl
          parameters.push(_.cloneDeep(targetIdParameter))
        }

        if (parameters.length === 0 && !queriedUrlFiltered) {
          return callback(null, fhirCommon.buildHTTPOutcome(403, 'error', 'invalid', 'targetSystem not found'))
        }

        ctx.responseStatus = 200
        const returnObj = {}
        Object.assign(returnObj, parametersResource)
        returnObj.parameter = parameters
        callback(null, null, returnObj)
      }
    }
  }
}
