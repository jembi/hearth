/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
