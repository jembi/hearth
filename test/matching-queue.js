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

const tap = require('tap')

const env = require('./test-env/init')()
const server = require('../lib/server')
const config = require('../lib/config')

let createWorkersTest = (t, test) => {
  env.initDB((err, db) => {
    t.error(err)

    server.start((err) => {
      t.error(err)

      test(db, () => {
        env.clearDB((err) => {
          t.error(err)
          server.stop(() => {
            t.end()
          })
        })
      })
    })
  })
}

tap.test('should start a configurable amount of workers to read off the queue', (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 5)
  createWorkersTest(t, (db, done) => {
    t.equal(Object.keys(server.workers).length, 5)
    done()
  })
})

tap.test('should be able to shutdown workers', (t) => {
  config.setConf('matchingQueue:numberOfWorkers', 5)
  createWorkersTest(t, (db, done) => {
    server.workers[Object.keys(server.workers)[0]].kill('SIGINT')
    t.equal(server.workers[Object.keys(server.workers)[0]].killed, true)
    t.equal(server.workers[Object.keys(server.workers)[1]].killed, false)
    t.equal(server.workers[Object.keys(server.workers)[2]].killed, false)
    t.equal(server.workers[Object.keys(server.workers)[3]].killed, false)
    t.equal(server.workers[Object.keys(server.workers)[4]].killed, false)
    t.equal(Object.keys(server.workers).length, 5)
    done()
  })
})
