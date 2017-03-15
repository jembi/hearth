'use strict'

const fs = require('fs')
const ATNA = require('atna-audit')
const logger = require('winston')
const ATNAAuditConfig = require('./config').getConf('atnaAudit')

let connDetail = {
  interface: ATNAAuditConfig.interface,
  host: ATNAAuditConfig.host,
  port: ATNAAuditConfig.port,
  options: {
    key: fs.readFileSync(ATNAAuditConfig.certOptions.key).toString(),
    cert: fs.readFileSync(ATNAAuditConfig.certOptions.cert).toString()
  }
}

exports.buildPIXmAuditMsg = () => {
  // event
  var eventID = new ATNA.construct.Code(110112, 'Query', 'DCM')
  var typeCode = new ATNA.construct.Code('ITI-9', 'PIX Query', 'IHE Transactions')
  var eIdent = new ATNA.construct.EventIdentification(ATNA.constants.EVENT_ACTION_EXECUTE, new Date(), ATNA.constants.OUTCOME_SUCCESS, eventID, typeCode)

  // Active Participant - System
  var sysRoleCode = new ATNA.construct.Code(110150, 'Application', 'DCM')
  var sysParticipant = new ATNA.construct.ActiveParticipant('HEARTH', '', false, '127.0.0.1', ATNA.constants.NET_AP_TYPE_IP, [sysRoleCode])

  // Active Participant - User
  var userRoleCodeDef = new ATNA.construct.Code('userRole', 'userRole', 'userRoleCode')
  var userParticipant = new ATNA.construct.ActiveParticipant('UserParticipantName', '', true, null, null, [userRoleCodeDef])

  // Audit Source
  var sourceTypeCode = new ATNA.construct.Code(ATNA.constants.AUDIT_SRC_TYPE_WEB_SERVER, '', '')
  var sourceIdent = new ATNA.construct.AuditSourceIdentification(null, 'HEARTH', sourceTypeCode)

  // Participant Object
  var objIdTypeCode = new ATNA.construct.Code('ITI-9', 'PIX Query', 'IHE Transactions')
  var participantObj = new ATNA.construct.ParticipantObjectIdentification(
    'searchParams=value', ATNA.constants.OBJ_TYPE_SYS_OBJ, ATNA.constants.OBJ_TYPE_CODE_ROLE_QUERY, null, null, objIdTypeCode, 'PIX Query', 'objDetails'
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
