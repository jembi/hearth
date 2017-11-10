 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const mongoDbQueue = require('mongodb-queue')
const tap = require('tap')
const cp = require('child_process')
const doubleMetaphone = require('talisman/phonetics/double-metaphone')

const env = require('./test-env/init')()
const config = require('../lib/config')
const constants = require('../lib/constants')

const patientResource = require('./resources/Patient-1.json')
patientResource._transforms = {
  matching: {
    name: [
      {
        given: [],
        family: []
      }
    ]
  }
}

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

tap.test('should successfully update score of patient links', { skip: true }, (t) => {
  const testPatient1 = JSON.parse(JSON.stringify(patientResource))
  testPatient1.id = '1111111111'
  testPatient1._transforms.matching.name[0].given[0] = doubleMetaphone(testPatient1.name[0].given[0])
  testPatient1._transforms.matching.name[0].family[0] = doubleMetaphone(testPatient1.name[0].family[0])
  testPatient1.link = [
    {
      other: {
        reference: 'Patient/2222222222'
      },
      type: 'possible-duplicate-source',
      extension: [{
        url: 'http://hearth.org/link-matching-score',
        valueDecimal: 0.67
      }]
    }
  ]

  const testPatient2 = JSON.parse(JSON.stringify(patientResource))
  testPatient2.id = '2222222222'
  testPatient2._transforms.matching.name[0].given[0] = doubleMetaphone(testPatient2.name[0].given[0])
  testPatient2._transforms.matching.name[0].family[0] = doubleMetaphone(testPatient2.name[0].family[0])
  testPatient2.link = [
    {
      other: {
        reference: 'Patient/11111111111'
      },
      type: 'possible-duplicate-of',
      extension: [{
        url: 'http://hearth.org/link-matching-score',
        valueDecimal: 0.77
      }]
    }
  ]

  env.initDB((err, db) => {
    t.error(err)

    const c = db.collection('Patient')
    c.insertMany([testPatient1, testPatient2], (err) => {
      t.error(err)

      c.find().toArray((err, result) => {
        t.error(err)

        t.equal(result[0].id, '1111111111', 'Patient1 successfully created')
        t.equal(result[0].link[0].extension[0].valueDecimal, 0.67)
        t.equal(result[1].id, '2222222222', 'Patient2 successfully created')
        t.equal(result[1].link[0].extension[0].valueDecimal, 0.77)
        const matchingQueue = mongoDbQueue(db, constants.MATCHING_QUEUE_COLLECTION)
        matchingQueue.add(testPatient2, (err) => {
          t.error(err)

          const testWorker = cp.fork(`${__dirname}/../lib/matching-queue/worker.js`, ['testWorker'])
          const messages = []
          testWorker.on('message', (msg) => {
            t.error(msg.error)

            messages.push(msg)
            if (messages.length === 3) {
              t.equal(messages[0], 'testWorker started')
              t.equal(messages[1].info.substring(0, messages[1].info.length - 24), 'testWorker Successfully processed queue element with id: ', { skip: true })
              t.equal(messages[2].debug, 'testWorker No records in queue')

              c.find().toArray((err, results) => {
                t.error(err)

                t.equal(results.length, 2, 'should be two patients')
                t.equal(results[0].id, '1111111111')
                t.equal(results[0].link[0].extension[0].valueDecimal, 1)
                t.equal(results[1].id, '2222222222')
                t.equal(results[1].link[0].extension[0].valueDecimal, 1)
                env.clearDB((err) => {
                  t.error(err)
                  testWorker.kill()
                  t.end()
                })
              })
            }
          })
        })
      })
    })
  })
})

tap.test('should create a size one queue and start one worker to read off the queue', { skip: true }, (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 1)
  config.setConf('matchingQueue:pollingInterval', 10000)
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

tap.test('should create a size 10 queue and start 5 workers to read off the queue', { skip: true }, (t) => {
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

              if (m.debug) {
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
