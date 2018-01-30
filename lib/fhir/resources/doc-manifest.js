 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const Patient = require('./patient')
const Practitioner = require('./practitioner')
const constants = require('../../constants')
const FhirCommon = require('../common')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const patient = Patient(mongo)
  const practitioner = Practitioner(mongo)
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  const transformHandler = (ctx, resource, callback) => {
    if (resource.created) {
      resource._transforms = {
        created: queryUtils.transformDate(resource.created)
      }
    }
    callback()
  }

  return {
    name: 'DocumentManifest',

    before: {
      create: transformHandler,
      update: transformHandler
    },

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        author: {},
        'content-ref': {},
        created: {},
        description: {},
        identifier: { allowArray: true },
        patient: {},
        recipient: {},
        'related-id': {},
        'related-ref': {},
        source: {},
        status: {},
        subject: {},
        type: {},
        'patient.identifier': { allowArray: true },
        'author.given': { allowArray: true, modifiers: { exact: true } },
        'author.family': { allowArray: true, modifiers: { exact: true } },
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }
        let promises = []

        if (queryObject['author']) {
          query['$and'].push({
            'author': {
              $elemMatch: {
                'reference': queryUtils.paramAsReference(queryObject['author'][constants.NO_MODIFER], 'Device')
              }
            }
          })
        }

        if (queryObject['content-ref']) {
          query['$and'].push({
            'content': {
              $elemMatch: {
                'pReference.reference': queryUtils.paramAsReference(queryObject['content-ref'][constants.NO_MODIFER], 'DocumentReference')
              }
            }
          })
        }

        if (queryObject['created']) {
          query['$and'].push(queryUtils.paramAsDateRangeClause('_transforms.created', queryObject['created'][constants.NO_MODIFER]))
        }

        if (queryObject['description']) {
          query['$and'].push({ description: queryObject['description'][constants.NO_MODIFER] })
        }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (queryObject['patient']) {
          // TODO handle full url references
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['patient'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['recipient']) {
          query['$and'].push({
            'recipient': {
              $elemMatch: {
                'reference': queryUtils.paramAsReference(queryObject['recipient'][constants.NO_MODIFER], 'Patient')
              }
            }
          })
        }

        if (queryObject['related-id']) {
          query['$and'].push({
            'related': {
              $elemMatch: queryUtils.tokenToSystemValue('identifier', queryObject['related-id'][constants.NO_MODIFER])
            }
          })
        }

        if (queryObject['related-ref']) {
          query['$and'].push({
            'related': {
              $elemMatch: {
                'ref.reference': queryUtils.paramAsReference(queryObject['related-ref'][constants.NO_MODIFER], 'DocumentReference')
              }
            }
          })
        }

        if (queryObject['source']) {
          query['$and'].push({ source: queryObject['source'][constants.NO_MODIFER] })
        }

        if (queryObject['status']) {
          query['$and'].push({ status: queryObject['status'][constants.NO_MODIFER] })
        }

        if (queryObject['subject']) {
          query['$and'].push({ 'subject.reference': queryUtils.paramAsReference(queryObject['subject'][constants.NO_MODIFER], 'Patient') })
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        // MHD search parameter
        if (queryObject['patient.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['patient.identifier'][constants.NO_MODIFER], 'subject.reference', 'identifier', patient, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        // MHD search parameter
        if (queryObject['author.given']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['author.given'][constants.NO_MODIFER], 'author.reference', 'given', practitioner, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        // MHD search parameter
        if (queryObject['author.family']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['author.family'][constants.NO_MODIFER], 'author.reference', 'family', practitioner, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        Promise.all(promises).then(() => {
          if (query['$and'].length > 0) {
            callback(null, null, query)
          } else {
            callback()
          }
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
