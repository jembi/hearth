/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const fs = require('fs')
const ATNA = require('atna-audit')
const ATNAAuditConfig = require('./config').getConf('atnaAudit')

const connDetail = {
  interface: ATNAAuditConfig.interface,
  host: ATNAAuditConfig.host,
  port: ATNAAuditConfig.port
}

if (ATNAAuditConfig.certOptions.key) {
  connDetail.options.key = fs.readFileSync(ATNAAuditConfig.certOptions.key).toString()
}

if (ATNAAuditConfig.certOptions.cert) {
  connDetail.options.cert = fs.readFileSync(ATNAAuditConfig.certOptions.cert).toString()
}

if (ATNAAuditConfig.certOptions.ca) {
  connDetail.options.ca = fs.readFileSync(ATNAAuditConfig.certOptions.ca).toString()
}

exports.buildPIXmAuditMsg = (ctx) => {
  // event
  const eventID = new ATNA.construct.Code(110112, 'Query', 'DCM')
  const typeCode = new ATNA.construct.Code('ITI-83', 'Mobile Patient Identifier Cross-reference Query', 'IHE Transactions')
  const eIdent = new ATNA.construct.EventIdentification(ATNA.constants.EVENT_ACTION_EXECUTE, new Date(), ATNA.constants.OUTCOME_SUCCESS, eventID, typeCode)

  // Active Participant - System
  const sysRoleCode = new ATNA.construct.Code(110153, 'Source', 'DCM')
  const sysParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', false, ctx.requestorIp, ATNA.constants.NET_AP_TYPE_IP, [sysRoleCode])

  // Active Participant - User
  const userRoleCodeDef = new ATNA.construct.Code(110152, 'DCM', 'Destination')
  const userParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', true, null, null, [userRoleCodeDef])

  // Audit Source
  const sourceTypeCode = new ATNA.construct.Code(ATNA.constants.AUDIT_SRC_TYPE_WEB_SERVER, '', '')
  const sourceIdent = new ATNA.construct.AuditSourceIdentification(null, ctx.authenticatedUser, sourceTypeCode)

  // Participant Object
  const objIdTypeCode = new ATNA.construct.Code('ITI-83', 'Mobile Patient Identifier Cross-reference Query', 'IHE Transactions')
  const participantObj = new ATNA.construct.ParticipantObjectIdentification(
    ctx.fullUrl,
    ATNA.constants.OBJ_TYPE_SYS_OBJ,
    ATNA.constants.OBJ_TYPE_CODE_ROLE_QUERY,
    null,
    null,
    objIdTypeCode,
    null,
    ctx.fullUrl,
    ctx.headers
  )

  const audit = new ATNA.construct.AuditMessage(eIdent, [sysParticipant, userParticipant], [participantObj], [sourceIdent])
  const xml = audit.toXML()

  const syslog = ATNA.construct.wrapInSyslog(xml)

  return syslog
}

exports.buildPDQmAuditMsg = (ctx) => {
  // event
  const eventID = new ATNA.construct.Code(110112, 'Query', 'DCM')
  const typeCode = new ATNA.construct.Code('ITI-78', 'Mobile Patient Demographics Query', 'IHE Transactions')
  const eIdent = new ATNA.construct.EventIdentification(ATNA.constants.EVENT_ACTION_EXECUTE, new Date(), ATNA.constants.OUTCOME_SUCCESS, eventID, typeCode)

  // Active Participant - System
  const sysRoleCode = new ATNA.construct.Code(110153, 'Source', 'DCM')
  const sysParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', false, ctx.requestorIp, ATNA.constants.NET_AP_TYPE_IP, [sysRoleCode])

  // Active Participant - User
  const userRoleCodeDef = new ATNA.construct.Code(110152, 'DCM', 'Destination')
  const userParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', true, null, null, [userRoleCodeDef])

  // Audit Source
  const sourceTypeCode = new ATNA.construct.Code(ATNA.constants.AUDIT_SRC_TYPE_WEB_SERVER, '', '')
  const sourceIdent = new ATNA.construct.AuditSourceIdentification(null, ctx.authenticatedUser, sourceTypeCode)

  // Participant Object
  const objIdTypeCode = new ATNA.construct.Code('ITI-78', 'Mobile Patient Demographics Query', 'IHE Transactions')
  const participantObj = new ATNA.construct.ParticipantObjectIdentification(
    ctx.fullUrl,
    ATNA.constants.OBJ_TYPE_SYS_OBJ,
    ATNA.constants.OBJ_TYPE_CODE_ROLE_QUERY,
    null,
    null,
    objIdTypeCode,
    null,
    ctx.fullUrl,
    ctx.headers
  )

  const audit = new ATNA.construct.AuditMessage(eIdent, [sysParticipant, userParticipant], [participantObj], [sourceIdent])
  const xml = audit.toXML()

  const syslog = ATNA.construct.wrapInSyslog(xml)

  return syslog
}

exports.sendAuditEvent = (msg, callback) => {
  if (!ATNAAuditConfig.enabled) {
    return
  }

  ATNA.send.sendAuditEvent(msg, connDetail, callback)
}
