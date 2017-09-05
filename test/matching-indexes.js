 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

process.env.NODE_ENV = 'test'
require('../lib/init')

const tap = require('tap')
const async = require('neo-async')

const mongo = require('../lib/mongo')()
const matchingIndexes = require('../scripts/matching-indexes')(mongo)
const resourceConfig = require('../config/matching').resourceConfig

const matchingIndexesTest = (t, test) => {
  mongo.getDB((err, db) => {
    t.error(err)

    matchingIndexes.createMatchingIndexes((err) => {
      t.error(err)

      test(db, () => {
        db.dropDatabase((err) => {
          t.error(err)

          mongo.closeDB(() => {
            t.error(err)
            t.end()
          })
        })
      })
    })
  })
}

tap.test('should ensure indexes are created', (t) => {
  matchingIndexesTest(t, (db, done) => {
    const tasks = []
    Object.keys(resourceConfig).forEach((collection) => {
      const c = db.collection(collection)

      Object.keys(resourceConfig[collection].matchingProperties).forEach((path) => {
        tasks.push((callback) => c.indexExists(`${path}_1`, callback))
        tasks.push((callback) => c.indexExists(`_transforms.matching.${path}_1`, callback))
      })
    })

    async.parallel(tasks, (err, results) => {
      t.error(err)

      results.forEach((result) => {
        t.true(result)
      })
      done()
    })
  })
})
