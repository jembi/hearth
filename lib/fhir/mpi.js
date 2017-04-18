'use strict'

const FhirCommon = require('./common')
const Authorization = require('../security/authorization')
const matchingConfig = require('../../config/matching')

const handleErrorAndBadRequest = (err, badRequest, callback) => {
  if (err) {
    return callback(err)
  }
  if (badRequest) {
    return callback(null, badRequest)
  }
}

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const authorization = Authorization(mongo)

  return {
    match: (ctx, resourceType, body, callback) => {
      authorization.authorize('match', ctx, resourceType, (err, badRequest, postInteractionHandler) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        if (body.resourceType !== 'Parameters') {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Expected Parameters resource type'))
        }

        let resource

        body.parameter.forEach((parameter) => {
          switch (parameter.name) {
            case 'resource':
              resource = parameter.resource
              break
          }
        })

        if (!resource.resourceType || resource.resourceType !== resourceType) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
        }

        if (Object.keys(matchingConfig).indexOf(resourceType) === -1) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Match operation not supported on resource type'))
        }

        callback(null, { httpStatus: 201 })
      })
    }
  }
}
