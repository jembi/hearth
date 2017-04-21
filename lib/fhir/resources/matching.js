'use strict'

const matchingConfig = require('../../../config/matching')
const walk = require('../../path-walker')

module.exports = (mongo) => {
  const scoreToString = (score) => {
    switch (true) {
      case score === 1: return 'certain'
      case score > 0.9: return 'probable'
      case score > 0.5: return 'possible'
      default: return 'certainly-not'
    }
  }

  const compare = (a, b) => {
    if (a.score < b.score) {
      return -1
    }
    if (a.score > b.score) {
      return 1
    }
    return 0
  }

  const sortAndShortenMatches = (matches, count) => {
    matches = Array.sort(compare).slice(0, count)
  }

  const attachSearchToMatches = (matches) => {
    matches.map((entry) => {
      entry._mpi = {
        search: {
          extension: {
            url: 'http://hl7.org/fhir/StructureDefinition/patient-mpi-match',
            valueCode: scoreToString(entry.score)
          },
          score: entry.score
        }
      }
    })
  }

  const addToMatches = (c, query, weight, algorithm, matches) => {
    return new Promise((resolve, reject) => {
      c.find(query, (err, results) => {
        if (err) {
          return reject(err)
        }

        results.forEach((result) => {
          const id = result.id
          if (matches[id]) {
            matches[id].score += weight
            return resolve()
          }
          matches[id] = { score: weight, resource: result }
          resolve()
        })
      })
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
          const weight = pathConfigs[path].weight
          switch (algorithmMap[algorithm]) {
            case 'exact': {
              switch (algorithm) {
                case 'exact': {
                  const query = {}
                  query[path] = { '$in': walk(path, queryResource) }
                  promises.push(addToMatches(c, query, weight, algorithm, matches))
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
          sortAndShortenMatches(matches, count)
          attachSearchToMatches(matches)
          callback(null, null, matches)
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
