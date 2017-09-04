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
const mongo = require('../lib/mongo')()
const tap = require('tap')

tap.test('.util .collapseWhenSingleClause should collapse nested single clauses', (t) => {
  let query = {
    $and: [
      { $or: [ { field: 'hello' } ] }
    ]
  }

  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { field: 'hello' })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse multiple single clauses', (t) => {
  const query = {
    $and: [
      { field1: 'hello1' }
    ],
    $or: [
      { field2: 'hello2' }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { field1: 'hello1', field2: 'hello2' })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse multiple multiple clauses', (t) => {
  const query = {
    $and: [
      { field1: 'hello1' }
    ],
    $or: [
      { field2: 'hello2' },
      { field3: 'hello3' }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { field1: 'hello1', $or: [ { field2: 'hello2' }, { field3: 'hello3' } ] })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse multiple multiple clauses', (t) => {
  const query = {
    $and: [
      { field1: 'hello1' },
      { field2: 'hello2' }
    ],
    $or: [
      { field3: 'hello3' },
      { field4: 'hello4' }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { $and: [ { field1: 'hello1' }, { field2: 'hello2' } ], $or: [ { field3: 'hello3' }, { field4: 'hello4' } ] })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse nested single clauses', (t) => {
  let query = {
    $and: [
      {
        $or: [
          { field1: 'hello1' },
          { field2: 'hello2' }
        ]
      }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { $or: [ { field1: 'hello1' }, { field2: 'hello2' } ] })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse nested single clauses', (t) => {
  let query = {
    $and: [
      { $or: [ { field1: 'hello1' } ] },
      { $or: [ { field2: 'hello2' } ] }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { $and: [ { field1: 'hello1' }, { field2: 'hello2' } ] })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse nested single clauses', (t) => {
  let query = {
    $and: [
      { $or: [ { $and: [ { field1: 'hello1' }, { field3: 'hello3' } ] } ] },
      { $or: [ { field2: 'hello2' } ] }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { $and: [ { $and: [ { field1: 'hello1' }, { field3: 'hello3' } ] }, { field2: 'hello2' } ] })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should collapse multiple nested clauses and a $not operator', (t) => {
  let query = {
    $and: [
      { $or: [ { $and: [ { $not: { field1: 'hello1' } }, { field3: 'hello3' } ] } ] },
      { $or: [ { field2: 'hello2' } ] },
      { $and: [ { field4: 'hello4' } ] }
    ]
  }
  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { $and: [ { $and: [ { $not: { field1: 'hello1' } }, { field3: 'hello3' } ] }, { field2: 'hello2' }, { field4: 'hello4' } ] })
  t.end()
})

tap.test('.util .collapseWhenSingleClause should not interfere with exact array queries', (t) => {
  let query = {
    tag: [ 'red' ]
  }

  t.deepEqual(mongo.util.collapseWhenSingleClause(query), { tag: [ 'red' ] })
  t.end()
})
