'use strict'
require('../../../init')

const mongo = require('../../../mongo')()
const matching = require('../../resources/matching')()
const matchingConfig = require('../../../../config/matching')
const walk = require('../../../path-walker')

const ctx = JSON.parse(process.argv[2]) // parent process context object
ctx.queryResource = JSON.parse(ctx.queryResource)

const processResourceScore = (matchesMap, result) => {
  const id = result.id
  const queryValues = walk(ctx.path, ctx.queryResource)
  const matchValues = walk(ctx.path, result)

  let maxScore = 0
  let score = 0
  matchValues.forEach((matchValue) => {
    queryValues.forEach((queryValue) => {
      const bigger = Math.max(queryValue.length, matchValue.length)
      score = (bigger - matching.algorithms[ctx.algorithm](queryValue, matchValue)) / bigger
      if (score > maxScore) {
        maxScore = score
      }
    })
  })

  // only add resource that are above/equal to the possible score
  const matchScore = ctx.weight * maxScore
  if (matchScore >= matchingConfig.matchSettings.scores.possible) {
    matchesMap[id] = result
    matchesMap[id]._mpi = {}
    matchesMap[id]._mpi.score = matchScore
  }

  return matchesMap
}

const mpiQuery = (c, query, callback) => {
  const cursor = c.find(query, {}).batchSize(matchingConfig.matchSettings.defaultBatchSize)
  const matchesMap = {}
  cursor.each(function (err, doc) {
    if (err) {
      callback(err)
    }

    // process resource score if document is returned
    if (doc !== null) {
      processResourceScore(matchesMap, doc)
    } else {
      callback(null, matchesMap)
    }
  })
}

const processMatchingQuery = () => {
  mongo.getDB((err, db) => {
    if (err) {
      respondToParentProcess({ error: `${ctx.workerName} worker experienced an error`, data: err })
    }

    const c = db.collection(ctx.resourceType)
    const query = {}
    mpiQuery(c, query, (err, results) => {
      if (err) {
        respondToParentProcess({ error: `${ctx.workerName} worker experienced an error`, data: err })
      }

      respondToParentProcess({ info: `${ctx.workerName} worker successfully completed`, data: results })
    })
  })
}

const respondToParentProcess = (messageObj) => {
  mongo.closeDB(() => {
    process.send(messageObj)
  })
}

if (!module.parent) {
  processMatchingQuery()
}

exports.processMatchingQuery = processMatchingQuery
