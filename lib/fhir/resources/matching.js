 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const _ = require('lodash')

const algorithms = {
  levenshtein: require('talisman/metrics/distance/levenshtein.js'),
  'double-metaphone': require('talisman/phonetics/double-metaphone')
}

const matchingConfig = require('../../../config/matching')
const walk = require('../../path-walker')
const matchingWorker = require('../services/matching-worker/matching-worker')()

module.exports = (mongo) => {
  let certainMatchFlag = false

  const scoreToString = (score) => {
    const scores = matchingConfig.matchSettings.scores
    switch (true) {
      case score >= scores.certain:
        certainMatchFlag = true
        return 'certain'
      case score >= scores.probable: return 'probable'
      case score >= scores.possible: return 'possible'
      default: return 'certainly-not'
    }
  }

  const orderMatchesDescending = (matchesMap) => {
    return Object.keys(matchesMap).sort((a, b) => {
      return matchesMap[b]._mpi.score - matchesMap[a]._mpi.score
    })
  }

  const filterValidMatches = (matchesMap) => {
    Object.keys(matchesMap).forEach((key) => {
      if (matchesMap[key]._mpi.score < matchingConfig.matchSettings.scores.possible) {
        delete matchesMap[key]
      }
    })

    return matchesMap
  }

  const formatMatches = (matchingKeys, matchesMap) => {
    return matchingKeys.map((key) => {
      const score = parseFloat(matchesMap[key]._mpi.score.toFixed(4))
      matchesMap[key]._mpi = {
        search: {
          extension: {
            url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
            valueCode: scoreToString(score)
          },
          score: score
        }
      }
      return matchesMap[key]
    })
  }

  const sortFilterLimitAndFormatMatches = (matchesMap, count) => {
    const filteredMap = filterValidMatches(matchesMap)
    const sortedKeys = orderMatchesDescending(filteredMap)
    const limitedKeys = sortedKeys.slice(0, count)

    const matchesArray = formatMatches(limitedKeys, matchesMap)
    return matchesArray
  }

  const mpiQuery = (c, query, callback) => {
    c.find(query).toArray((err, results) => {
      if (err) {
        return callback(err)
      }
      callback(null, results)
    })
  }

  const exactMatchLookup = (c, query, weight) => {
    const resources = {}
    return new Promise((resolve, reject) => {
      mpiQuery(c, query, (err, results) => {
        if (err) {
          return reject(err)
        }

        if (results.length < 1) {
          return resolve({})
        }

        results.forEach((result) => {
          const id = result.id
          resources[id] = result
          resources[id]._mpi = {}
          resources[id]._mpi.score = weight
        })

        resolve(resources)
      })
    })
  }

  const createEliminateMatchingOnSelfQuery = (resourceId) => {
    if (resourceId) {
      return { id: { $nin: [ resourceId ] } }
    }
    return null
  }

  const appendToQuery = (queryToAppend, query) => {
    if (_.isEmpty(query)) {
      return queryToAppend
    } else if (queryToAppend && !_.isEmpty(queryToAppend)) {
      return {
        $and: [
          query,
          queryToAppend
        ]
      }
    }
    return query
  }

  const createExactMatchQuery = (path, queryValues) => {
    const query = {}
    query[path] = { '$in': queryValues }
    return query
  }

  const createExactMatchOnRepresentationQuery = (path, queryValues, algorithm) => {
    let query = { '$or': [] }
    queryValues.forEach((queryValue) => {
      const representations = algorithms[algorithm](queryValue)
      const clause = {}
      if (Array.isArray(representations)) {
        const conditions = []
        representations.forEach((representation, index) => {
          const condition = {}
          condition[index] = representation
          conditions.push(condition)
        })
        clause[`_transforms.matching.${path}`] = {
          '$elemMatch': {
            '$or': conditions
          }
        }
      } else {
        clause[`_transforms.matching.${path}`] = representations
      }
      query['$or'].push(clause)
    })
    return query
  }

  const createPartialMatch = (path, queryValues, numChars) => {
    const query = { $or: [] }
    queryValues.forEach((value) => {
      query['$or'].push({
        [path]: {
          $regex: `^${value.substring(0, numChars)}.*`,
          $options: 'i'
        }
      })
    })
    return query
  }

  const createDiscriminatorQuery = (queryResource, discriminatorProperties) => {
    let query = null
    const algorithmTypeMap = matchingConfig.matchSettings.algorithmTypeMap
    if ( !discriminatorProperties ) {
      return query;
    }
    Object.keys(discriminatorProperties).forEach((path) => {
      const algorithm = discriminatorProperties[path].algorithm
      const queryValues = walk(path, queryResource)
      switch (algorithmTypeMap[algorithm]) {
        case 'exact-match':
          query = appendToQuery(createExactMatchQuery(path, queryValues), query)
          break
        case 'exact-match-representation':
          query = appendToQuery(createExactMatchOnRepresentationQuery(path, queryValues, algorithm), query)
          break
        case 'partial-match':
          switch (algorithm) {
            case 'partial-1-char':
              query = appendToQuery(createPartialMatch(path, queryValues, 1), query)
              break
            case 'partial-2-char':
              query = appendToQuery(createPartialMatch(path, queryValues, 2), query)
              break
            case 'partial-3-char':
              query = appendToQuery(createPartialMatch(path, queryValues, 3), query)
              break
            default:
              throw new Error(`This algorithm cannot be used in a discriminator: ${algorithm}`)
          }
          break
        default:
          throw new Error(`This algorithm type cannot be used in a discriminator: ${algorithmTypeMap[algorithm]}`)
      }
    })
    return query
  }

  return {
    name: 'Matching',

    algorithms: algorithms,
    createEliminateMatchingOnSelfQuery: createEliminateMatchingOnSelfQuery,
    appendToQuery: appendToQuery,

    match: (resourceType, queryResource, count, callback) => {
      const resourceId = queryResource.id
      const pathConfigs = matchingConfig.resourceConfig[resourceType].matchingProperties
      const algorithmTypeMap = matchingConfig.matchSettings.algorithmTypeMap

      const discriminatorQuery = createDiscriminatorQuery(queryResource, matchingConfig.resourceConfig[resourceType].discriminatorProperties)

      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const c = db.collection(resourceType)
        const promises = []
        Object.keys(pathConfigs).forEach((path) => {
          const algorithm = pathConfigs[path].algorithm
          const weight = parseFloat(pathConfigs[path].weight)
          let query
          switch (algorithmTypeMap[algorithm]) {
            case 'exact-match':
              query = createExactMatchQuery(path, walk(path, queryResource))
              query = appendToQuery(createEliminateMatchingOnSelfQuery(resourceId), query)
              query = appendToQuery(discriminatorQuery, query)
              promises.push(exactMatchLookup(c, query, weight))
              break

            case 'exact-match-representation':
              query = createExactMatchOnRepresentationQuery(path, walk(path, queryResource), algorithm)
              query = appendToQuery(createEliminateMatchingOnSelfQuery(resourceId), query)
              query = appendToQuery(discriminatorQuery, query)
              promises.push(exactMatchLookup(c, query, weight))
              break

            case 'realtime':
              switch (algorithm) {
                case 'levenshtein':
                  const workerContext = {
                    workerName: `mpi_query_${path}`,
                    resourceType: resourceType,
                    queryResource: queryResource,
                    path: path,
                    algorithm: algorithm,
                    weight: weight,
                    discriminatorQuery: discriminatorQuery
                  }

                  promises.push(matchingWorker.startMatchingWorker(workerContext))
                  break
              }
              break
          }
        })

        Promise.all(promises).then((results) => {
          const matches = {}

          results.forEach((algorithmTypeResultsObj) => {
            Object.keys(algorithmTypeResultsObj).forEach(function (key) {
              const resource = algorithmTypeResultsObj[key]
              const id = resource.id

              if (matches[id]) {
                matches[id]._mpi.score += resource._mpi.score
              } else {
                matches[id] = resource
                matches[id]._mpi = {
                  score: resource._mpi.score
                }
              }
            })
          })

          const matchesArray = sortFilterLimitAndFormatMatches(matches, count)
          callback(null, null, matchesArray, certainMatchFlag)
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
