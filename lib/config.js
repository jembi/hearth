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

const path = require('path')
const stdio = require('stdio')
const nconf = require('nconf')

nconf.env({ separator: '__' })

const ops = stdio.getopt({
  conf: {
    key: 'c',
    args: 1,
    description: 'The backend configuration to use. See config/default.json for an example.'
  },
  createIndexes: {
    description: 'Boolean to create mongo indexes on server startup'
  }
})

if (ops && ops.conf) {
  nconf.file(ops.conf)
} else {
  const environment = nconf.get('NODE_ENV') || 'development'
  nconf.file('environment', path.resolve(`${global.appRoot}/config`, environment + '.json'))
  nconf.file('default', path.resolve(`${global.appRoot}/config`, 'default.json'))
}

if (ops && ops.createIndexes) {
  nconf.set('createIndexes', true)
}

function getConf (key) {
  return nconf.get(key)
}

function setConf (key, value) {
  nconf.set(key, value)
}

exports.getConf = getConf
exports.setConf = setConf
