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
require('../init')

const mongoDbQueue = require('mongodb-queue')

const config = require('../config')
const matchingConfig = require('../../config/matching')
const mongo = require('../mongo')()
const matching = require('../fhir/resources/matching')(mongo)
const resourceLinking = require('../resource-linking')(mongo)
const constants = require('../constants')

const workerName = process.argv[2]

const processQueueElement = (msg, callback) => {
  matching.match(msg.payload.resourceType, msg.payload, matchingConfig.matchSettings.defaultCount, (err, badRequest, matchesArray) => {
    if (err) {
      return callback(err)
    }

    resourceLinking.removePreviousMatchingLinks(msg.payload, (err, resource) => {
      if (err) {
        return callback(err)
      }

      resourceLinking.addLinkToMatches(matchesArray, resource, (err) => {
        if (err) {
          return callback(err)
        }

        resourceLinking.addMatchesLinksToResource(matchesArray, resource, (err) => {
          if (err) {
            return callback(err)
          }

          callback(null, msg)
        })
      })
    })
  })
}

const intervals = []
const startWorker = () => {
  mongo.getDB((err, db) => {
    if (err) {
      return process.send({ error: `${workerName} error connecting to db: ${err}` })
    }
    process.send(`${workerName} started`)

    const matchingQueue = mongoDbQueue(db, constants.MATCHING_QUEUE_COLLECTION)

    const pollQueue = () => {
      matchingQueue.get((err, msg) => {
        if (err) {
          return process.send({ error: `${workerName} error getting queue element: ${err}` })
        }

        if (!(msg && msg.payload)) {
          return process.send({ debug: `${workerName} No records in queue` })
        }

        const done = (err, msg) => {
          if (err) {
            return process.send({ error: `${workerName} error processing queue element: ${err}` })
          }

          matchingQueue.ack(msg.ack, (err, id) => {
            if (err) {
              return process.send({ error: `${workerName} error acking queue element: ${err}` })
            }
            process.send({ info: `${workerName} Successfully processed queue element with id: ${id}` })
          })
        }

        processQueueElement(msg, done)
      })
    }

    intervals.push(setInterval(pollQueue, config.getConf('matchingQueue:pollingInterval')))
  })
}

const stopWorker = (callback) => {
  intervals.forEach((interval) => {
    clearInterval(interval)
  })
  mongo.closeDB(callback)
}

if (!module.parent) {
  startWorker()
}

exports.startWorker = startWorker
exports.stopWorker = stopWorker
exports.intervals = intervals
