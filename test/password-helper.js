 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const crypto = require('crypto')
const passwordHelper = require('../lib/custom-api/password-helper')
const tap = require('tap')

tap.test('Password helper', (t) => {
  t.test('generatePasswordHash', (t) => {
    const password = 'ohseeghu7pei7iequ4Sah5eib1iz1iphah1uogie'
    const salt = '6fb45d48-6aac-4314-bced-c0b6e55d07eb'
    const expectedHash = '8c60a4526d394b0bf1fcd9bc49c43be92af2114b6c65fb09224bdb6aecc9d0ed96b96cfc0a10ba82921c75339eca6a12df0d49d2abb1f4381d0aa8ad7a7df0f5'

    const hash = passwordHelper.generatePasswordHash(password, salt)

    t.equal(hash, expectedHash, 'should generate the correct hash')
    t.end()
  })

  t.test('generateSaltedHash', (t) => {
    const password = 'aen6uShieyohcheiphaithah8Euhipung5yoorol'

    const {hash, salt} = passwordHelper.generateSaltedHash(password)

    const expectedHash = crypto.createHash('sha512').update(`${salt}${password}`).digest('hex')
    t.equal(hash, expectedHash, 'should generate the correct hash')
    t.end()
  })

  t.end()
})
