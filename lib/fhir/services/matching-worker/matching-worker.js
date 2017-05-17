'use strict'

const cp = require('child_process')
const logger = require('winston')

module.exports = (mongo) => {
  let worker = {}

  const startMatchingWorker = (context) => {
    return new Promise((resolve, reject) => {
      worker = cp.fork(`${__dirname}/matching-worker-process.js`, [JSON.stringify(context)])

      worker.on('message', (msg) => {
        if (msg.info === `${context.workerName} worker successfully completed`) {
          stopMatchingWorker()
          return resolve(msg.data)
        }
      })

      worker.on('error', (err) => {
        logger.error(`${context.workerName} worker threw error ${err}`)
        stopMatchingWorker()
        reject(err)
      })
    })
  }

  const stopMatchingWorker = () => {
    worker.kill('SIGINT')
  }

  return {
    startMatchingWorker: startMatchingWorker
  }
}
