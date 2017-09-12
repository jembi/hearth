 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
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
