 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const cp = require('child_process')
const logger = require('../../../logger')

module.exports = (mongo) => {
  const startMatchingWorker = (context) => {
    return new Promise((resolve, reject) => {
      let worker = cp.fork(`${__dirname}/matching-worker-process.js`)

      worker.send(context)

      worker.on('message', (msg) => {
        if (msg.info === `${context.workerName} worker successfully completed`) {
          stopMatchingWorker(worker)
          resolve(msg.data)
        }
      })

      worker.on('error', (err) => {
        logger.error(`${context.workerName} worker threw error ${err}`)
        stopMatchingWorker(worker)
        reject(err)
      })
    })
  }

  const stopMatchingWorker = (worker) => {
    worker.kill()
  }

  return {
    startMatchingWorker: startMatchingWorker
  }
}
