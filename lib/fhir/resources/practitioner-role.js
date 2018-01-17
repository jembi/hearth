 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const Practitioner = require('./practitioner');
const Organization = require('./organization');
const Location = require('./location');
const HealthcareService = require('./healthcare-service');
const FhirCommon = require('../common')
const constants = require('../../constants')
const QueryUtils = require('../query-utils')

module.exports = (mongo) => {
  const practitioner = Practitioner(mongo)
  const organization = Organization(mongo)
  const location = Location(mongo)
  const healthcareService = HealthcareService(mongo)
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  return {
    name: 'PractitionerRole',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query
      const supportedParams = {
        _id: {},
        _lastUpdated: {},
        active: {},
        location: {},
        organization: {},
        practitioner: {},
        role: {},
        service: {},
        specialty: {},
        'practitioner.identifier': { allowArray: true },
        'practitioner.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        'practitioner.given': { allowArray: true, modifiers: { exact: true, contains: true } },
        'practitioner.family': { allowArray: true, modifiers: { exact: true, contains: true } },
        'practitioner.address': { allowArray: true, modifiers: { exact: true } },
        'practitioner.address-state': { allowArray: true, modifiers: { exact: true } },
        'practitioner.communication': { allowArray: true },
        'organization.active': {},
        'organization.identifier': { allowArray: true },
        'organization.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        'location.status': {},
        'location.identifier': { allowArray: true },
        'location.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        'service.active': {},
        'service.identifier': { allowArray: true },
        'service.type': {},
        'service.location': {},
        'service.name': { allowArray: true, modifiers: { exact: true, contains: true } },
        'service.organization': {},
        
        //type: {},
        //'address-country': { modifiers: { exact: true } },
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

        if (queryObject['location']) {
          query['$and'].push({ 'location.reference': queryUtils.paramAsReference(queryObject['location'][constants.NO_MODIFER], 'Location') })
        }

        if (queryObject['organization']) {
          query['$and'].push({ 'organization.reference': queryUtils.paramAsReference(queryObject['organization'][constants.NO_MODIFER], 'Organization') })
        }

        if (queryObject['practitioner']) {
          query['$and'].push({ 'practitioner.reference': queryUtils.paramAsReference(queryObject['practitioner'][constants.NO_MODIFER], 'Practitioner') })
        }

        if (queryObject['role']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('code.coding', queryObject['role'][constants.NO_MODIFER]))
        }

        if (queryObject['service']) {
          query['$and'].push({ 'healthcareService.reference': queryUtils.paramAsReference(queryObject['service'][constants.NO_MODIFER], 'HealthcareService') })
        }

        if (queryObject['specialty']) {
          query['$and'].push(queryUtils.tokenToSystemCodeElemMatch('specialty.coding', queryObject['specialty'][constants.NO_MODIFER]))
        }

        if (queryObject['practitioner.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['practitioner.identifier'][constants.NO_MODIFER], 'practitioner.reference', 'identifier', practitioner, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['practitioner.name']) {
          for (const modifier in queryObject['practitioner.name'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['practitioner.name'][modifier], 'practitioner.reference', 'name:'+modifier, practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['practitioner.family']) {
          for (const modifier in queryObject['practitioner.family'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['practitioner.family'][modifier], 'practitioner.reference', 'family:'+modifier, practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['practitioner.given']) {
          for (const modifier in queryObject['practitioner.given'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['practitioner.given'][modifier], 'practitioner.reference', 'given:'+modifier, practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['practitioner.address']) {
          for (const modifier in queryObject['practitioner.address'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['practitioner.address'][modifier], 'practitioner.reference', 'address:'+modifier, practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['practitioner.address-state']) {
          for (const modifier in queryObject['practitioner.address-state'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['practitioner.address-state'][modifier], 'practitioner.reference', 'address-state:'+modifier, practitioner, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }

        if (queryObject['practitioner.communication']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['practitioner.communication'][constants.NO_MODIFER], 'practitioner.reference', 'communication', practitioner, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
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

        if (queryObject['service.active']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['service.active'][constants.NO_MODIFER], 'healthcareService.reference', 'active', healthcareService, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['service.identifier']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['service.identifier'][constants.NO_MODIFER], 'healthcareService.reference', 'identifier', healthcareService, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['service.type']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['service.type'][constants.NO_MODIFER], 'healthcareService.reference', 'type', healthcareService, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }


        if (queryObject['service.location']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['service.location'][constants.NO_MODIFER], 'healthcareService.reference', 'location', healthcareService, (err, clause) => {
              if (err) { return reject(err) }
              query['$and'].push(clause)
              resolve()
            })
          }))
        }

        if (queryObject['service.name']) {
          for (const modifier in queryObject['service.name'] ) {
            promises.push(new Promise((resolve, reject) => {
              queryUtils.genChainedParamQuery(queryObject['service.name'][modifier], 'healthcareService.reference', 'name:'+modifier, healthcareService, (err, clause) => {
                if (err) { return reject(err) }
                query['$and'].push(clause)
                resolve()
              })
            }))
          }
        }


        if (queryObject['service.organization']) {
          promises.push(new Promise((resolve, reject) => {
            queryUtils.genChainedParamQuery(queryObject['service.organization'][constants.NO_MODIFER], 'healthcareService.reference', 'organization', healthcareService, (err, clause) => {
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
