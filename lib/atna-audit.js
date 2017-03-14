'use strict'

const fs = require('fs')
const atna = require('atna-audit')
const logger = require('winston')
const atnaAuditConfig = require('./config').getConf('atnaAudit')

const getFileContent = (path) => {
  if (!path) {
    return
  }

  return fs.readFile(path, 'utf8', function (err, data) {
    if (err) {
      return logger.error(err)
    }
    return data
  })
}

let connDetail = {
  interface: atnaAuditConfig.interface,
  host: atnaAuditConfig.host,
  port: atnaAuditConfig.port,
  options: {
    key: getFileContent(atnaAuditConfig.certOptions.key),
    cert: getFileContent(atnaAuditConfig.certOptions.cert)
  }
}

exports.buildPIXmAuditMsg = () => {
  const audit = atna.userLoginAudit(atna.OUTCOME_SUCCESS, 'openhim', 'x.x.x.x', 'testUser', 'testRole', '123')
  const syslog = atna.wrapInSyslog(audit)

  return syslog
}

exports.sendAuditEvent = (msg, callback) => {
  if (!atnaAuditConfig.enabled) {
    return
  }

  atna.sendAuditEvent(msg, connDetail, callback)
}
