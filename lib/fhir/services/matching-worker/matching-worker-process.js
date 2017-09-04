/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
