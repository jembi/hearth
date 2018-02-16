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

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)
  const queryValidator = QueryValidator()
  const queryBuilder = QueryBuilder(mongo)

  return {
    name: 'Encounter',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const customSupportedParams = {
        'practitioner.organization': {
          path: 'practitioner.organization',
          type: 'reference'
        },
        _include: {},
        _revinclude: {}
      }

      queryValidator.validateQueryParams('Encounter', queryParams, customSupportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest.message))
        }

        let build = (practitionersToFilter) => {
          const filteredQueryObject = queryUtils.filterOutProperties(queryObject, Object.keys(customSupportedParams))
          const query = queryBuilder.buildQuery(ctx.resourceType, filteredQueryObject) 

          if (practitionersToFilter) {
            query['$and'].push({
              participant: {
                $elemMatch: {
                  'individual.reference': {
                    $in: practitionersToFilter
                  }
                }
              }
            })
          }

          if (query['$and'].length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        }

        if (queryObject['practitioner.organization']) {
          fhirCommon.lookupPractitionersForOrganization(queryUtils.paramAsReference(queryObject['practitioner.organization'][constants.NO_MODIFER], 'Organization'), (err, practitioners) => {
            if (err) {
              return callback(err)
            }
            build(practitioners)
          })
        } else {
          build()
        }
      })
    }
  }
}
