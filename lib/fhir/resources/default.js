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
const config = require('../../config')
const searchParamsMap = require(`../definitions/${config.getConf('server:fhirVersion')}/search-parameters-map.json`)
const structDefMap = require(`../definitions/${config.getConf('server:fhirVersion')}/structure-definition-map.json`)

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)
  const queryUtils = QueryUtils(mongo)

  const buildQueryForNumber = (query, path, propertyType, modifier, value) => {
    throw new Error('Unsupported parameter type - number')
  }

  const buildQueryForDate = (query, path, propertyType, modifier, value) => {
    query['$and'].push(queryUtils.dateToMongoClause(path, value))
  }

  const buildQueryForString = (query, path, propertyType, modifier, value) => {
    if (path.endsWith('address')) {
      query['$and'].push(queryUtils.addressToMongoClause(path, value, modifier))
    } else {
      query['$and'].push(queryUtils.stringToMongoClause(path, value, modifier))
    }
  }

  const buildQueryForURI = (query, path, propertyType, modifier, value) => {
    throw new Error('Unsupported parameter type - uri')
  }

  const buildQueryForToken = (query, path, propertyType, modifier, value) => {
    switch (propertyType) {
      case 'Coding':
        query['$and'].push(queryUtils.tokenToSystemCodeElemMatch(path, value))
        break
      case 'CodeableConcept':
        query['$and'].push(queryUtils.tokenToSystemCodeElemMatch(`${path}.coding`, value))
        break
      case 'Identifier':
      case 'ContactPoint':
        query['$and'].push(queryUtils.tokenToSystemValueElemMatch(path, value))
        break
      case 'boolean':
        query['$and'].push(queryUtils.boolToMongoClause(path, value))
        break
      case 'code':
      case 'string':
        const subQuery = {}
        subQuery[path] = value
        query['$and'].push(subQuery)
        break
    }
  }

  const buildQueryForQuantity = (query, path, propertyType, modifier, value) => {
    throw new Error('Unsupported parameter type - quantity')
  }

  const buildQueryForReference = (query, path, propertyType, modifier, value) => {
    query['$and'].push(queryUtils.referenceToMongoClause(`${path}.reference`, queryUtils.paramAsReference(value, 'unknown')))
  }

  const queryBuilderFuncs = {
    number: buildQueryForNumber,
    date: buildQueryForDate,
    string: buildQueryForString,
    token: buildQueryForToken,
    reference: buildQueryForReference,
    quantity: buildQueryForQuantity,
    uri: buildQueryForURI
  }

  const buildQuery = (resourceType, queryObject) => {
    const query = { $and: [] }

    // build query object
    for (let queryParam in queryObject) {
      const searchParam = searchParamsMap[resourceType][queryParam]
      let propertyDef
      searchParam.path.split('.').forEach((pathComponent) => {
        if (!propertyDef) {
          propertyDef = structDefMap[resourceType].elements[pathComponent]
        } else {
          // TODO figure a way around using first type
          propertyDef = structDefMap[propertyDef.types[0]].elements[pathComponent]
        }
      })
      if (!searchParam) {
        throw new Error(`Missing search parameter definition for ${resourceType} - ${queryParam}`)
      }
      if (!propertyDef) {
        throw new Error(`Missing property structure definition for ${resourceType} - ${searchParam.path}`)
      }
      for (let modifier in queryObject[queryParam]) {
        propertyDef.types.forEach((propertyType) => {
          queryBuilderFuncs[searchParam.type](query, searchParam.path, propertyType, modifier, queryObject[queryParam][modifier])
        })
      }
    }

    console.log(JSON.stringify(query, null, 2))
    return query
  }

  return {
    name: 'Default',

    searchFilters: (ctx, callback) => {
      const queryParams = ctx.query

      queryUtils.validateAndParseQueryParams(queryParams, '*', (badRequest, queryObject) => {
        if (badRequest) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
        }

        const query = buildQuery(ctx.resourceType, queryObject)

        if (query['$and'].length > 0) {
          callback(null, null, query)
        } else {
          callback()
        }
      })
    }
  }
}
