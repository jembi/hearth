/**
* Copyright (c) 2017-present, Jembi Health Systems NPC.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict'

const QueryUtils = require('./query-utils')
const config = require('../config')
const constants = require('../constants')
const searchParamsMap = require(`./definitions/${config.getConf('server:fhirVersion')}/search-parameters-map.json`)
const structDefMap = require(`./definitions/${config.getConf('server:fhirVersion')}/structure-definition-map.json`)

module.exports = (mongo) => {
  const queryUtils = QueryUtils(mongo)

  const buildQueryForNumber = (path, propertyType, modifier, value) => {
    throw new Error('Unsupported parameter type - number')
  }

  const buildQueryForDate = (path, propertyType, modifier, value) => {
    return queryUtils.dateToMongoClause(path, value)
  }

  const buildQueryForString = (path, propertyType, modifier, value) => {
    if (path.endsWith('address')) {
      return queryUtils.addressToMongoClause(path, value, modifier)
    } else {
      return queryUtils.stringToMongoClause(path, value, modifier)
    }
  }

  const buildQueryForURI = (path, propertyType, modifier, value) => {
    if (modifier !== constants.NO_MODIFER) {
      throw new Error('Unsupported modifier for parameter type uri')
    }
    const query = {}
    query[path] = value
    return query
  }

  const buildQueryForToken = (path, propertyType, modifier, value) => {
    switch (propertyType) {
      case 'Coding':
        return queryUtils.tokenToSystemCodeElemMatch(path, value)
      case 'CodeableConcept':
        return queryUtils.tokenToSystemCodeElemMatch(`${path}.coding`, value)
      case 'Identifier':
      case 'ContactPoint':
        return queryUtils.tokenToSystemValue(path, value)
      case 'boolean':
        return queryUtils.boolToMongoClause(path, value)
      case 'id':
      case 'code':
      case 'string':
        const subQuery = {}
        subQuery[path] = value
        return subQuery
    }
  }

  const buildQueryForQuantity = (path, propertyType, modifier, value) => {
    throw new Error('Unsupported parameter type - quantity')
  }

  const buildQueryForReference = (path, propertyType, modifier, value) => {
    return queryUtils.referenceToMongoClause(`${path}.reference`, value)
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

  const walkPropertyDef = (path, resourceType) => {
    if (structDefMap[resourceType].elements[path]) {
      return structDefMap[resourceType].elements[path]
    }

    // look for 'choince of type' direct matches
    for (let propertyPath in structDefMap[resourceType].elements) {
      if (propertyPath.includes('[x]')) {
        for (let propType of structDefMap[resourceType].elements[propertyPath].types) {
          const typedPropertyPath = propertyPath.replace('[x]', propType)
          if (typedPropertyPath === path) {
            return structDefMap[resourceType].elements[propertyPath]
          }
        }
      }
    }

    // look for partial path matches
    let longestMatch = ''
    for (let propertyPath in structDefMap[resourceType].elements) {
      if (propertyPath.includes('[x]')) {
        // handle 'choice of types' partial matches
        structDefMap[resourceType].elements[propertyPath].types.forEach((propType) => {
          const typedPropertyPath = propertyPath.replace('[x]', propType)
          if (path.startsWith(typedPropertyPath) && typedPropertyPath.length > longestMatch.length) {
            longestMatch = propertyPath
          }
        })
      } else if (path.startsWith(propertyPath) && propertyPath.length > longestMatch.length) {
        longestMatch = propertyPath
      }
    }

    if (longestMatch === '') {
      return null
    }

    let finalPropertyDef = null
    structDefMap[resourceType].elements[longestMatch].types.forEach((type) => {
      let propertyDef = walkPropertyDef(path.replace(`${longestMatch}.`, ''), type)
      if (propertyDef !== null) {
        finalPropertyDef = propertyDef
      }
    })
    return finalPropertyDef
  }

  const buildQuery = (resourceType, queryObject) => {
    let query = { $and: [] }
    for (let queryParam in queryObject) {
      // lookup search param def
      let searchParams = searchParamsMap[resourceType][queryParam]
      if (!searchParams) {
        // check if the query param is a base Resource parameter
        if (searchParamsMap['Resource'][queryParam]) {
          searchParams = searchParamsMap['Resource'][queryParam]
        } else {
          throw new Error(`Missing search parameter definition for ${resourceType} - ${queryParam}`)
        }
      }
      if (!Array.isArray(searchParams)) {
        searchParams = [ searchParams ]
      }

      const searchParamDefQuery = { $or: [] }
      searchParams.forEach((searchParam) => {
        // find best matching property def
        let propertyDef = walkPropertyDef(searchParam.path, resourceType)

        if (!propertyDef) {
          throw new Error(`Missing property structure definition for ${resourceType} - ${searchParam.path}`)
        }

        const modiferQuery = { $and: [] }
        for (let modifier in queryObject[queryParam]) {
          const typeQuery = { $or: [] }
          propertyDef.types.forEach((propertyType) => {
            typeQuery['$or'].push(queryBuilderFuncs[searchParam.type](searchParam.path, propertyType, modifier, queryObject[queryParam][modifier]))
          })
          modiferQuery['$and'].push(typeQuery)
        }
        searchParamDefQuery['$or'].push(modiferQuery)
      })
      query['$and'].push(searchParamDefQuery)
    }

    console.log(JSON.stringify(query))
    return query
  }

  return {
    buildQuery: (resourceType, queryObject) => { return buildQuery(resourceType, queryObject) }
  }
}
