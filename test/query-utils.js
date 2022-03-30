/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')

require('./test-env/init')()
const config = require('../lib/config')
const queryUtils = require('../lib/fhir/query-utils')()

const FHIR_VERSION = config.getConf('server:fhirVersion')
const structDefMap = require(`../lib/fhir/definitions/${FHIR_VERSION}/structure-definition-map.json`)

tap.test('.tokenToSystemValue should match token to system and value according to FHIR spec', (t) => {
  const propertyDefObj = structDefMap.Patient.elements.identifier
  let token = 'test:assigning:auth|123456'
  let split = token.split('|')
  let expected = { identifier: { $elemMatch: { system: split[0], value: split[1] } } }
  let actual = queryUtils.tokenToSystemValue('identifier', token, propertyDefObj)
  t.deepEqual(actual, expected, 'Single system|value token')

  token = ['test:assigning:auth|123456', 'another:assigning:auth|111111']
  split = []
  token.forEach((t) => {
    split = split.concat(t.split('|'))
  })
  expected = {
    $and: [
      { identifier: { $elemMatch: { system: split[0], value: split[1] } } },
      { identifier: { $elemMatch: { system: split[2], value: split[3] } } }
    ]
  }
  actual = queryUtils.tokenToSystemValue('identifier', token, propertyDefObj)
  t.deepEqual(actual, expected, 'Multiple system|value tokens')

  token = '123456'
  expected = { identifier: { $elemMatch: { value: token } } }
  actual = queryUtils.tokenToSystemValue('identifier', token, propertyDefObj)
  t.deepEqual(actual, expected, 'Single value without system token')

  token = ['123456', '111111']
  expected = {
    $and: [
      { identifier: { $elemMatch: { value: token[0] } } },
      { identifier: { $elemMatch: { value: token[1] } } }
    ]
  }
  actual = queryUtils.tokenToSystemValue('identifier', token, propertyDefObj)
  t.deepEqual(actual, expected, 'Multiple value without system tokens')

  token = '|123456'
  split = token.split('|')
  expected = { identifier: { $elemMatch: { system: { $exists: false }, value: split[1] } } }
  actual = queryUtils.tokenToSystemValue('identifier', token, propertyDefObj)
  t.deepEqual(actual, expected, 'Single value with non existent system token')

  t.end()
})

tap.test('.removeIdentifiersFromTokens should remove identifier part of token query parameter', (t) => {
  let token = 'test:assigning:auth|123456'
  let expected = 'test:assigning:auth|'
  let actual = queryUtils.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  token = 'domain1|,domain2|'
  expected = 'domain1|,domain2|'
  actual = queryUtils.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  token = ['domain1|,domain2|', 'test1|1111']
  expected = ['domain1|,domain2|', 'test1|']
  actual = queryUtils.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  token = ['11111', 'test1|1111', 'test2|2222']
  expected = ['test1|', 'test2|']
  actual = queryUtils.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  t.end()
})

tap.test('.boolToMongoClause should match a Boolean value according to FHIR spec', (t) => {
  let expected = { active: true }
  let actual = queryUtils.boolToMongoClause('active', 'true')
  t.deepEqual(actual, expected, 'should equal expected mongo clause')

  expected = { active: false }
  actual = queryUtils.boolToMongoClause('active', 'false')
  t.deepEqual(actual, expected, 'should equal expected mongo clause')

  expected = { active: false }
  actual = queryUtils.boolToMongoClause('active', 'something-random')
  t.deepEqual(actual, expected, 'should equal expected mongo clause, invalid parameter defaults to false')

  t.end()
})
