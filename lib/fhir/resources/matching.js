'use strict'

// const talisman = require('talisman')
const _ = require('lodash')

const matchingConfig = require('../../../config/matching')
const walk = require('../../path-walker')

module.exports = (mongo) => {
  const exactMatch = (matches, weight, path, queryResource) => {
    const queryValues = walk(path, queryResource)
    matches.map((entry) => {
      if (!entry._mpi) {
        entry._mpi = {}
        entry._mpi.score = 0
      }
      const matchedValues = walk(path, entry)
      const intersection = _.intersection(queryValues, matchedValues)
      let score = 0
      if (intersection.length > 0) {
        score = 1
      }

      entry._mpi.score += weight * score
    })
  }

  const calculateMatchScores = (pathConfigs, queryResource, matches) => {
    for (let path in pathConfigs) {
      switch (pathConfigs[path].metric) {
        case 'exact':
          exactMatch(matches, pathConfigs[path].weight, path, queryResource)
          break
      }
    }
  }

  const scoreToString = (score) => {
    switch (true) {
      case score === 1: return 'certain'
      case score > 0.9: return 'probable'
      case score > 0.5: return 'possible'
      default: return 'certainly-not'
    }
  }

  const attachSearchToMatches = (matches) => {
    matches.map((entry) => {
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

  return {
    name: 'Matching',

    match: (resourceType, queryResource, count, callback) => {
      const pathConfigs = matchingConfig[resourceType].matchingProperties

      const query = { $and: [] }
      for (let path in pathConfigs) {
        const clause = {}
        switch (pathConfigs[path].phonetic) {
          case 'exact':
            clause[path] = { '$in': walk(path, queryResource) }
            break
        }
        query['$and'].push(clause)
      }

      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const c = db.collection(resourceType)
        c.find(query).limit(count).toArray((err, matches) => {
          if (err) {
            return callback(err)
          }
          calculateMatchScores(pathConfigs, queryResource, matches)
          attachSearchToMatches(matches)
          callback(null, null, matches)
        })
      })
    }
  }
}
