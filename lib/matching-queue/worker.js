 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
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
