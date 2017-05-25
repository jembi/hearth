'use strict'

const algorithms = {
  levenshtein: require('talisman/metrics/distance/levenshtein.js'),
  'double-metaphone': require('talisman/phonetics/double-metaphone')
}

const matchingConfig = require('../../../config/matching')
const walk = require('../../path-walker')

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

  const formatMatches = (matchingKeys, matchesMap) => {
    return matchingKeys.map((key) => {
      matchesMap[key]._mpi = {
        search: {
          extension: {
            url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
            valueCode: scoreToString(matchesMap[key]._mpi.score)
          },
          score: parseFloat(matchesMap[key]._mpi.score.toFixed(4))
        }
      }
      return matchesMap[key]
    })
  }

  const sortLimitAndFormatMatches = (matchesMap, count) => {
    const sortedKeys = orderMatchesDescending(matchesMap)
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

  const exactMatchLookup = (c, query, matchesMap, weight) => {
    return new Promise((resolve, reject) => {
      mpiQuery(c, query, (err, results) => {
        if (err) {
          return reject(err)
        }

        if (results.length < 1) {
          return resolve()
        }

        results.forEach((result) => {
          const id = result.id
          if (matchesMap[id]) {
            matchesMap[id]._mpi.score += weight
            return resolve()
          }
          matchesMap[id] = result
          matchesMap[id]._mpi = {}
          matchesMap[id]._mpi.score = weight
          resolve()
        })
      })
    })
  }

  const eleminateMatchingOnSelf = (resourceId, query) => {
    if (resourceId) {
      return {
        $and: [
          query,
          { id: { $nin: [ resourceId ] } }
        ]
      }
    }
    return query
  }

  const addDiscriminatorsToQuery = (discriminatorQuery, query) => {
    if (discriminatorQuery) {
      return {
        $and: [
          query,
          discriminatorQuery
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
    Object.keys(discriminatorProperties).forEach((path) => {
      const algorithm = discriminatorProperties[path].algorithm
      const queryValues = walk(path, queryResource)
      switch (algorithmTypeMap[algorithm]) {
        case 'exact-match':
          query = createExactMatchQuery(path, queryValues)
          break
        case 'exact-match-representation':
          query = createExactMatchOnRepresentationQuery(path, queryValues, algorithm)
          break
        case 'partial-match':
          query = createPartialMatch(path, queryValues, 1)
          break
        default:
          throw new Error(`This algorithm type cannot be used in a discriminator: ${algorithmTypeMap[algorithm]}`)
      }
    })
    return query
  }

  return {
    name: 'Matching',

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
        const matchesMap = {}
        const promises = []
        Object.keys(pathConfigs).forEach((path) => {
          const algorithm = pathConfigs[path].algorithm
          const weight = parseFloat(pathConfigs[path].weight)
          let query
          switch (algorithmTypeMap[algorithm]) {
            case 'exact-match':
              query = createExactMatchQuery(path, walk(path, queryResource))
              query = eleminateMatchingOnSelf(resourceId, query)
              query = addDiscriminatorsToQuery(discriminatorQuery, query)
              promises.push(exactMatchLookup(c, query, matchesMap, weight))
              break

            case 'exact-match-representation':
              query = createExactMatchOnRepresentationQuery(path, walk(path, queryResource), algorithm)
              query = eleminateMatchingOnSelf(resourceId, query)
              query = addDiscriminatorsToQuery(discriminatorQuery, query)
              promises.push(exactMatchLookup(c, query, matchesMap, weight))
              break

            case 'realtime':
              switch (algorithm) {
                case 'levenshtein':
                  let query = {}
                  promises.push(new Promise((resolve, reject) => {
                    query = eleminateMatchingOnSelf(resourceId, query)
                    query = addDiscriminatorsToQuery(discriminatorQuery, query)
                    mpiQuery(c, query, (err, results) => {
                      if (err) {
                        return reject(err)
                      }

                      if (results.length < 1) {
                        return resolve()
                      }

                      results.forEach((result) => {
                        const id = result.id
                        const queryValues = walk(path, queryResource)
                        const matchValues = walk(path, result)

                        let maxScore = 0
                        let score = 0
                        matchValues.forEach((matchValue) => {
                          queryValues.forEach((queryValue) => {
                            const bigger = Math.max(queryValue.length, matchValue.length)
                            score = (bigger - algorithms[algorithm](queryValue, matchValue)) / bigger
                            if (score > maxScore) {
                              maxScore = score
                            }
                          })
                        })

                        if (matchesMap[id]) {
                          matchesMap[id]._mpi.score += weight * maxScore
                          return resolve()
                        }
                        matchesMap[id] = result
                        matchesMap[id]._mpi = {}
                        matchesMap[id]._mpi.score = weight * maxScore
                        resolve()
                      })
                    })
                  }))
                  break
              }
              break
          }
        })

        Promise.all(promises).then(() => {
          const matchesArray = sortLimitAndFormatMatches(matchesMap, count)
          callback(null, null, matchesArray, certainMatchFlag)
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
