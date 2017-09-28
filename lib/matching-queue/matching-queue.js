 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const cp = require('child_process')
const logger = require('winston')

module.exports = (mongo) => {
  const startWorker = (workers, workerName) => {
    return new Promise((resolve, reject) => {
      workers[workerName] = cp.fork(`${__dirname}/worker.js`, [workerName])

      workers[workerName].on('message', (msg) => {
        if (msg === `${workerName} started`) {
          return resolve()
        }
        const msgType = Object.keys(msg)[0]
        logger[msgType](msg[msgType])
      })

      workers[workerName].on('error', (err) => {
        logger.error(`${workerName} threw error ${err}`)
        stopWorker(workers[workerName])
        reject(err)
      })
    })
  }

  const stopWorker = (worker) => {
    worker.kill()
  }

  return {
    startQueueWorkers: (workers, amount, callback) => {
      const promises = []
      for (let i = 1; i <= amount; i++) {
        promises.push(startWorker(workers, `Worker ${i}`))
      }

      Promise.all(promises).then(() => {
        callback()
      }).catch((err) => {
        callback(err)
      })
    }
  }
}
