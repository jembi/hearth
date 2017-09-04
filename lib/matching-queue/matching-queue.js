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
