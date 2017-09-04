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

const fs = require('fs')
const ATNA = require('atna-audit')
const ATNAAuditConfig = require('./config').getConf('atnaAudit')

let connDetail = {
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

exports.sendAuditEvent = (msg, callback) => {
  if (!ATNAAuditConfig.enabled) {
    return
  }

  ATNA.send.sendAuditEvent(msg, connDetail, callback)
}
