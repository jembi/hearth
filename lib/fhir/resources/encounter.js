 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')
const QueryValidator = require('../query-validator')
const QueryBuilder = require('../query-builder')
const Practitioner = require('./practitioner')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)
  const practitioner = Practitioner(mongo)

  return {
    name: 'Encounter',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {
        'practitioner.organization': {
          path: 'practitioner.organization',
          type: 'reference'
        }
      }

      queryValidator.validateQueryParams('Encounter', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
        const query = queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject)

        const promises = []
        if (queryObject['practitioner.organization']) {
          promises.push(new Promise((resolve, reject) => {
            const chainedModules = [
              { param: 'organization', module: practitioner }
            ]
            queryUtils.genChainedParamQuery(queryObject['practitioner.organization'][constants.NO_MODIFER], 'participant.individual.reference', chainedModules, (err, clause) => {
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
