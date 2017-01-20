'use strict'
const logger = require('winston')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let buildSearchFilters = (queryParams, practitionersToFilter) => {
    let query = { $and: [] }

    if (queryParams['patient']) {
      query['$and'].push({
        'latest.patient.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
      })
    }

    if (queryParams['practitioner']) {
      query['$and'].push({
        'latest.participant': {
          $elemMatch: {
            'individual.reference': fhirCommon.util.paramAsReference(queryParams['practitioner'], 'Practitioner')
          }
        }
      })
    }

    if (queryParams['participant']) {
      query['$and'].push({
        'latest.participant': {
          $elemMatch: {
            'individual.reference': fhirCommon.util.paramAsReference(queryParams['participant'], 'Practitioner')
          }
        }
      })
    }

    if (queryParams['location']) {
      query['$and'].push({
        'latest.location': {
          $elemMatch: {
            'location.reference': fhirCommon.util.paramAsReference(queryParams['location'], 'Location')
          }
        }
      })
    }

    if (queryParams['status']) {
      query['$and'].push({
        'latest.status': queryParams['status']
      })
    }

    if (practitionersToFilter) {
      query['$and'].push({
        'latest.participant': {
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

    preInteractionHandlers: {
      create: (req, res, onSuccess) => {
        fhirCommon.validateReferencesForEncounter(req.body, (err, invalidErr) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }
          if (invalidErr) {
            return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', invalidErr))
          }

          onSuccess()
        })
      }
    },

    searchFilters: (queryParams, callback) => {
      let supportedParams = ['patient', 'practitioner', 'practitioner.organization', 'participant', 'location', 'status']

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let build = (practitionersToFilter) => {
        let query = buildSearchFilters(queryParams, practitionersToFilter)

        if (query['$and'].length > 0) {
          query = mongo.util.collapseWhenSingleClause(query)
          callback(null, null, query)
        } else {
          callback()
        }
      }

      if (queryParams['practitioner.organization']) {
        fhirCommon.lookupPractitionersForOrganization(fhirCommon.util.paramAsReference(queryParams['practitioner.organization'], 'Organization'), (err, practitioners) => {
          if (err) {
            return callback(err)
          }
          build(practitioners)
        })
      } else {
        build()
      }
    }
  }
}
