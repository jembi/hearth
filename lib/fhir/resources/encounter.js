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

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  let buildSearchFilters = (queryObject, practitionersToFilter) => {
    let query = { $and: [] }

    if (queryObject['patient']) {
      query['$and'].push({ 'patient.reference': queryUtils.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
    }

    if (queryObject['practitioner']) {
      query['$and'].push({
        participant: {
          $elemMatch: {
            'individual.reference': queryUtils.paramAsReference(queryObject['practitioner'][constants.NO_MODIFER], 'Practitioner')
          }
        }
      })
    }

    if (queryObject['participant']) {
      query['$and'].push({
        participant: {
          $elemMatch: {
            'individual.reference': queryUtils.paramAsReference(queryObject['participant'][constants.NO_MODIFER], 'Practitioner')
          }
        }
      })
    }

    if (queryObject['location']) {
      query['$and'].push({
        location: {
          $elemMatch: {
            'location.reference': queryUtils.paramAsReference(queryObject['location'][constants.NO_MODIFER], 'Location')
          }
        }
      })
    }

    if (queryObject['status']) {
      query['$and'].push({ status: queryObject['status'][constants.NO_MODIFER] })
    }

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

    return query
  }

  return {
    name: 'Encounter',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        patient: {},
        practitioner: {},
        'practitioner.organization': {},
        participant: {},
        location: {},
        status: {},
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let build = (practitionersToFilter) => {
          let query = buildSearchFilters(queryObject, practitionersToFilter)

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
