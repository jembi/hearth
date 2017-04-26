'use strict'

const tap = require('tap')

const matchingPlugin = require('../lib/plugins/matching')()
const matchingConfig = require('../config/matching.json')

tap.test('Matching Plugin', { autoend: true }, (t) => {
  t.test('should produce representation for exact-match-representation algorithms on create interaction', (t) => {
    // given
    const resource = {
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

    const oldGivenAlgorithm = matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm
    matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm = 'double-metaphone'
    const oldFamilyAlgorithm = matchingConfig.resourceConfig['Patient'].matchingProperties['name.family'].algorithm
    matchingConfig.resourceConfig['Patient'].matchingProperties['name.family'].algorithm = 'double-metaphone'

    // when
    matchingPlugin.hooks.before[0].function('create', {}, 'Patient', resource, (err, badRequest) => {
      // then
      t.error(err)
      t.notOk(badRequest, 'should not return badRequest')

      t.same(resource._transforms.matching['name.given'], [ ['XRLT', 'XRLT'], ['JSF', 'HSF'] ])
      t.same(resource._transforms.matching['name.family'], [ ['MTNN', 'MTNN'] ])

      matchingConfig.resourceConfig['Patient'].matchingProperties['name.given'].algorithm = oldGivenAlgorithm
      matchingConfig.resourceConfig['Patient'].matchingProperties['name.family'].algorithm = oldFamilyAlgorithm

      t.end()
    })
  })

  t.test('should not error if a resource doesn\'t contain some matching fields')

  t.test('should work with primitive field values, in addition to arrays')

  t.test('should return an error if an algorithm is called with invalid input')
})
