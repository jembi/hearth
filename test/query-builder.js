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

const executeQueryBuilderTest = (t, functionNameToExecute, resourceType, queryParam, expectedResponse, value, desc) => {
  t.test(desc, (t) => {
    const searchParamsResource = searchParamsMap[resourceType]

    const paramPath = searchParamsResource[queryParam].path
    const propertyDefObj = queryBuilder.private.walkPropertyDef(paramPath, resourceType)
    const modifier = constants.NO_MODIFER
    const dateClause = queryBuilder.private[functionNameToExecute](paramPath, propertyDefObj.types[0], propertyDefObj, modifier, value)

    t.ok(dateClause)
    t.deepEqual(dateClause, expectedResponse, 'Should have the correct mongo clause')
    t.end()
  })
}

tap.test('.buildQueryForNumber should return a error (Not yet supported)', (t) => {
  const path = ''
  const propertyTypeObj = {}
  const propertyDefObj = { min: 0, max: '*' }
  const modifier = constants.NO_MODIFER
  const value = ''

  t.throws(() => {
    queryBuilder.private.buildQueryForNumber(path, propertyTypeObj, propertyDefObj, modifier, value)
  }, new RegExp('Unsupported parameter type - number'), 'Should throw and error')

  t.end()
})

tap.test('.buildQueryForQuantity should return a error (Not yet supported)', (t) => {
  const path = ''
  const propertyTypeObj = {}
  const propertyDefObj = { min: 0, max: '*' }
  const modifier = constants.NO_MODIFER
  const value = ''

  t.throws(() => {
    queryBuilder.private.buildQueryForQuantity(path, propertyTypeObj, propertyDefObj, modifier, value)
  }, new RegExp('Unsupported parameter type - quantity'), 'Should throw and error')

  t.end()
})

tap.test('.buildQueryForURI should return a error (unsupported modifer)', (t) => {
  const path = ''
  const propertyTypeObj = {}
  const propertyDefObj = { min: 0, max: '*' }
  const modifier = 'exact'
  const value = ''

  t.throws(() => {
    queryBuilder.private.buildQueryForURI(path, propertyTypeObj, propertyDefObj, modifier, value)
  }, new RegExp('Unsupported modifier for parameter type uri'), 'Should throw and error')

  t.end()
})

tap.test('.buildQueryForURI should return a valid uri clause', (t) => {
  const path = 'url'
  const propertyTypeObj = {}
  const propertyDefObj = { min: 0, max: '*' }
  const modifier = constants.NO_MODIFER
  const value = 'http://someurlvalue.org'

  const clauseUri = queryBuilder.private.buildQueryForURI(path, propertyTypeObj, propertyDefObj, modifier, value)
  const expected = { url: 'http://someurlvalue.org' }
  t.deepEqual(clauseUri, expected, 'when modifier is excepted')

  t.end()
})

tap.test('.buildQueryForDate should return a valid date clause', { autoend: true }, (t) => {
  let queryParam, expected, value, desc
  queryParam = 'birthdate'

  value = '2010-01-01'
  expected = { birthDate: { '$regex': '^2010-01-01' } }
  desc = 'when date is supplied'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = 'eq2010-01-01'
  expected = { birthDate: { '$regex': '^2010-01-01' } }
  desc = 'when date should equal to'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = 'ne2010-01-01'
  expected = { birthDate: { '$ne': '2010-01-01' } }
  desc = 'when date should not equal to'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = 'le2010-01-01'
  expected = { birthDate: { '$lte': '2010-01-01' } }
  desc = 'when date needs to be less than or equal to'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = '2010-01'
  expected = { birthDate: { '$regex': '^2010-01' } }
  desc = 'when partial date (YYYY-MM) is supplied'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = 'gt2010-01-01'
  expected = { birthDate: { '$gt': '2010-01-01' } }
  desc = 'when date needs to be greater than'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = 'ge2010-01-01'
  expected = { birthDate: { '$gte': '2010-01-01' } }
  desc = 'when date needs to be greater than or equal to'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)

  value = 'lt2010-01-01'
  expected = { birthDate: { '$lt': '2010-01-01' } }
  desc = 'when date needs to be less than'
  executeQueryBuilderTest(t, 'buildQueryForDate', 'Patient', queryParam, expected, value, desc)
})

tap.test('.buildQueryForString should return a valid string clause', { autoend: true }, (t) => {
  let queryParam, expected, value, desc

  queryParam = 'family'
  value = 'Jane'
  expected = { 'name.family': { '$options': 'i', '$regex': '^Jane' } }
  desc = 'when string is supplied'
  executeQueryBuilderTest(t, 'buildQueryForString', 'Patient', queryParam, expected, value, desc)

  queryParam = 'address-country'
  value = 'South Africa'
  expected = { 'address.country': { '$options': 'i', '$regex': '^South Africa' } }
  desc = 'when string is supplied'
  executeQueryBuilderTest(t, 'buildQueryForString', 'Patient', queryParam, expected, value, desc)

  queryParam = 'address'
  value = 'SomeAddressValue'
  expected = { '$or': [
    { 'address': { '$elemMatch': { 'line': { '$options': 'i', '$regex': '^SomeAddressValue' } } } },
    { 'address': { '$elemMatch': { 'city': { '$options': 'i', '$regex': '^SomeAddressValue' } } } },
    { 'address': { '$elemMatch': { 'state': { '$options': 'i', '$regex': '^SomeAddressValue' } } } },
    { 'address': { '$elemMatch': { 'country': { '$options': 'i', '$regex': '^SomeAddressValue' } } } },
    { 'address': { '$elemMatch': { 'postalCode': { '$options': 'i', '$regex': '^SomeAddressValue' } } } },
    { 'address': { '$elemMatch': { 'text': { '$options': 'i', '$regex': '^SomeAddressValue' } } } }
  ] }
  desc = 'when address query string is supplied'
  executeQueryBuilderTest(t, 'buildQueryForString', 'Patient', queryParam, expected, value, desc)
})

tap.test('.buildQueryForToken should return a valid token clause', { autoend: true }, (t) => {
  let queryParam, expected, value, desc

  queryParam = 'gender'
  value = 'male'
  expected = { 'gender': 'male' }
  desc = 'when token of type "id/code/string" is supplied'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value, desc)

  queryParam = 'active'
  value = 'true'
  expected = { 'active': true }
  desc = 'when token of type "boolean" is supplied'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value, desc)

  queryParam = 'identifier'
  value = 'some:domain|some-value'
  expected = { 'identifier': { '$elemMatch': { 'system': 'some:domain', 'value': 'some-value' } } }
  desc = 'when token of type "Identifier/ContactPoint" is supplied'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value, desc)

  queryParam = 'identifier'
  value = 'some-value'
  expected = { 'identifier': { '$elemMatch': { 'value': 'some-value' } } }
  desc = 'when token of type "Identifier/ContactPoint" is supplied - no domain'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Patient', queryParam, expected, value, desc)

  queryParam = 'communication'
  value = 'some-system|some-code'
  expected = { 'communication.coding': { '$elemMatch': { 'system': 'some-system', 'code': 'some-code' } } }
  desc = 'when token of type "CodeableConcept" is supplied'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Practitioner', queryParam, expected, value, desc)

  if (FHIR_VERSION === 'dstu2') {
    queryParam = 'type'
    value = 'some-system|some-code'
    expected = { 'event.type': { '$elemMatch': { 'system': 'some-system', 'code': 'some-code' } } }
    desc = 'when token of type "Coding" is supplied'
    executeQueryBuilderTest(t, 'buildQueryForToken', 'AuditEvent', queryParam, expected, value, desc)
  }

  if (FHIR_VERSION === 'stu3') {
    queryParam = 'type'
    value = 'some-system|some-code'
    expected = { 'type': { '$elemMatch': { 'system': 'some-system', 'code': 'some-code' } } }
    desc = 'when token of type "Coding" is supplied'
    executeQueryBuilderTest(t, 'buildQueryForToken', 'AuditEvent', queryParam, expected, value, desc)
  }
})

tap.test('.buildQueryForReference should return a valid token clause', { autoend: true }, (t) => {
  let queryParam, expected, value, desc

  queryParam = 'episodeofcare'
  value = '1234567890'
  expected = { 'episodeOfCare.reference': 'EpisodeOfCare/1234567890' }
  desc = 'when reference supplied with only an ID reference'
  executeQueryBuilderTest(t, 'buildQueryForReference', 'Encounter', queryParam, expected, value, desc)

  queryParam = 'episodeofcare'
  value = 'EpisodeOfCare/1234567890'
  expected = { 'episodeOfCare.reference': 'EpisodeOfCare/1234567890' }
  desc = 'when reference supplied with full reference'
  executeQueryBuilderTest(t, 'buildQueryForReference', 'Encounter', queryParam, expected, value, desc)

  queryParam = 'episodeofcare'
  value = [ 'EpisodeOfCare/1234567890', 'EpisodeOfCare/0987654321' ]
  expected = { '$and': [
    { 'episodeOfCare.reference': 'EpisodeOfCare/1234567890' },
    { 'episodeOfCare.reference': 'EpisodeOfCare/0987654321' }
  ] }
  desc = 'when reference supplied with full reference - Array'
  executeQueryBuilderTest(t, 'buildQueryForReference', 'Encounter', queryParam, expected, value, desc)
})

tap.test('Conditional Paths should return a valid token clause', { autoend: true }, (t) => {
  let queryParam, expected, value, desc

  queryParam = 'email'
  value = 'mailaddress@hearth.org'
  expected = {
    "telecom": {
      "$elemMatch": {
        "value": "mailaddress@hearth.org",
        "system": "email"
      }
    }
  }
  desc = 'when search parameter path is conditional - email'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Practitioner', queryParam, expected, value, desc)

  queryParam = 'phone'
  value = '0210000000'
  expected = {
    "telecom": {
      "$elemMatch": {
        "value": "0210000000",
        "system": "phone"
      }
    }
  }
  desc = 'when search parameter path is conditional - phone'
  executeQueryBuilderTest(t, 'buildQueryForToken', 'Practitioner', queryParam, expected, value, desc)

  if (FHIR_VERSION === 'stu3') {
    queryParam = 'composed-of'
    value = '0210000000'
    expected = {
      "relatedArtifact.resource": {
        "$elemMatch": {
          "value": "0210000000",
          "type": "composed-of"
        }
      }
    }
    desc = 'when search parameter path is conditional - composed-of'
    executeQueryBuilderTest(t, 'buildQueryForToken', 'ActivityDefinition', queryParam, expected, value, desc)
  }
})
