'use strict'

process.env.NODE_ENV = 'test'
require('../lib/init')

const tap = require('tap')
const rewire = require('rewire')

const atnaAudit = rewire('../lib/atna-audit')

tap.test('ATNA Audit - should send a valid ATNA audit via UDP', (t) => {
  let mockConnDetail = atnaAudit.__get__('connDetail')
  mockConnDetail.interface = 'udp'

  atnaAudit.__set__('connDetail', mockConnDetail)

  // given
  const msg = atnaAudit.buildPIXmAuditMsg()
  atnaAudit.sendAuditEvent(msg, (err) => {
    t.error(err)

    t.end()
  })
})

/* tap.test('ATNA Audit - should send a valid ATNA audit via UDP', (t) => {

  let mockConnDetail = atnaAudit.__get__('connDetail')
  mockConnDetail.interface = 'tls'

  atnaAudit.__set__('connDetail', mockConnDetail);

  // given
  const msg = atnaAudit.buildPIXmAuditMsg()
  atnaAudit.sendAuditEvent(msg, (err) => {
    console.log(err)
    t.error(err)

    t.end()
  })
}) */
