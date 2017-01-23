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
