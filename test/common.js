/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

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
