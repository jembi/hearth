'use strict'

const cp = require('child_process')
const logger = require('winston')

module.exports = (mongo) => {
  const startMatchingWorker = (context) => {
    return new Promise((resolve, reject) => {
      let worker = cp.fork(`${__dirname}/matching-worker-process.js`)

      worker.send(context)

      worker.on('message', (msg) => {
        if (msg.info === `${context.workerName} worker successfully completed`) {
          resolve(msg.data)
          stopMatchingWorker(worker)
          return
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
