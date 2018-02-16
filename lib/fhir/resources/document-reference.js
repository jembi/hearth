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
const constants = require('../../constants')
const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')
const QueryBuilder = require('../query-builder')

module.exports = (mongo) => {
  const patient = Patient(mongo)
  const practitioner = Practitioner(mongo)
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  const transformHandler = (ctx, resource, callback) => {
    resource._transforms = {}
    if (resource.indexed) {
      resource._transforms.indexed = queryUtils.transformDate(resource.indexed)
    }
    if (resource.context && resource.context.period) {
      resource._transforms.context = { period: {} }
      if (resource.context.period.start) {
        resource._transforms.context.period.start = queryUtils.transformDate(resource.context.period.start)
      }
      if (resource.context.period.end) {
        resource._transforms.context.period.end = queryUtils.transformDate(resource.context.period.end)
      }
    }
    callback()
  }

  return {
    name: 'DocumentReference',

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
        },
        indexed: {},
        period: {},
        _include: {},
        _revinclude: {}
      }

      queryValidator.validateQueryParams('DocumentReference', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        const query = queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject)

        let promises = []

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

        if (queryObject['author.given']) {
          promises.push(new Promise((resolve, reject) => {
            const chainedModules = [
              { param: 'given', module: practitioner }
            ]
            queryUtils.genChainedParamQuery(queryObject['author.given'][constants.NO_MODIFER], 'author.reference', chainedModules, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['author.family']) {
          promises.push(new Promise((resolve, reject) => {
            const chainedModules = [
              { param: 'family', module: practitioner }
            ]
            queryUtils.genChainedParamQuery(queryObject['author.family'][constants.NO_MODIFER], 'author.reference', chainedModules, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['indexed']) {
          query['$and'].push(queryUtils.paramAsDateRangeClause('_transforms.indexed', queryObject['indexed'][constants.NO_MODIFER]))
        }

        if (queryObject['period']) {
          query['$and'].push(queryUtils.paramAsDateRangeClause({
            start: '_transforms.context.period.start',
            end: '_transforms.context.period.end'
          },
              queryObject['period'][constants.NO_MODIFER]
            ))
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
