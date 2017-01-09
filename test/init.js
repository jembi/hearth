'use strict'
const env = require('./test-env/init')()
const tap = require('tap')

// test the tester

tap.test('test-env/init.initDB should create a mongo connection', (t) => {
  env.initDB((err, db) => {
    t.error(err)
    t.ok(db)
    let c = db.collection('tmp')
    c.insert({test: 'test'}, (err) => {
      t.error(err)

      c.findOne({test: 'test'}, (err, obj) => {
        t.error(err)

        t.ok(obj)
        t.equal(obj.test, 'test')

        env.clearDB((err) => {
          t.error(err)
          t.end()
        })
      })
    })
  })
})

tap.test('test-env/init.clearDB should drop the test db', (t) => {
  env.initDB((err, db) => {
    t.error(err)
    let c = db.collection('tmp')
    c.insert({test: 'test'}, (err) => {
      t.error(err)

      env.clearDB((err) => {
        t.error(err)

        env.initDB((err, db) => {
          t.error(err)
          let c2 = db.collection('tmp')

          c2.findOne({test: 'test'}, (err, obj) => {
            t.error(err)

            t.notOk(obj)

            env.clearDB((err) => {
              t.error(err)
              t.end()
            })
          })
        })
      })
    })
  })
})
