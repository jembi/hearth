'use strict'

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
      return matchesMap[b].score - matchesMap[a].score
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
          score: matchesMap[key]._mpi.score
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

  return {
    name: 'Matching',

    algorithms: algorithms,

    match: (resourceType, queryResource, count, callback) => {
      const pathConfigs = matchingConfig.resourceConfig[resourceType].matchingProperties
      const algorithmTypeMap = matchingConfig.matchSettings.algorithmTypeMap

      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const c = db.collection(resourceType)
        const promises = []
        Object.keys(pathConfigs).forEach((path) => {
          const algorithm = pathConfigs[path].algorithm
          const weight = parseFloat(pathConfigs[path].weight)
          switch (algorithmTypeMap[algorithm]) {
            case 'exact-match':
              const query = {}
              query[path] = { '$in': walk(path, queryResource) }
              promises.push(exactMatchLookup(c, query, weight))
              break

            case 'exact-match-representation':
              switch (algorithm) {
                case 'double-metaphone':
                  let query = { '$or': [] }
                  walk(path, queryResource).forEach((prop) => {
                    const phonetic = algorithms[algorithm](prop)
                    const clause = {}
                    clause[`_transforms.matching.${path}`] = {
                      '$elemMatch': {
                        '$or': [
                          { '0': phonetic[0] },
                          { '1': phonetic[1] }
                        ]
                      }
                    }
                    query['$or'].push(clause)
                  })
                  promises.push(exactMatchLookup(c, query, weight))
                  break
              }
              break

            case 'realtime':
              switch (algorithm) {
                case 'levenshtein':
                  const workerContext = {
                    workerName: 'mpi_query',
                    resourceType: resourceType,
                    queryResource: JSON.stringify(queryResource),
                    path: path,
                    algorithm: algorithm,
                    weight: weight
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
            Object.keys(algorithmTypeResultsObj).forEach(function (key, index) {
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

          const matchesArray = sortLimitAndFormatMatches(matches, count)
          callback(null, null, matchesArray, certainMatchFlag)
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
