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
        const msgType = Object.keys(msg)
        logger[msgType](msg[msgType])
      })

      workers[workerName].on('error', (err) => {
        logger.error(`${workerName} threw error ${err}`)
        reject(err)
      })
    })
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
