'use strict'

const matchingConfig = require('../../../config/matching')
const walk = require('../../path-walker')

module.exports = (mongo) => {
  let certainMatchFlag = false

  const scoreToString = (score) => {
    switch (true) {
      case score === 1:
        certainMatchFlag = true
        return 'certain'
      case score > 0.9: return 'probable'
      case score > 0.5: return 'possible'
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
            url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
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

  return {
    name: 'Matching',

    match: (resourceType, queryResource, count, callback) => {
      const pathConfigs = matchingConfig.resourceConfig[resourceType].matchingProperties
      const algorithmTypeMap = matchingConfig.matchSettings.algorithmTypeMap

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
          switch (algorithmTypeMap[algorithm]) {
            case 'exact': {
              switch (algorithm) {
                case 'exact': {
                  const query = {}
                  query[path] = { '$in': walk(path, queryResource) }

                  promises.push(new Promise((resolve, reject) => {
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
                  }))
                  break
                }
                case 'double-metaphone': {
                  // TODO
                  break
                }
              }
              break
            }

            case 'distance': {
              switch (algorithm) {
                case 'levenshtein': {
                  // TODO
                  break
                }
              }
              break
            }
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
