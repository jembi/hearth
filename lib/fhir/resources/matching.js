'use strict'

const levenshtein = require('talisman/metrics/distance/levenshtein.js')

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

  const bubbleSort = (obj) => {
    const arr = Object.keys(obj)
    const len = arr.length
    for (let i = len - 1; i >= 0; i--) {
      for (let j = 1; j <= i; j++) {
        if (obj[arr[j - 1]].score > obj[arr[j]].score) {
          const temp = arr[j - 1]
          arr[j - 1] = arr[j]
          arr[j] = temp
        }
      }
    }
    return arr
  }

  const objToArray = (keysArray, matches) => {
    return keysArray.map((key) => {
      return matches[key]
    })
  }

  const attachSearchToMatches = (matchesArray) => {
    matchesArray.map((entry) => {
      entry._mpi = {
        search: {
          extension: {
            url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
            valueCode: scoreToString(entry._mpi.score)
          },
          score: entry._mpi.score
        }
      }
    })
  }

  const sortLimitAndFormatMatches = (matches, count) => {
    const sortedKeys = bubbleSort(matches)
    const matchesArray = objToArray(sortedKeys, matches).slice(0, count)
    attachSearchToMatches(matchesArray)
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
      const algorithmMap = matchingConfig.matchSettings.algorithmMap

      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const c = db.collection(resourceType)
        const matches = {}
        const promises = []
        Object.keys(pathConfigs).forEach((path) => {
          const algorithm = pathConfigs[path].algorithm
          const weight = parseFloat(pathConfigs[path].weight)
          switch (algorithmMap[algorithm]) {
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
                        if (matches[id]) {
                          matches[id]._mpi.score += weight
                          return resolve()
                        }
                        matches[id] = result
                        matches[id]._mpi = {}
                        matches[id]._mpi.score = weight
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
                  const query = {}
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
                        const queryValues = walk(path, queryResource)
                        const matchValues = walk(path, result)

                        let maxScore = 0
                        let score = 0
                        matchValues.forEach((matchValue) => {
                          queryValues.forEach((queryValue) => {
                            const bigger = Math.max(queryValue.length, matchValue.length)
                            score = (bigger - levenshtein(queryValue, matchValue)) / bigger
                            if (score > maxScore) {
                              maxScore = score
                            }
                          })
                        })

                        if (matches[id]) {
                          matches[id]._mpi.score += weight * maxScore
                          return resolve()
                        }
                        matches[id] = result
                        matches[id]._mpi = {}
                        matches[id]._mpi.score = weight * maxScore
                        resolve()
                      })
                    })
                  }))
                  break
                }
              }
              break
            }
          }
        })

        Promise.all(promises).then(() => {
          const matchesArray = sortLimitAndFormatMatches(matches, count)
          callback(null, null, matchesArray, certainMatchFlag)
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
