/**
* Copyright (c) 2017-present, Jembi Health Systems NPC.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict'

require('../lib/init')
const tap = require('tap')

const config = require('../lib/config')

const validator = require('../lib/plugins/validator.js')()
const profileLoader = require('../lib/fhir/profile-loader')()
profileLoader.loadProfiles(['lib/fhir/profiles/mhd'])

tap.test('FHIR validator', { autoend: true }, (t) => {
  t.test('should called next with no errors on a valid resource', (t) => {
    config.setConf('validation:enabled', true)
    validator.hooks.before[0].function('create', {}, 'Patient', require('./resources/Patient-1.json'), (err, outcome) => {
      t.error(err)
      t.notOk(outcome)

      config.setConf('validation:enabled', false)
      t.end()
    })
  })

  t.test('should called next with no errors on a valid resource with a loaded profile', (t) => {
    config.setConf('validation:enabled', true)
    validator.hooks.before[0].function('create', {}, 'DocumentManifest', require('./resources/DocumentManifest-mhd.json'), (err, outcome) => {
      t.error(err)
      t.notOk(outcome)

      config.setConf('validation:enabled', false)
      t.end()
    })
  })

  t.test('should callback with an operation outcome on validation errors', (t) => {
    config.setConf('validation:enabled', true)
    validator.hooks.before[0].function('create', {}, 'DocumentManifest', require('./resources/DocumentManifest-1.json'), (err, outcome) => {
      t.error(err)
      t.ok(outcome)
      t.equals(outcome.httpStatus, 400)
      t.equals(outcome.resource.resourceType, 'OperationOutcome')
      t.equals(outcome.resource.issue[0].severity, 'error')
      t.equals(outcome.resource.issue[0].code, 'invalid')
      t.equals(outcome.resource.issue[0].details.text, 'Element DocumentManifest.related does not meet the maximum cardinality of 0 (actual: 1)')

      config.setConf('validation:enabled', false)
      t.end()
    })
  })
})
