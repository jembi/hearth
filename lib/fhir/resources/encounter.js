'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let buildSearchFilters = (queryObject, practitionersToFilter) => {
    let query = { $and: [] }

    if (queryObject['patient']) {
      for (const k in queryObject['patient']) {
        query['$and'].push({ 'patient.reference': fhirCommon.util.paramAsReference(queryObject['patient'][k], 'Patient') })
      }
    }

    if (queryObject['practitioner']) {
      for (const k in queryObject['practitioner']) {
        query['$and'].push({
          participant: {
            $elemMatch: {
              'individual.reference': fhirCommon.util.paramAsReference(queryObject['practitioner'][k], 'Practitioner')
            }
          }
        })
      }
    }

    if (queryObject['participant']) {
      for (const k in queryObject['participant']) {
        query['$and'].push({
          participant: {
            $elemMatch: {
              'individual.reference': fhirCommon.util.paramAsReference(queryObject['participant'][k], 'Practitioner')
            }
          }
        })
      }
    }

    if (queryObject['location']) {
      for (const k in queryObject['location']) {
        query['$and'].push({
          location: {
            $elemMatch: {
              'location.reference': fhirCommon.util.paramAsReference(queryObject['location'][k], 'Location')
            }
          }
        })
      }
    }

    if (queryObject['status']) {
      for (const k in queryObject['status']) {
        query['$and'].push({ status: queryObject['status'][k] })
      }
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

      fhirCommon.util.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
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
          for (const k in queryObject['practitioner.organization']) {
            fhirCommon.lookupPractitionersForOrganization(fhirCommon.util.paramAsReference(queryObject['practitioner.organization'][k], 'Organization'), (err, practitioners) => {
              if (err) {
                return callback(err)
              }
              build(practitioners)
            })
          }
        } else {
          build()
        }
      })
    }
  }
}
