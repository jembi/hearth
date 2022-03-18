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
const extensionConf = require('../../config/queryparam-extensions.json')
const moduleLoader = require('./module-loader')

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

  const buildQueryForToken = (originalPath, propertyTypeObj, propertyDefObj, modifier, value) => {
    const conditionalObj = extractConditionalParameter(originalPath)
    const path = conditionalObj.path
    const condition = conditionalObj.condition

    if (condition) {
      return queryUtils.tokenToConditionalElemMatch(path, value, condition)
    }

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
      case 'string': {
        const subQuery = {}
        subQuery[path] = value
        return subQuery
      }
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

  const extractConditionalParameter = (path) => {
    const conditionalMatch = path.match(/\[(.*?)]/)
    if (conditionalMatch) {
      path = path.replace(conditionalMatch[0], '')
    }

    return {
      path: path,
      condition: conditionalMatch ? conditionalMatch[1] : null // 2nd index - no brackets
    }
  }

  const walkPropertyDef = (originalPath, resourceType) => {
    // check if conditional parameter and extract path
    const path = extractConditionalParameter(originalPath).path

    if (structDefMap[resourceType].elements[path]) {
      return structDefMap[resourceType].elements[path]
    }

    // look for 'choice of type' direct matches
    for (const propertyPath in structDefMap[resourceType].elements) {
      if (propertyPath.includes('[x]')) {
        for (const typeObj of structDefMap[resourceType].elements[propertyPath].types) {
          const typedPropertyPath = propertyPath.replace('[x]', typeObj.code)
          if (typedPropertyPath === path) {
            return structDefMap[resourceType].elements[propertyPath]
          }
        }
      }
    }

    // look for partial path matches
    let longestMatch = ''
    for (const propertyPath in structDefMap[resourceType].elements) {
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
      const propertyDef = walkPropertyDef(path.replace(`${longestMatch}.`, ''), typeObj.code)
      if (propertyDef !== null) {
        finalPropertyDef = propertyDef
      }
    })
    return finalPropertyDef
  }

  const findReferenceTypesForParam = (queryParam, resourceType) => {
    const propertyDefs = []
    let searchParams = searchParamsMap[resourceType][queryParam]
    if (!searchParams) {
      // check if the query param is a base Resource parameter
      if (searchParamsMap.Resource[queryParam]) {
        searchParams = searchParamsMap.Resource[queryParam]
      } else {
        return []
      }
    }
    if (!Array.isArray(searchParams)) {
      searchParams = [searchParams]
    }

    searchParams.forEach((searchParam) => {
      // find best matching property def
      const propertyDef = walkPropertyDef(searchParam.path, resourceType)
      if (!propertyDef) {
        throw new Error(`Missing property structure definition for ${resourceType} - ${searchParam.path}`)
      }
      propertyDefs.push(propertyDef)
    })

    let types = []
    propertyDefs.forEach((propDef) => {
      types = types.concat(propDef.types.map((typeObj) => {
        if (typeObj.profile) {
          return typeObj.profile[0].split('/').pop()
        } else if (typeObj.targetProfile) {
          return typeObj.targetProfile.split('/').pop()
        } else {
          throw new Error('No profile defined for reference in property definiton')
        }
      }))
    })

    return types
  }

  const buildChainedQuery = (params, currentIdx, resourceType, value, callback) => {
    const module = moduleLoader.getMatchingModule(resourceType)
    mongo.getDB((err, db) => {
      if (err) { return callback(err) }

      const c = db.collection(resourceType)

      // if this is the end of the path
      if (!params[currentIdx + 1]) {
        // setup context to search for chained param value
        const ctx = { query: {} }
        ctx.query[params[currentIdx]] = value
        ctx.resourceType = resourceType

        module.searchFilters(ctx, (err, badRequest, filters) => {
          if (err) { return callback(err) }
          if (badRequest) {
            // skip parameters that don't apply to resource
            return callback(null, [])
          }

          // find resources that match value and covert them to references
          c.find(filters).project({ id: 1 }).toArray((err, results) => {
            if (err) { return callback(err) }

            const refs = results.map((resource) => {
              return `${resourceType}/${resource.id}`
            })

            return callback(null, refs)
          })
        })

        return
      }

      const refTypes = findReferenceTypesForParam(params[currentIdx], resourceType)
      if (!refTypes || refTypes.length < 1) {
        return callback(null, [])
      }

      const promises = []
      // for each possible reference type for a parameter
      refTypes.forEach((refType) => {
        promises.push(new Promise((resolve, reject) => {
          // try build a chained query for that type
          buildChainedQuery(params, currentIdx + 1, refType, value, (err, refs) => {
            if (err) { return reject(err) }

            if (!refs || refs.length < 1) {
              return resolve([])
            }

            const promisesInner = []
            // for each reference returned through chained query, search for matches to this resource type
            refs.forEach((ref) => {
              promisesInner.push(new Promise((resolve, reject) => {
                const ctx = { query: {} }
                ctx.query[params[currentIdx]] = ref
                ctx.resourceType = resourceType

                module.searchFilters(ctx, (err, badRequest, filters) => {
                  if (err) { return reject(err) }
                  if (badRequest) { return reject(new Error(`Bad request made to ${resourceType} module while chaining parameters: ${JSON.stringify(badRequest)}`)) }

                  // find resources that match references and covert them to references
                  c.find(filters).project({ id: 1 }).toArray((err, results) => {
                    if (err) { return reject(err) }
                    if (!results) { return reject(new Error('Could not find reference while chaining')) }

                    resolve(results.map((result) => `${resourceType}/${result.id}`))
                  })
                })
              }))
            })

            Promise.all(promisesInner).then((refs) => {
              // flatten array of arrays
              const refsFlat = [].concat(...refs)
              resolve(refsFlat)
            }).catch((err) => {
              reject(err)
            })
          })
        }))
      })

      Promise.all(promises).then((allRefs) => {
        // flatten array of arrays
        const allRefsFlat = [].concat(...allRefs)
        callback(null, allRefsFlat)
      }).catch((err) => {
        callback(err)
      })
    })
  }

  const buildQuery = (resourceType, queryObject, callback) => {
    const promises = []
    for (const queryParam in queryObject) {
      promises.push(new Promise((resolve, reject) => {
        const isExtensionParam =
          extensionConf[resourceType] &&
          extensionConf[resourceType][queryParam] &&
          extensionConf[resourceType][queryParam].extension

        // handle chained queries
        if (queryParam.includes('.') && !isExtensionParam) {
          buildChainedQuery(queryParam.split('.'), 0, resourceType, queryObject[queryParam][constants.NO_MODIFER], (err, refs) => {
            if (err) {
              return reject(err)
            }

            const query = {}
            query.id = { $in: refs.map((ref) => ref.split('/').pop()) }
            return resolve(query)
          })

          return
        }

        // lookup search param def
        let searchParams = searchParamsMap[resourceType][queryParam]
        if (!searchParams) {
          // check if the query param is a base Resource parameter
          if (searchParamsMap.Resource[queryParam]) {
            searchParams = searchParamsMap.Resource[queryParam]
          } else if (isExtensionParam) {
            searchParams = extensionConf[resourceType][queryParam]
          } else {
            return reject(new Error(`Missing search parameter definition for ${resourceType} - ${queryParam}`))
          }
        }
        if (!Array.isArray(searchParams)) {
          searchParams = [searchParams]
        }

        const searchParamDefQuery = { $or: [] }
        searchParams.forEach((searchParam) => {
          let propertyDef
          if (isExtensionParam) {
            // expect the extension searchparam to have the necessary property definition
            propertyDef = searchParam.propertyDef
          } else {
            // find best matching property definition for standard FHIR definitions
            propertyDef = walkPropertyDef(searchParam.path, resourceType)
            if (!propertyDef) {
              return reject(new Error(`Missing property structure definition for ${resourceType} - ${searchParam.path}`))
            }
          }

          const modiferQuery = { $and: [] }
          for (const modifier in queryObject[queryParam]) {
            const typeQuery = { $or: [] }

            propertyDef.types.forEach((typeObj) => {
              let query = queryBuilderFuncs[searchParam.type](searchParam.path, typeObj, propertyDef, modifier, queryObject[queryParam][modifier])
              if (isExtensionParam) {
                query = queryUtils.wrapInExtensionUrlFilter(query, searchParam.url)
              }

              typeQuery.$or.push(query)
            })
            modiferQuery.$and.push(typeQuery)
          }
          searchParamDefQuery.$or.push(modiferQuery)
        })

        resolve(searchParamDefQuery)
      }))
    }

    Promise.all(promises).then((queries) => {
      const query = { $and: queries }
      callback(null, query)
    }).catch((err) => {
      callback(err)
    })
  }

  const exposedPrivateFuncsForTesting = {}
  if (process.env.NODE_ENV === 'test') {
    exposedPrivateFuncsForTesting.walkPropertyDef = walkPropertyDef
    exposedPrivateFuncsForTesting.buildQueryForNumber = buildQueryForNumber
    exposedPrivateFuncsForTesting.buildQueryForDate = buildQueryForDate
    exposedPrivateFuncsForTesting.buildQueryForString = buildQueryForString
    exposedPrivateFuncsForTesting.buildQueryForToken = buildQueryForToken
    exposedPrivateFuncsForTesting.buildQueryForQuantity = buildQueryForQuantity
    exposedPrivateFuncsForTesting.buildQueryForReference = buildQueryForReference
    exposedPrivateFuncsForTesting.buildQueryForURI = buildQueryForURI
  }

  return {
    private: exposedPrivateFuncsForTesting,
    buildQuery: buildQuery
  }
}
