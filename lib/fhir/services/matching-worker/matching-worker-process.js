 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
require('../../../init')

const mongo = require('../../../mongo')()
const matching = require('../../resources/matching')()
const matchingConfig = require('../../../../config/matching')
const walk = require('../../../path-walker')

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

  const matchScore = ctx.weight * maxScore
  matchesMap[id] = result
  matchesMap[id]._mpi = {}
  matchesMap[id]._mpi.score = matchScore

  return matchesMap
}

const mpiQuery = (c, query, callback) => {
  const cursor = c.find(query).batchSize(matchingConfig.matchSettings.defaultBatchSize)
  const matchesMap = {}
  cursor.each(function (err, doc) {
    if (err) {
      cursor.close()
      callback(err)
    }

    // process resource score if document is returned
    if (doc && doc !== null) {
      processResourceScore(matchesMap, doc)
    } else {
      cursor.close()
      callback(null, matchesMap)
    }
  })
}

const processMatchingQuery = () => {
  mongo.getDB((err, db) => {
    if (err) {
      process.send({ error: `${ctx.workerName} worker experienced an error`, data: err })
    }

    const c = db.collection(ctx.resourceType)

    let query = {}
    query = matching.appendToQuery(matching.createEliminateMatchingOnSelfQuery(ctx.queryResource.id), query)
    query = matching.appendToQuery(ctx.discriminatorQuery, query)

    mpiQuery(c, query, (err, results) => {
      if (err) {
        process.send({ error: `${ctx.workerName} worker experienced an error`, data: err })
      }

      process.send({ info: `${ctx.workerName} worker successfully completed`, data: results })
    })
  })
}

let ctx
// only start matching query once context has been received
process.on('message', function (data) {
  ctx = data
  processMatchingQuery()
})

exports.processResourceScore = processResourceScore
exports.mpiQuery = mpiQuery
exports.processMatchingQuery = processMatchingQuery
