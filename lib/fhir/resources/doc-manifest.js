 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const Patient = require('./patient')
const Practitioner = require('./practitioner')
const RelatedPerson = require('./related-person')
const constants = require('../../constants')
const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')
const QueryBuilder = require('../query-builder')

module.exports = (mongo) => {
  const patient = Patient(mongo)
  const practitioner = Practitioner(mongo)
  const relatedPerson = RelatedPerson(mongo)
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  const transformHandler = (ctx, resource, callback) => {
    if (resource.created) {
      resource._transforms = {
        created: queryUtils.transformDate(resource.created)
      }
    }
    callback()
  }

  return {
    name: 'DocumentManifest',

    before: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {
        'patient.identifier': {
          path: 'patient.identifier',
          type: 'reference'
        },
        'author.given': {
          path: 'author.given',
          type: 'reference'
        },
        'author.family': {
          path: 'author.family',
          type: 'reference'
        }
      }

      queryValidator.validateQueryParams('DocumentManifest', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        const query = queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject)

        let promises = []

        // MHD search parameter
        if (queryObject['patient.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            const chainedModules = [
              { param: 'identifier', module: patient }
            ]
            queryUtils.genChainedParamQuery(queryObject['patient.identifier'][constants.NO_MODIFER], 'subject.reference', chainedModules, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        // MHD search parameter
        if (queryObject['author.given']) {
          promises.push(new Promise((resolve, reject) => {
            const chainedModules = [
              { param: 'given', module: patient },
              { param: 'given', module: practitioner },
              { param: 'name', module: relatedPerson }
            ]
            queryUtils.genChainedParamQuery(queryObject['author.given'][constants.NO_MODIFER], 'author.reference', chainedModules, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        // MHD search parameter
        if (queryObject['author.family']) {
          promises.push(new Promise((resolve, reject) => {
            const chainedModules = [
              { param: 'family', module: patient },
              { param: 'family', module: practitioner },
              { param: 'name', module: relatedPerson }
            ]
            queryUtils.genChainedParamQuery(queryObject['author.family'][constants.NO_MODIFER], 'author.reference', chainedModules, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        Promise.all(promises).then(() => {
          if (query['$and'].length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
