'use strict'

const tap = require('tap')

const Common = require('../lib/fhir/common')
const env = require('./test-env/init')()

tap.test('should resolve references', (t) => {
  // given
  const common = Common(env.mongo())
  let testResource = {
    resourceType: 'Test',
    patient: {
      reference: 'Test/123'
    },
    list: [
      {
        author: {
          reference: 'Test/123'
        }
      },
      {
        author: {
          reference: 'Test/123'
        }
      },
      {
        author: 'blank'
      }
    ],
    nested: {
      patient: {
        reference: 'Test/123'
      }
    },
    nochange: {
      reference: 'Test/456'
    }
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
  const common = Common(env.mongo())

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

tap.test('.util.validateQueryParamsReturnQueryObject should validate searchParams', (t) => {
  const common = Common(env.mongo())

  let queryParams = { test1: '1', test2: 2 }
  let supported = {
    test1: { allowArray: true, required: false, operators: { exact: true } },
    test2: { allowArray: false, required: false, operators: { exact: true } },
    test3: { operators: { } }
  }

  common.util.validateQueryParamsReturnQueryObject(queryParams, supported, (badRequest, queryObject) => {
    t.error(badRequest)
    const expected = {
      'test1': {
        'value': '1',
        'operators': {
          'exact': true
        }
      },
      'test2': {
        'value': 2,
        'operators': {
          'exact': true
        }
      }
    }
    t.deepEqual(queryObject, expected, 'Should return queryObject if query params are supported')
  })

  queryParams = { test1: '1' }
  supported = {
    test1: { allowArray: true, required: true, operators: { exact: true } },
    test2: { allowArray: true, required: true, operators: { exact: true } },
    test3: { allowArray: true, required: false, operators: { exact: true } }
  }

  common.util.validateQueryParamsReturnQueryObject(queryParams, supported, (badRequest, queryObject) => {
    t.ok(badRequest)
    t.equal(badRequest, `This endpoint has the following required query parameters: ["test1","test2"]`, 'Should return error message if required params are missing')
  })

  t.end()
})
