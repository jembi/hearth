'use strict'

const mongoDbQueue = require('mongodb-queue')
const tap = require('tap')
const cp = require('child_process')

const env = require('./test-env/init')()
const config = require('../lib/config')
const constants = require('../lib/constants')

const patientResource = require('./resources/Patient-1.json')

let testQueue
const matchingQueueTest = (queueSize, t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    testQueue = mongoDbQueue(db, constants.MATCHING_QUEUE_COLLECTION)
    const testArray = []
    for (let i = 0; i < queueSize; i++) {
      testArray[i] = JSON.parse(JSON.stringify(patientResource))
      testArray[i].id = i
    }

    const promises = []
    const c = db.collection('Patient')
    testArray.forEach((obj) => {
      promises.push(new Promise((resolve, reject) => {
        testQueue.add(obj, (err) => {
          if (err) {
            reject(err)
          }
          resolve()
        })
      }))

      promises.push(new Promise((resolve, reject) => {
        c.insertOne(obj, (err) => {
          if (err) {
            reject(err)
          }
          resolve()
        })
      }))
    })

    Promise.all(promises).then(() => {
      test(db, (testWorkers) => {
        env.clearDB((err) => {
          t.error(err)
          Object.keys(testWorkers).forEach((key) => {
            testWorkers[key].kill('SIGINT')
          })
          t.end()
        })
      })
    }).catch((err) => {
      t.error(err)
    })
  })
}

tap.test('should create a size one queue and start one worker to read off the queue', (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 1)
  config.setConf('matchingQueue:pollingInterval', 10)
  const queueSize = 1

  matchingQueueTest(queueSize, t, (db, done) => {
    const testWorker = cp.fork(`${__dirname}/../lib/matching-queue/worker.js`, ['testWorker'])
    const messages = []
    testWorker.on('message', (msg) => {
      messages.push(msg)
      if (messages.length === queueSize + 2) {
        messages.forEach((m, i) => {
          t.error(m.error)

          if (i === 0) {
            return t.equal(m, 'testWorker started')
          }

          if (i === messages.length - 1) {
            return t.equal(m.debug, 'testWorker No records in queue')
          }

          t.equal(m.info.substring(0, m.info.length - 24), 'testWorker Successfully processed queue element with id: ')
        })
        done({ testWorker })
      }
    })

    testWorker.on('error', (err) => {
      t.error(err)
    })
  })
})

tap.test('should create a size 10 queue and start 5 workers to read off the queue', (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 5)
  config.setConf('matchingQueue:pollingInterval', 10)
  const queueSize = 10
  const amountOfWorkers = config.getConf('matchingQueue:numberOfWorkers')

  matchingQueueTest(queueSize, t, (db, done) => {
    const startWorker = (testWorkers, workerName) => {
      return new Promise((resolve, reject) => {
        testWorkers[workerName] = cp.fork(`${__dirname}/../lib/matching-queue/worker.js`, [workerName])

        const messages = []
        testWorkers[workerName].on('message', (msg) => {
          messages.push(msg)

          if (messages.length === queueSize / amountOfWorkers + 2) {
            messages.forEach((m, i) => {
              t.error(m.error)

              if (i === 0) {
                return t.equal(m, `${workerName} started`)
              }

              if (i === messages.length - 1) {
                return t.equal(m.debug, `${workerName} No records in queue`)
              }

              t.equal(m.info.substring(0, m.info.length - 24), `${workerName} Successfully processed queue element with id: `)
            })
            resolve()
          }
        })

        testWorkers[workerName].on('error', (err) => {
          t.error(err)
        })
      })
    }

    const testWorkers = {}
    const promises = []
    for (let i = 1; i <= amountOfWorkers; i++) {
      promises.push(startWorker(testWorkers, `testWorker ${i}`))
    }

    Promise.all(promises).then(() => {
      testQueue.total((err, tot) => {
        t.error(err)

        t.equal(tot, 10)
        testQueue.size((err, size) => {
          t.error(err)

          t.equal(size, 0)
          done(testWorkers)
        })
      })
    }).catch((err) => {
      t.error(err)
    })
  })
})
