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

  const fetchAndFormatMatches = (c, matchingKeys, matchesMap, callback) => {
    c.find({ id: { '$in': matchingKeys } }).toArray((err, results) => {
      if (err) {
        return callback(err)
      }

      results.forEach((resource) => {
        const key = resource.id
        const score = parseFloat(matchesMap[key]._mpi.score.toFixed(4))

        resource._mpi = {
          search: {
            extension: {
              url: 'http://hl7.org/fhir/StructureDefinition/match-grade',
              valueCode: scoreToString(score)
            },
            score: score
          }
        }
      })

      callback(null, results)
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

  const addFirstCharToDiscriminator = (values, discriminator, returnQuery) => {
    values.forEach((value) => {
      returnQuery['$and'].push({
        [discriminator]: {
          $regex: `^${value[0]}.*`,
          $options: 'i'
        }
      })
    })
  }

  const addDiscriminatorsToQuery = (queryResource, query) => {
    let returnQuery = { $and: [ query ] }

    const discriminators = matchingConfig.matchSettings.discriminators

    Object.keys(discriminators).forEach((discriminator) => {
      if (discriminators[discriminator]) {
        switch (discriminator) {
          case 'gender':
            const gender = walk(discriminator, queryResource)[0]
            if (gender) {
              returnQuery['$and'].push({ [discriminator]: gender })
            }
            break

          case 'birthDate':
            const birthDate = walk(discriminator, queryResource)[0]
            if (birthDate) {
              const birthYearThreshold = discriminators[discriminator].birthYearThreshold
              const year = parseInt(birthDate.split('-')[0])
              const from = String(year - birthYearThreshold)
              const to = String(year + birthYearThreshold)

              returnQuery['$and'].push({
                [discriminator]: {
                  $gte: from,
                  $lt: to
                }
              })
            }
            break

          case 'name.given':
            const givenNames = walk(discriminator, queryResource)
            addFirstCharToDiscriminator(givenNames, discriminator, returnQuery)
            break

          case 'name.family':
            const familyNames = walk(discriminator, queryResource)
            addFirstCharToDiscriminator(familyNames, discriminator, returnQuery)
            break
        }
      }
    })

    return returnQuery
  }

  return {
    name: 'Matching',

    algorithms: algorithms,
    eleminateMatchingOnSelf: eleminateMatchingOnSelf,
    addDiscriminatorsToQuery: addDiscriminatorsToQuery,

    match: (resourceType, queryResource, count, callback) => {
      const resourceId = queryResource.id
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
              let query = {}
              query[path] = { '$in': walk(path, queryResource) }
              query = eleminateMatchingOnSelf(resourceId, query)
              query = addDiscriminatorsToQuery(queryResource, query)
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
                  query = eleminateMatchingOnSelf(resourceId, query)
                  query = addDiscriminatorsToQuery(queryResource, query)
                  promises.push(exactMatchLookup(c, query, weight))
                  break
              }
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
