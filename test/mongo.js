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
