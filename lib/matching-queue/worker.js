'use strict'
require('../init')

const mongoDbQueue = require('mongodb-queue')

const config = require('../config')
const mongo = require('../mongo')()
// const matching = require('../fhir/resources/matching')

const workerName = process.argv[2]

const processQueueElement = (msg, callback) => {
  // matching.match(msg.payload.resourceType, element, 10, (err, badRequest, matchesArray, certainMatchFlag) => {
  //   if (err) {
  //     return callback(err)
  //   }
  //   // TODO
  //   callback(null, msg)
  // })
  callback(null, msg)
}

const intervals = []
const startWorker = (callback) => {
  mongo.getDB((err, db) => {
    if (err) {
      return process.send({ error: `${workerName} error connecting to db: ${err}` })
    }
    process.send(`${workerName} started`)

    const matchingQueue = mongoDbQueue(db, config.getConf('matchingQueue:queueCollectionName'))

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
    callback()
  })
}

const stopWorker = (callback) => {
  intervals.forEach((interval) => {
    clearInterval(interval)
  })
  mongo.closeDB(callback)
}

if (!module.parent) {
  startWorker(() => {
    process.on('SIGINT', () => stopWorker(process.exit))
    process.on('SIGTERM', () => stopWorker(process.exit))
  })
}

exports.startWorker = startWorker
exports.stopWorker = stopWorker
exports.intervals = intervals
