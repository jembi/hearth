 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')
const constants = require('../../constants')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'CommunicationRequest',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        _id : {},
        _lastUpdated : {},
        _profile : {},
        _security : {},
        _tag : {},
        'based-on': {},
        category : {},
        encounter : {},
        identifier : { allowArray: true },
        status : {},
        patient : {},
        priority : {},
        subject : {},
        recipient : {},
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }

        if (queryObject['_id']) {
          query['$and'].push(queryUtils.tokenToMongoClause('id', queryObject['_id'][constants.NO_MODIFER]))
        }

        if (queryObject['_lastUpdated']) {
          query['$and'].push(queryUtils.dateToMongoClause('meta.lastUpdated', queryObject['_lastUpdated'][constants.NO_MODIFER]))
        }

        if (queryObject['_profile']) {
          query['$and'].push(queryUtils.tokenToMongoClause('meta.profile', queryObject['_profile'][constants.NO_MODIFER]))
        }

        if (queryObject['_security']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('meta.security.coding', queryObject['_security'][constants.NO_MODIFER]))
        }

        if (queryObject['_tag']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('meta.tag.coding', queryObject['_tag'][constants.NO_MODIFER]))
        }

        if (queryObject['based-on']) {
          query['$and'].push({ 'basedOn.reference': queryUtils.paramAsReference(queryObject['based-on'][constants.NO_MODIFER], 'CommunicationRequest') })
        }

        if (queryObject['category']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('categorycoding', queryObject['category'][constants.NO_MODIFER]))
        }

        if (queryObject['encounter']) {
          query['$and'].push({ 'encounter.reference': queryUtils.paramAsReference(queryObject['encounter'][constants.NO_MODIFER], 'Encounter') })
        }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (queryObject['status']) {
          query['$and'].push(queryUtils.tokenToMongoClause('status', queryObject['status'][constants.NO_MODIFER]))
        }

        if (queryObject['patient']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['priority']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('priority', queryObject['priority'][constants.NO_MODIFER]))
        }

        if (queryObject['subject']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['subject'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['recipient']) {
          query['$and'].push({ 'recipient.reference': queryUtils.paramAsReference(queryObject['recipient'][constants.NO_MODIFER], 'Practitioner') })
        }

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}
