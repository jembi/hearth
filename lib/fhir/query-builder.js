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

  const buildQueryForNumber = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    throw new Error('Unsupported parameter type - number')
  }

  const buildQueryForDate = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    return queryUtils.dateToMongoClause(path, value)
  }

  const buildQueryForString = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    if (path.endsWith('address')) {
      return queryUtils.addressToMongoClause(path, value, modifier)
    } else {
      return queryUtils.stringToMongoClause(path, value, modifier)
    }
  }

  const buildQueryForURI = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    if (modifier !== constants.NO_MODIFER) {
      throw new Error('Unsupported modifier for parameter type uri')
    }
    const query = {}
    query[path] = value
    return query
  }

  const buildQueryForToken = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    switch (propertyTypeObj.code) {
      case 'Coding':
        return queryUtils.tokenToSystemCodeElemMatch(path, value)
      case 'CodeableConcept':
        return queryUtils.tokenToSystemCodeElemMatch(`${path}.coding`, value)
      case 'Identifier':
      case 'ContactPoint':
        return queryUtils.tokenToSystemValue(path, value, propertyDefObj)
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

  const buildQueryForQuantity = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    throw new Error('Unsupported parameter type - quantity')
  }

  const buildQueryForReference = (path, propertyTypeObj, propertyDefObj, modifier, value) => {
    if (Array.isArray(value)) {
      return queryUtils.referenceToMongoClause(`${path}.reference`, value)
    } else {
      // Support logical references
      let defaultType = 'Unknown'
      if (propertyTypeObj.profile) {
        defaultType = propertyTypeObj.profile[0].split('/').pop()
      }
      if (propertyTypeObj.targetProfile) {
        defaultType = propertyTypeObj.targetProfile.split('/').pop()
      }

      return queryUtils.referenceToMongoClause(`${path}.reference`,
        queryUtils.paramAsReference(value, defaultType)
      )
    }
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

    // look for 'choice of type' direct matches
    for (let propertyPath in structDefMap[resourceType].elements) {
      if (propertyPath.includes('[x]')) {
        for (let typeObj of structDefMap[resourceType].elements[propertyPath].types) {
          const typedPropertyPath = propertyPath.replace('[x]', typeObj.code)
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
        structDefMap[resourceType].elements[propertyPath].types.forEach((typeObj) => {
          const typedPropertyPath = propertyPath.replace('[x]', typeObj.code)
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
    structDefMap[resourceType].elements[longestMatch].types.forEach((typeObj) => {
      let propertyDef = walkPropertyDef(path.replace(`${longestMatch}.`, ''), typeObj.code)
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

          propertyDef.types.forEach((typeObj) => {
            typeQuery['$or'].push(queryBuilderFuncs[searchParam.type](searchParam.path, typeObj, propertyDef, modifier, queryObject[queryParam][modifier]))
          })
          modiferQuery['$and'].push(typeQuery)
        }
        searchParamDefQuery['$or'].push(modiferQuery)
      })
      query['$and'].push(searchParamDefQuery)
    }

    return query
  }

  return {
    buildQuery: (resourceType, queryObject) => { return buildQuery(resourceType, queryObject) }
  }
}
