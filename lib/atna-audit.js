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

let connDetail = {
  interface: ATNAAuditConfig.interface,
  host: ATNAAuditConfig.host,
  port: ATNAAuditConfig.port,
  options: {}
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
  var eventID = new ATNA.construct.Code(110112, 'Query', 'DCM')
  var typeCode = new ATNA.construct.Code('ITI-83', 'Mobile Patient Identifier Cross-reference Query', 'IHE Transactions')
  var eIdent = new ATNA.construct.EventIdentification(ATNA.constants.EVENT_ACTION_EXECUTE, new Date(), ATNA.constants.OUTCOME_SUCCESS, eventID, typeCode)

  // Active Participant - System
  var sysRoleCode = new ATNA.construct.Code(110153, 'Source', 'DCM')
  var sysParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', false, ctx.requestorIp, ATNA.constants.NET_AP_TYPE_IP, [sysRoleCode])

  // Active Participant - User
  var userRoleCodeDef = new ATNA.construct.Code(110152, 'DCM', 'Destination')
  var userParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', true, null, null, [userRoleCodeDef])

  // Audit Source
  var sourceTypeCode = new ATNA.construct.Code(ATNA.constants.AUDIT_SRC_TYPE_WEB_SERVER, '', '')
  var sourceIdent = new ATNA.construct.AuditSourceIdentification(null, ctx.authenticatedUser, sourceTypeCode)

  // Participant Object
  var objIdTypeCode = new ATNA.construct.Code('ITI-83', 'Mobile Patient Identifier Cross-reference Query', 'IHE Transactions')
  var participantObj = new ATNA.construct.ParticipantObjectIdentification(
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

  var audit = new ATNA.construct.AuditMessage(eIdent, [sysParticipant, userParticipant], [participantObj], [sourceIdent])
  var xml = audit.toXML()

  const syslog = ATNA.construct.wrapInSyslog(xml)

  return syslog
}

exports.buildPDQmAuditMsg = (ctx) => {
  // event
  var eventID = new ATNA.construct.Code(110112, 'Query', 'DCM')
  var typeCode = new ATNA.construct.Code('ITI-78', 'Mobile Patient Demographics Query', 'IHE Transactions')
  var eIdent = new ATNA.construct.EventIdentification(ATNA.constants.EVENT_ACTION_EXECUTE, new Date(), ATNA.constants.OUTCOME_SUCCESS, eventID, typeCode)

  // Active Participant - System
  var sysRoleCode = new ATNA.construct.Code(110153, 'Source', 'DCM')
  var sysParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', false, ctx.requestorIp, ATNA.constants.NET_AP_TYPE_IP, [sysRoleCode])

  // Active Participant - User
  var userRoleCodeDef = new ATNA.construct.Code(110152, 'DCM', 'Destination')
  var userParticipant = new ATNA.construct.ActiveParticipant(ctx.authenticatedUser, '', true, null, null, [userRoleCodeDef])

  // Audit Source
  var sourceTypeCode = new ATNA.construct.Code(ATNA.constants.AUDIT_SRC_TYPE_WEB_SERVER, '', '')
  var sourceIdent = new ATNA.construct.AuditSourceIdentification(null, ctx.authenticatedUser, sourceTypeCode)

  // Participant Object
  var objIdTypeCode = new ATNA.construct.Code('ITI-78', 'Mobile Patient Demographics Query', 'IHE Transactions')
  var participantObj = new ATNA.construct.ParticipantObjectIdentification(
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

  var audit = new ATNA.construct.AuditMessage(eIdent, [sysParticipant, userParticipant], [participantObj], [sourceIdent])
  var xml = audit.toXML()

  const syslog = ATNA.construct.wrapInSyslog(xml)

  return syslog
}

exports.buildmCSDAuditMsg = (ctx, transaction, actor) => {
  // event
  var eventID = new ATNA.construct.Code(110112, 'Query', 'DCM')
  var typeCode = new ATNA.construct.Code(transaction, 'Mobile Care Services Discovery '+actor+' Query', 'IHE Transactions')
  var eIdent = new ATNA.construct.EventIdentification(ATNA.constants.EVENT_ACTION_EXECUTE, new Date(), ATNA.constants.OUTCOME_SUCCESS, eventID, typeCode)

  var user = ctx.authenticatedUser.email;
  // Active Participant - System
  var sysRoleCode = new ATNA.construct.Code(110153, 'Source', 'DCM')
  var sysParticipant = new ATNA.construct.ActiveParticipant(user, '', false, ctx.requestorIp, ATNA.constants.NET_AP_TYPE_IP, [sysRoleCode])

  // Active Participant - User
  var userRoleCodeDef = new ATNA.construct.Code(110152, 'DCM', 'Destination')
  var userParticipant = new ATNA.construct.ActiveParticipant(user, '', true, null, null, [userRoleCodeDef])

  // Audit Source
  var sourceTypeCode = new ATNA.construct.Code(ATNA.constants.AUDIT_SRC_TYPE_WEB_SERVER, '', '')
  var sourceIdent = new ATNA.construct.AuditSourceIdentification(null, ctx.authenticatedUser, sourceTypeCode)

  // Participant Object
  var objIdTypeCode = new ATNA.construct.Code(transaction, 'Mobile Care Services Discovery '+actor+' Query', 'IHE Transactions')
  var participantObj = new ATNA.construct.ParticipantObjectIdentification(
    ctx.fullUrl,
    ATNA.constants.OBJ_TYPE_SYS_OBJ,
    ATNA.constants.OBJ_TYPE_CODE_ROLE_QUERY,
    null,
    null,
    objIdTypeCode,
    null,
    new Buffer(ctx.fullUrl).toString('base64')
  )

  var audit = new ATNA.construct.AuditMessage(eIdent, [sysParticipant, userParticipant], [participantObj], [sourceIdent])
  var xml = audit.toXML()

  const syslog = ATNA.construct.wrapInSyslog(xml)

  return syslog
}


exports.sendAuditEvent = (msg, callback) => {
  if (!ATNAAuditConfig.enabled) {
    return
  }

  ATNA.send.sendAuditEvent(msg, connDetail, callback)
}
