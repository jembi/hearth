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
const constants = require('../lib/constants')
const queryBuilder = require('../lib/fhir/query-builder')()

const FHIR_VERSION = config.getConf('server:fhirVersion')
const searchParamsMap = require(`../lib/fhir/definitions/${FHIR_VERSION}/search-parameters-map.json`)

const executeQueryBuilderTest = (t, functionNameToExecute, resourceType, queryParam, expectedResponse, value, modifier) => {
  const searchParamsResource = searchParamsMap[resourceType]
  const paramPath = searchParamsResource[queryParam].path
  const propertyDefObj = queryBuilder.private.walkPropertyDef(paramPath, resourceType)
  modifier = modifier || constants.NO_MODIFER

  const dateClause = queryBuilder.private[functionNameToExecute](paramPath, propertyDefObj.types[0], propertyDefObj, modifier, value)

  t.ok(dateClause)
  t.deepEqual(dateClause, expectedResponse, 'Should have the correct mongo clause')
  t.end()
}

const executeQueryBuilderTestThrowsError = (t, functionNameToExecute, resourceType, queryParam, expectedResponse, value, modifier) => {
  const searchParamsResource = searchParamsMap[resourceType]
  const paramPath = searchParamsResource[queryParam].path
  const propertyDefObj = queryBuilder.private.walkPropertyDef(paramPath, resourceType)
  modifier = modifier || constants.NO_MODIFER

  t.throws(() => {
    queryBuilder.private[functionNameToExecute](paramPath, propertyDefObj.types[0], propertyDefObj, modifier, value)
  }, new RegExp(expectedResponse), 'Should throw an error')

  t.end()
}

tap.test('.buildQueryForNumber(): ', { autoend: true }, (t) => {
  let queryParam, expected, value

  t.test('should return a error (Not yet supported)', (t) => {
    queryParam = 'length'
    value = 10
    expected = 'Unsupported parameter type - number'
    executeQueryBuilderTestThrowsError(t, 'buildQueryForNumber', 'Encounter', queryParam, expected, value)
  })
})

tap.test('.buildQueryForQuantity should return a error (Not yet supported)', { autoend: true }, (t) => {
  let queryParam, expected, value

  t.test('should return a error (unsupported modifer)', (t) => {
    queryParam = 'balance'
    value = 10
    expected = 'Unsupported parameter type - quantity'
    executeQueryBuilderTestThrowsError(t, 'buildQueryForQuantity', 'Account', queryParam, expected, value)
  })
})

tap.test('.buildQueryForURI(): ', { autoend: true }, (t) => {
  let queryParam, expected, value, modifier

  t.test('should return a error (unsupported modifer)', (t) => {
    queryParam = 'url'
    modifier = 'exact'
    value = 'http://someurlvalue.org'
    expected = 'Unsupported modifier for parameter type uri'
    executeQueryBuilderTestThrowsError(t, 'buildQueryForURI', 'ValueSet', queryParam, expected, value, modifier)
  })

  t.test('should return a valid uri clause when url is supplied', (t) => {
    queryParam = 'url'
    modifier = null
    value = 'http://someurlvalue.org'
    expected = { url: 'http://someurlvalue.org' }
    executeQueryBuilderTest(t, 'buildQueryForURI', 'ValueSet', queryParam, expected, value)
  })
})

tap.test('.buildQueryForDate(): ', { autoend: true }, (t) => {
  let expected, value
  const queryParam = 'birthdate'

  t.test('should return a valid date clause when date is supplied', (t) => {
    value = '2010-01-01'
    expected = { birthDate: { $regex: '^2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when date should equal to', (t) => {
    value = 'eq2010-01-01'
    expected = { birthDate: { $regex: '^2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when date should not equal to', (t) => {
    value = 'ne2010-01-01'
    expected = { birthDate: { $ne: '2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when date needs to be less than or equal to', (t) => {
    value = 'le2010-01-01'
    expected = { birthDate: { $lte: '2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when partial date (YYYY-MM) is supplied', (t) => {
    value = '2010-01'
    expected = { birthDate: { $regex: '^2010-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when date needs to be greater than', (t) => {
    value = 'gt2010-01-01'
    expected = { birthDate: { $gt: '2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when date needs to be greater than or equal to', (t) => {
    value = 'ge2010-01-01'
    expected = { birthDate: { $gte: '2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid date clause when date needs to be less than', (t) => {
    value = 'lt2010-01-01'
    expected = { birthDate: { $lt: '2010-01-01' } }
    executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value)
  })
})

tap.test('.buildQueryForString(): ', { autoend: true }, (t) => {
  let queryParam, expected, value

  t.test('should return a valid string clause when string is supplied', (t) => {
    queryParam = 'family'
    value = 'Jane'
    expected = { 'name.family': { $options: 'i', $regex: '^Jane' } }
    executeQueryBuilderTest(t, 'buildQueryForString', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid string clause when string is supplied', (t) => {
    queryParam = 'address-country'
    value = 'South Africa'
    expected = { 'address.country': { $options: 'i', $regex: '^South Africa' } }
    executeQueryBuilderTest(t, 'buildQueryForString', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid string clause when address query string is supplied', (t) => {
    queryParam = 'address'
    value = 'SomeAddressValue'
    expected = {
      $or: [
        { address: { $elemMatch: { line: { $options: 'i', $regex: '^SomeAddressValue' } } } },
        { address: { $elemMatch: { city: { $options: 'i', $regex: '^SomeAddressValue' } } } },
        { address: { $elemMatch: { state: { $options: 'i', $regex: '^SomeAddressValue' } } } },
        { address: { $elemMatch: { country: { $options: 'i', $regex: '^SomeAddressValue' } } } },
        { address: { $elemMatch: { postalCode: { $options: 'i', $regex: '^SomeAddressValue' } } } },
        { address: { $elemMatch: { text: { $options: 'i', $regex: '^SomeAddressValue' } } } }
      ]
    }
    executeQueryBuilderTest(t, 'buildQueryForString', 'Patient', queryParam, expected, value)
  })
})

tap.test('.buildQueryForToken(): ', { autoend: true }, (t) => {
  let queryParam, expected, value

  t.test('should return a valid token clause when token of type "id/code/string" is supplied', (t) => {
    queryParam = 'gender'
    value = 'male'
    expected = { gender: 'male' }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid token clause when token of type "boolean" is supplied', (t) => {
    queryParam = 'active'
    value = 'true'
    expected = { active: true }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid token clause when token of type "Identifier/ContactPoint" is supplied', (t) => {
    queryParam = 'identifier'
    value = 'some:domain|some-value'
    expected = { identifier: { $elemMatch: { system: 'some:domain', value: 'some-value' } } }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid token clause when token of type "Identifier/ContactPoint" is supplied - no domain', (t) => {
    queryParam = 'identifier'
    value = 'some-value'
    expected = { identifier: { $elemMatch: { value: 'some-value' } } }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value)
  })

  t.test('should return a valid token clause when token of type "CodeableConcept" is supplied', (t) => {
    queryParam = 'communication'
    value = 'some-system|some-code'
    expected = { 'communication.coding': { $elemMatch: { system: 'some-system', code: 'some-code' } } }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Practitioner', queryParam, expected, value)
  })

  if (FHIR_VERSION === 'dstu2') {
    t.test('should return a valid token clause when token of type "Coding" is supplied', (t) => {
      queryParam = 'type'
      value = 'some-system|some-code'
      expected = { 'event.type': { $elemMatch: { system: 'some-system', code: 'some-code' } } }
      executeQueryBuilderTest(t, 'buildQueryForToken', 'AuditEvent', queryParam, expected, value)
    })
  }

  if (FHIR_VERSION === 'stu3') {
    t.test('should return a valid token clause when token of type "Coding" is supplied', (t) => {
      queryParam = 'type'
      value = 'some-system|some-code'
      expected = { type: { $elemMatch: { system: 'some-system', code: 'some-code' } } }
      executeQueryBuilderTest(t, 'buildQueryForToken', 'AuditEvent', queryParam, expected, value)
    })
  }
})

tap.test('.buildQueryForReference(): ', { autoend: true }, (t) => {
  let queryParam, expected, value

  t.test('should return a valid token clause when reference supplied with only an ID reference', (t) => {
    queryParam = 'episodeofcare'
    value = '1234567890'
    expected = { 'episodeOfCare.reference': 'EpisodeOfCare/1234567890' }
    executeQueryBuilderTest(t, 'buildQueryForReference', 'Encounter', queryParam, expected, value)
  })

  t.test('should return a valid token clause when reference supplied with full reference', (t) => {
    queryParam = 'episodeofcare'
    value = 'EpisodeOfCare/1234567890'
    expected = { 'episodeOfCare.reference': 'EpisodeOfCare/1234567890' }
    executeQueryBuilderTest(t, 'buildQueryForReference', 'Encounter', queryParam, expected, value)
  })

  t.test('should return a valid token clause when reference supplied with full reference - Array', (t) => {
    queryParam = 'episodeofcare'
    value = ['EpisodeOfCare/1234567890', 'EpisodeOfCare/0987654321']
    expected = {
      $and: [
        { 'episodeOfCare.reference': 'EpisodeOfCare/1234567890' },
        { 'episodeOfCare.reference': 'EpisodeOfCare/0987654321' }
      ]
    }
    executeQueryBuilderTest(t, 'buildQueryForReference', 'Encounter', queryParam, expected, value)
  })
})

tap.test('Conditional Paths: ', { autoend: true }, (t) => {
  let queryParam, expected, value

  t.test('should return a valid token clause when search parameter path is conditional - email', (t) => {
    queryParam = 'email'
    value = 'mailaddress@hearth.org'
    expected = {
      telecom: {
        $elemMatch: {
          value: 'mailaddress@hearth.org',
          system: 'email'
        }
      }
    }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Practitioner', queryParam, expected, value)
  })

  t.test('should return a valid token clause when search parameter path is conditional - phone', (t) => {
    queryParam = 'phone'
    value = '0210000000'
    expected = {
      telecom: {
        $elemMatch: {
          value: '0210000000',
          system: 'phone'
        }
      }
    }
    executeQueryBuilderTest(t, 'buildQueryForToken', 'Practitioner', queryParam, expected, value)
  })

  if (FHIR_VERSION === 'stu3') {
    t.test('should return a valid token clause when search parameter path is conditional - composed-of', (t) => {
      queryParam = 'composed-of'
      value = '0210000000'
      expected = {
        'relatedArtifact.resource': {
          $elemMatch: {
            value: '0210000000',
            type: 'composed-of'
          }
        }
      }
      executeQueryBuilderTest(t, 'buildQueryForToken', 'ActivityDefinition', queryParam, expected, value)
    })
  }
})
