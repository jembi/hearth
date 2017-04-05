'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let buildSearchFilters = (queryObject, practitionersToFilter) => {
    let query = { $and: [] }

    if (queryObject['patient']) {
      for (const modifier in queryObject['patient']) {
        query['$and'].push({ 'patient.reference': fhirCommon.util.paramAsReference(queryObject['patient'][modifier], 'Patient') })
      }
    }

    if (queryObject['practitioner']) {
      for (const modifier in queryObject['practitioner']) {
        query['$and'].push({
          participant: {
            $elemMatch: {
              'individual.reference': fhirCommon.util.paramAsReference(queryObject['practitioner'][modifier], 'Practitioner')
            }
          }
        })
      }
    }

    if (queryObject['participant']) {
      for (const modifier in queryObject['participant']) {
        query['$and'].push({
          participant: {
            $elemMatch: {
              'individual.reference': fhirCommon.util.paramAsReference(queryObject['participant'][modifier], 'Practitioner')
            }
          }
        })
      }
    }

    if (queryObject['location']) {
      for (const modifier in queryObject['location']) {
        query['$and'].push({
          location: {
            $elemMatch: {
              'location.reference': fhirCommon.util.paramAsReference(queryObject['location'][modifier], 'Location')
            }
          }
        })
      }
    }

    if (queryObject['status']) {
      for (const modifier in queryObject['status']) {
        query['$and'].push({ status: queryObject['status'][modifier] })
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
          for (const modifier in queryObject['practitioner.organization']) {
            fhirCommon.lookupPractitionersForOrganization(fhirCommon.util.paramAsReference(queryObject['practitioner.organization'][modifier], 'Organization'), (err, practitioners) => {
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
