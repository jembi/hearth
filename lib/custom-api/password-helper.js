 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const crypto = require('crypto')
const uuid = require('uuid/v4')

function generatePasswordHash (password, salt) {
  const hash = crypto.createHash('sha512')
  hash.update(salt)
  hash.update(password)
  return hash.digest('hex')
}

function generateSaltedHash (password) {
  const salt = uuid()
  return {
    hash: generatePasswordHash(password, salt),
    salt
  }
}

exports.generatePasswordHash = generatePasswordHash
exports.generateSaltedHash = generateSaltedHash
