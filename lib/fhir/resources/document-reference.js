'use strict'
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  const transformHandler = (req, res, onSuccess) => {
    if (req.body.indexed) {
      req.body._transforms = {
        indexed: fhirCommon.util.transformDate(req.body.indexed)
      }
    }
    onSuccess()
  }

  return {
    name: 'DocumentReference',

    preInteractionHandlers: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (queryParams, callback) => {
      let supportedParams = [
        'patient', 'indexed', 'status', 'class', 'type', 'setting', 'facility',
        'event', 'securityLabel', 'format', 'related-id'
      ]

      let badRequest = fhirCommon.util.validateSearchParams(queryParams, supportedParams)
      if (badRequest) {
        return callback(null, badRequest)
      }

      let query = { $and: [] }

      if (queryParams['patient']) {
        query['$and'].push({
          'latest.subject.reference': fhirCommon.util.paramAsReference(queryParams['patient'], 'Patient')
        })
      }

      if (queryParams['indexed']) {
        query['$and'].push(fhirCommon.util.paramAsDateRangeClause('_transforms.indexed', queryParams['indexed']))
      }

      if (queryParams['status']) {
        query['$and'].push({
          'latest.status': queryParams['status']
        })
      }

      if (queryParams['class']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('class.coding', queryParams['class']))
      }

      if (queryParams['type']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('type.coding', queryParams['type']))
      }

      if (queryParams['setting']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.practiceSetting.coding', queryParams['setting']))
      }

      if (queryParams['facility']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.facilityType.coding', queryParams['facility']))
      }

      if (queryParams['event']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('context.event.coding', queryParams['event']))
      }

      if (queryParams['securityLabel']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('securityLabel.coding', queryParams['securityLabel']))
      }

      if (queryParams['format']) {
        query['$and'].push(fhirCommon.util.tokenToSystemCodeElemMatch('content.format', queryParams['format']))
      }

      if (queryParams['related-id']) {
        query['$and'].push(fhirCommon.util.tokenToSystemValueElemMatch('context.related.identifier', queryParams['related-id']))
      }

      if (query['$and'].length > 0) {
        query = mongo.util.collapseWhenSingleClause(query)
        callback(null, null, query)
      } else {
        callback()
      }
    }
  }
}
