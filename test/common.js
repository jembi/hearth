'use strict'

const tap = require('tap')

const Common = require('../lib/fhir/common')
const env = require('./test-env/init')()
const common = Common(env.mongo())

tap.test('should resolve references', (t) => {
  // given
  let testResource = {
    resourceType: 'Test',
    patient: {
      reference: 'Test/123'
    },
    list: [
      { author: { reference: 'Test/123' } },
      { author: { reference: 'Test/123' } },
      { author: 'blank' }
    ],
    nested: { patient: { reference: 'Test/123' } },
    nochange: { reference: 'Test/456' }
  }
  // when
  common.util.resolveReferences(testResource, 'Test/123', 'Test/321')
  // then
  t.ok(testResource)
  t.equals(testResource.patient.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.list[0].author.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.list[1].author.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.list[2].author, 'blank', 'should not replace random properties')
  t.equals(testResource.nested.patient.reference, 'Test/321', 'should replace matched reference')
  t.equals(testResource.nochange.reference, 'Test/456', 'should not change non matching references')
  t.end()
})

tap.test('.util.validateID should validate FHIR id types', (t) => {
  t.ok(common.util.validateID('123'), '123 -> true')
  t.ok(common.util.validateID('1.2.3'), '1.2.3 -> true')
  t.ok(common.util.validateID('bcba5f3d-7bc5-4271-b8f8-e817b5052e23'), 'UUID -> true')
  t.notOk(common.util.validateID('$$$'), '$$$ -> false')
  t.notOk(common.util.validateID('$$$a'), '$$$a -> false')
  t.notOk(common.util.validateID('$a$$'), '$a$$ -> false')
  t.notOk(common.util.validateID('a$$$'), 'a$$$ -> false')
  t.ok(common.util.validateID('a'.repeat(64)), 'len(64) -> true')
  t.notOk(common.util.validateID('a'.repeat(65)), 'len(65) -> false')

  t.end()
})

tap.test('.util.validateAndParseQueryParams should validate searchParams', (t) => {
  const common = Common(env.mongo())

  let queryParams = { test1: '1', test2: 2 }
  let supported = {
    test1: { allowArray: true, required: false, modifiers: { exact: true } },
    test2: { allowArray: false, required: false, modifiers: { exact: true } },
    test3: { }
  }

  common.util.validateAndParseQueryParams(queryParams, supported, (badRequest, queryObject) => {
    t.error(badRequest)
    const expected = {
      test1: {
        'no-modifier': '1'
      },
      test2: {
        'no-modifier': 2
      }
    }
    t.deepEqual(queryObject, expected, 'Should return queryObject if query params are supported')
  })

  queryParams = { test1: '1' }
  supported = {
    test1: { allowArray: true, required: true, modifiers: { exact: true } },
    test2: { allowArray: true, required: true, modifiers: { exact: true } },
    test3: { required: false, modifiers: { exact: true } }
  }

  common.util.validateAndParseQueryParams(queryParams, supported, (badRequest, queryObject) => {
    t.ok(badRequest)
    t.equal(badRequest, `This endpoint has the following required query parameters: ["test1","test2"]`, 'Should return error message if required params are missing')
  })

  queryParams = { 'test1:exact': '1' }
  supported = {
    test1: { modifiers: { exact: true } }
  }

  common.util.validateAndParseQueryParams(queryParams, supported, (badRequest, queryObject) => {
    t.error(badRequest)
    const expected = {
      test1: {
        exact: '1'
      }
    }
    t.deepEqual(queryObject, expected, 'Should return a queryObject when a valid modifier is supplied')
  })

  queryParams = { 'test1:fakemodifier': '1' }
  supported = {
    test1: { modifiers: { exact: true } }
  }

  common.util.validateAndParseQueryParams(queryParams, supported, (badRequest, queryObject) => {
    t.ok(badRequest)
    t.deepEqual(badRequest, 'This endpoint has the following query parameter: \'test1\' which does not allow for the \':fakemodifier\' modifier', 'Should return error message if modifier is not supported')
  })

  t.end()
})

tap.test('.util.tokenToSystemValueElemMatch should match token to system and value according to FHIR spec', (t) => {
  let token = 'test:assigning:auth|123456'
  let split = token.split('|')
  let expected = { identifier: { $elemMatch: { system: split[0], value: split[1] } } }
  let actual = common.util.tokenToSystemValueElemMatch('identifier', token)
  t.deepEqual(actual, expected, 'Single system|value token')

  token = [ 'test:assigning:auth|123456', 'another:assigning:auth|111111' ]
  split = []
  token.forEach((t) => {
    split = split.concat(t.split('|'))
  })
  expected = { $and: [
    { identifier: { $elemMatch: { system: split[0], value: split[1] } } },
    { identifier: { $elemMatch: { system: split[2], value: split[3] } } }
  ] }
  actual = common.util.tokenToSystemValueElemMatch('identifier', token)
  t.deepEqual(actual, expected, 'Multiple system|value tokens')

  token = '123456'
  expected = { identifier: { $elemMatch: { value: token } } }
  actual = common.util.tokenToSystemValueElemMatch('identifier', token)
  t.deepEqual(actual, expected, 'Single value without system token')

  token = [ '123456', '111111' ]
  expected = { $and: [
    { identifier: { $elemMatch: { value: token[0] } } },
    { identifier: { $elemMatch: { value: token[1] } } }
  ] }
  actual = common.util.tokenToSystemValueElemMatch('identifier', token)
  t.deepEqual(actual, expected, 'Multiple value without system tokens')

  token = '|123456'
  split = token.split('|')
  expected = { identifier: { $elemMatch: { system: { $exists: false }, value: split[1] } } }
  actual = common.util.tokenToSystemValueElemMatch('identifier', token)
  t.deepEqual(actual, expected, 'Single value with non existent system token')

  t.end()
})

tap.test('.util.removeIdentifiersFromTokens should remove identifier part of token query parameter', (t) => {
  let token = 'test:assigning:auth|123456'
  let expected = 'test:assigning:auth|'
  let actual = common.util.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  token = 'domain1|,domain2|'
  expected = 'domain1|,domain2|'
  actual = common.util.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  token = [ 'domain1|,domain2|', 'test1|1111' ]
  expected = [ 'domain1|,domain2|', 'test1|' ]
  actual = common.util.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  token = [ '11111', 'test1|1111', 'test2|2222' ]
  expected = [ 'test1|', 'test2|' ]
  actual = common.util.removeIdentifiersFromTokens(token)
  t.deepEqual(actual, expected)

  t.end()
})
