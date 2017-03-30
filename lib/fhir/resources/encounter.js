'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let buildSearchFilters = (queryObject, practitionersToFilter) => {
    let query = { $and: [] }

    if (queryObject['patient']) {
      query['$and'].push({
        'patient.reference': fhirCommon.util.paramAsReference(queryObject['patient'].value, 'Patient')
      })
    }

    if (queryObject['practitioner']) {
      query['$and'].push({
        participant: {
          $elemMatch: {
            'individual.reference': fhirCommon.util.paramAsReference(queryObject['practitioner'].value, 'Practitioner')
          }
        }
      })
    }

    if (queryObject['participant']) {
      query['$and'].push({
        participant: {
          $elemMatch: {
            'individual.reference': fhirCommon.util.paramAsReference(queryObject['participant'].value, 'Practitioner')
          }
        }
      })
    }

    if (queryObject['location']) {
      query['$and'].push({
        location: {
          $elemMatch: {
            'location.reference': fhirCommon.util.paramAsReference(queryObject['location'].value, 'Location')
          }
        }
      })
    }

    if (queryObject['status']) {
      query['$and'].push({
        status: queryObject['status'].value
      })
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

      fhirCommon.util.validateAndModifyQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, badRequest)
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
          fhirCommon.lookupPractitionersForOrganization(fhirCommon.util.paramAsReference(queryObject['practitioner.organization'].value, 'Organization'), (err, practitioners) => {
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
