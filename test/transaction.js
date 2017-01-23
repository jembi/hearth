'use strict'

const tap = require('tap')

const Transaction = require('../lib/fhir/transaction')
const testBundle = require('./resources/Transaction-1.json')

tap.test('Transaction resource .sortTransactionBundle() should sort interactions correctly', (t) => {
  // given
  const transaction = Transaction()
  // when
  let sortedBundle = transaction.sortTransactionBundle(testBundle)
  // then
  t.ok(sortedBundle)
  t.equals(sortedBundle.entry.length, testBundle.entry.length, 'should have the same number of entries as the original bundle')
  t.equals(sortedBundle.entry[0].request.method, 'DELETE')
  t.equals(sortedBundle.entry[1].request.method, 'DELETE')
  t.equals(sortedBundle.entry[2].request.method, 'POST')
  t.equals(sortedBundle.entry[3].request.method, 'POST')
  t.equals(sortedBundle.entry[4].request.method, 'POST')
  t.equals(sortedBundle.entry[5].request.method, 'PUT')
  t.equals(sortedBundle.entry[6].request.method, 'PUT')
  t.equals(sortedBundle.entry[7].request.method, 'PUT')
  t.equals(sortedBundle.entry[8].request.method, 'GET')
  t.equals(sortedBundle.entry[9].request.method, 'GET')
  t.end()
})

tap.test('Transaction resource .sortTransactionBundle() should do nothing on an empty bundle', (t) => {
  // given
  const transaction = Transaction()
  // when
  let sortedBundle = transaction.sortTransactionBundle({
    type: 'transaction',
    entry: []
  })
  // then
  t.ok(sortedBundle)
  t.equals(sortedBundle.entry.length, 0)
  t.end()
})

tap.test('Transaction resource .sortTransactionBundle() should throw an error if request.method isn\'t specified', (t) => {
  t.plan(1)
  // given
  const transaction = Transaction()
  // when and then
  t.throws(() => {
    transaction.sortTransactionBundle({
      type: 'transaction',
      entry: [
        {
          request: {
            method: 'PUT'
          }
        },
        { /* fail */ },
        {
          request: {
            method: 'POST'
          }
        }
      ]
    })
  }, {}, 'should throw an error object')
})

tap.test('Transaction resource .sortTransactionBundle() should throw and error if the Bundle.type isn\'t \'transaction\'', (t) => {
  t.plan(1)
  // given
  const transaction = Transaction()
  // when and then
  t.throws(() => {
    transaction.sortTransactionBundle({
      type: 'Meh',
      entry: []
    })
  }, /Bundle is not of type transaction/, 'should throw the correct error')
})
