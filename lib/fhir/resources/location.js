 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const Organization = require('./organization');
const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const organization = Organization(mongo)
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  let afterReadHook = (ctx, data, callback) => {
    if (ctx.query && ctx.query._summary) {
      fhirCommon.addSubsettedSecurityLabel(data)
      delete data.telecom
      delete data.address
      delete data.position
      return callback(null, null, data)
    }

    callback(null, null, data)
  }

  const self = {
    name: 'Location',

    after: {
      read: afterReadHook,
      vread: afterReadHook
    }
  }

  self.searchFilters = (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        _id: {},
        _lastUpdated: {},
        identifier: { allowArray: true },
        organization: {},
        type: {},
        name: { modifiers: { exact: true, contains: true } },
        partof: {},
        'status': {},
        type: {},
        address: { modifiers: { exact: true } },
        'address-country': { modifiers: { exact: true } },
        'organization.active': {},
        'organization.identifier': { allowArray: true },
        'organization.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        'partof.identifier': { allowArray: true },
        'partof.name': { allowArray: true, modifiers: { exact: true, contains: true } },
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

        if (queryObject['identifier']) {
          query['$and'].push(queryUtils.tokenToSystemValueElemMatch('identifier', queryObject['identifier'][constants.NO_MODIFER]))
        }

        if (queryObject['organization']) {
          query['$and'].push({ 'managingOrganization.reference': queryUtils.paramAsReference(queryObject['organization'][constants.NO_MODIFER], 'Organization') })
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        if (queryObject['name']) {
          for (const modifier in queryObject['name']) {
            query['$and'].push(queryUtils.stringToMongoClause('name', queryObject['name'][modifier], modifier))
          }
        }

        if (queryObject['partof']) {
          query['$and'].push({ 'partof.reference': queryUtils.paramAsReference(queryObject['partof'][constants.NO_MODIFER], 'Location') })
        }

        if (queryObject['status']) {
          query['$and'].push(queryUtils.tokenToMongoClause('status', queryObject['status'][constants.NO_MODIFER]))
        }

        if (queryObject['type']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('type.coding', queryObject['type'][constants.NO_MODIFER]))
        }

        if (queryObject['address']) {
          for (const modifier in queryObject['address']) {
            query['$and'].push(queryUtils.addressToMongoClause('address', queryObject['address'][modifier], modifier))
          }
        }

        if (queryObject['address-country']) {
          for (const modifier in queryObject['address-country']) {
            query['$and'].push(queryUtils.addressToMongoClause('country', queryObject['address-country'][modifier], modifier))
          }
        }

        if (queryObject['organization.active']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['organization.active'][constants.NO_MODIFER], 'managingOrganization.reference', 'active', organization, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['organization.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['organization.identifier'][constants.NO_MODIFER], 'managingOrganization.reference', 'identifier', organization, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['organization.name']) {
          for (const modifier in queryObject['organization.name'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['organization.name'][modifier], 'managingOrganization.reference', 'name:'+modifier, organization, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['partof.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['partof.identifier'][constants.NO_MODIFER], 'partOf.reference', 'identifier', self, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['partof.name']) {
          for (const modifier in queryObject['partof.name'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['partof.name'][modifier], 'partOf.reference', 'name:'+modifier, self, (err, clause) => {
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
  return self
}
