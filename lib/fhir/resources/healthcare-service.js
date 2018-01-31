 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const Organization = require('./organization');
const Location = require('./location');
const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const organization = Organization(mongo)
  const location = Location(mongo)
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'HealthcareService',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        _id: {},
        _lastUpdated: {},
        active: {},
        identifier: { allowArray: true },
        location: {},
        name: { allowArray: true, modifiers: { exact: true, contains: true } },
        organization: {},
        type: {},
        'organization.active': {},
        'organization.identifier': { allowArray: true },
        'organization.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        'location.status': {},
        'location.identifier': { allowArray: true },
        'location.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        _format: {},
        _include: { allowArray: true },
        _revinclude: { allowArray: true }
      }

      queryUtils.validateAndParseQueryParams(queryParams, supportedParams, (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        let query = { $and: [] }
        let promises = []

        if (queryObject['_id']) {
          query['$and'].push(queryUtils.tokenToMongoClause('id', queryObject['_id'][constants.NO_MODIFER]))
        }

        if (queryObject['_lastUpdated']) {
          query['$and'].push(queryUtils.dateToMongoClause('meta.lastUpdated', queryObject['_lastUpdated'][constants.NO_MODIFER]))
        }

        if (queryObject['active']) {
          query['$and'].push(queryUtils.boolToMongoClause('active', queryObject['active'][constants.NO_MODIFER]))
        }

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (queryObject['location']) {
          query['$and'].push({ 'location.reference': queryUtils.paramAsReference(queryObject['location'][constants.NO_MODIFER], 'Location') })
        }

        if (queryObject['name']) {
          for (const modifier in queryObject['name']) {
            query['$and'].push(queryUtils.stringToMongoClause('name', queryObject['name'][modifier], modifier))
          }
        }

        if (queryObject['organization']) {
          query['$and'].push({ 'providedBy.reference': queryUtils.paramAsReference(queryObject['organization'][constants.NO_MODIFER], 'Organization') })
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        if (queryObject['organization.active']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['organization.active'][constants.NO_MODIFER], 'organization.reference', 'active', organization, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['organization.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['organization.identifier'][constants.NO_MODIFER], 'organization.reference', 'identifier', organization, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['organization.name']) {
          for (const modifier in queryObject['organization.name'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['organization.name'][modifier], 'organization.reference', 'name:'+modifier, organization, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['location.status']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['location.status'][constants.NO_MODIFER], 'location.reference', 'status', location, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['location.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['location.identifier'][constants.NO_MODIFER], 'location.reference', 'identifier', location, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['location.name']) {
          for (const modifier in queryObject['location.name'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['location.name'][modifier], 'location.reference', 'name:'+modifier, location, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
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
