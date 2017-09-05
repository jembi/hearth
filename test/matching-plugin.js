 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')

const matchingPlugin = require('../lib/plugins/matching')()
const matchingConfig = require('../config/matching.json')

const testResourceTemplate = {
  'resourceType': 'Patient',
  'id': '1',
  'active': true,
  'identifier': [
    {
      'use': 'official',
      'system': 'pshr:passport:za',
      'value': '1001113333933',
      'assigner': {
        'display': 'Passport South Africa'
      }
    }
  ],
  'name': [
    {
      'use': 'official',
      'prefix': [
        'Mr'
      ],
      'family': [
        'Matinyana'
      ],
      'given': [
        'Charlton',
        'Joseph'
      ]
    }
  ],
  'gender': 'male',
  'birthDate': '1970-07-21'
}

tap.test('Matching Plugin', { autoend: true }, (t) => {
  t.test('should produce representation for exact-match-representation algorithms on create interaction', (t) => {
    // given
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))

    const oldGivenAlgorithm = matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm
    matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm = 'double-metaphone'
    const oldFamilyAlgorithm = matchingConfig.resourceConfig['Patient'].matchingProperties['name.family'].algorithm
    matchingConfig.resourceConfig['Patient'].matchingProperties['name.family'].algorithm = 'double-metaphone'

    // when
    matchingPlugin.hooks.before[0].function('create', {}, 'Patient', resource, (err, badRequest) => {
      // then
      t.error(err)
      t.notOk(badRequest, 'should not return badRequest')

      t.same(resource._transforms.matching.name.given, [ ['XRLT', 'XRLT'], ['JSF', 'HSF'] ])
      t.same(resource._transforms.matching.name.family, [ ['MTNN', 'MTNN'] ])

      matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm = oldGivenAlgorithm
      matchingConfig.resourceConfig['Patient'].matchingProperties['name.family'].algorithm = oldFamilyAlgorithm

      t.end()
    })
  })

  t.test('should not error if a resource doesn\'t contain some matching fields', (t) => {
    // given
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))
    delete resource.name[0].family

    const oldGivenAlgorithm = matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm
    matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm = 'double-metaphone'

    // when
    matchingPlugin.hooks.before[0].function('create', {}, 'Patient', resource, (err, badRequest) => {
      // then
      t.error(err)
      t.notOk(badRequest, 'should not return badRequest')

      t.same(resource._transforms.matching.name.given, [ ['XRLT', 'XRLT'], ['JSF', 'HSF'] ])
      t.notOk(resource._transforms.matching.name.family, 'there should be no transform for a null family name')

      matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm = oldGivenAlgorithm
      t.end()
    })
  })

  t.test('should work with primitive field values, in addition to arrays', (t) => {
    // given
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))

    matchingConfig.resourceConfig.Patient.matchingProperties.gender = {
      algorithm: 'double-metaphone',
      weight: 0.25
    }

    // when
    matchingPlugin.hooks.before[0].function('create', {}, 'Patient', resource, (err, badRequest) => {
      // then
      t.error(err)
      t.notOk(badRequest, 'should not return badRequest')

      t.same(resource._transforms.matching['gender'], [ [ 'ML', 'ML' ] ])

      delete matchingConfig.resourceConfig.Patient.matchingProperties.gender

      t.end()
    })
  })

  t.test('should return an error if an algorithm is called with invalid input', (t) => {
    // given
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))
    resource.gender = 1

    matchingConfig.resourceConfig.Patient.matchingProperties.gender = {
      algorithm: 'double-metaphone',
      weight: 0.25
    }

    // when
    matchingPlugin.hooks.before[0].function('create', {}, 'Patient', resource, (err, badRequest) => {
      // then
      t.ok(err)
      t.equals(err.message, 'talisman/phonetics/doubleMetaphone: the given word is not a string.')

      delete matchingConfig.resourceConfig.Patient.matchingProperties.gender

      t.end()
    })
  })
})
