/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
        status: {}
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
