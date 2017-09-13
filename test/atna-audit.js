 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

process.env.NODE_ENV = 'test'
require('../lib/init')

const tap = require('tap')
const libxmljs = require('libxmljs')
const syslogParser = require('glossy').Parse
const atnaAudit = require('../lib/atna-audit')

tap.test('ATNA Audit - should construct a valid ATNA audit PIXm message', (t) => {
  const ctx = {
    domain: 'http://localhost:3447/fhir',
    authenticatedUser: 'sysadmin',
    fullUrl: 'http://localhost:3447/fhir',
    requestorIp: 'http://192.168.10.10:5001/fhir',
    headers: {
      'auth-username': 'sysadmin@hearth.org',
      'auth-ts': '2017-03-23T11:40:18.229Z',
      'auth-salt': '22222222-555555-333333-1111-444444444444',
      'auth-token': '11111111111111111111111',
      host: 'localhost:3447',
      accept: 'application/json'
    }
  }

  const msg = atnaAudit.buildPIXmAuditMsg(ctx)
  const parsedMessage = syslogParser.parse(msg)
  const xmlDoc = libxmljs.parseXml(parsedMessage.message)

  t.equal(xmlDoc.errors.length, 0)

  const EventIdentification = xmlDoc.get('//EventIdentification')
  t.equals(EventIdentification.attr('EventActionCode').value(), 'E', 'EventIdentification: EventActionCode should have a value of "E"')
  t.equals(EventIdentification.attr('EventOutcomeIndicator').value(), '0', 'EventIdentification: EventOutcomeIndicator should have a value of "0"')
  const EventIdentificationEventID = xmlDoc.get('//EventIdentification/EventID')
  t.equals(EventIdentificationEventID.attr('csd-code').value(), '110112', 'EventIdentificationEventID: csd-code should have a value of "110112"')
  t.equals(EventIdentificationEventID.attr('originalText').value(), 'Query', 'EventIdentificationEventID: originalText should have a value of "Query"')
  t.equals(EventIdentificationEventID.attr('codeSystemName').value(), 'DCM', 'EventIdentificationEventID: codeSystemName should have a value of "DCM"')
  const EventIdentificationEventTypeCode = xmlDoc.get('//EventIdentification/EventTypeCode')
  t.equals(EventIdentificationEventTypeCode.attr('csd-code').value(), 'ITI-83', 'EventIdentificationEventTypeCode: csd-code should have a value of "ITI-83"')
  t.equals(EventIdentificationEventTypeCode.attr('originalText').value(), 'Mobile Patient Identifier Cross-reference Query', 'EventIdentificationEventTypeCode: originalText should have a value of "Mobile Patient Identifier Cross-reference Query"')
  t.equals(EventIdentificationEventTypeCode.attr('codeSystemName').value(), 'IHE Transactions', 'EventIdentificationEventTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ActiveParticipant1 = xmlDoc.get('//ActiveParticipant[1]')  // Source is the PIXm consumer
  t.equals(ActiveParticipant1.attr('UserID').value(), ctx.authenticatedUser, `ActiveParticipant1: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals(ActiveParticipant1.attr('AlternativeUserID').value(), '', 'ActiveParticipant1: AlternativeUserID should have a value of ""')
  t.equals(ActiveParticipant1.attr('UserIsRequestor').value(), 'false', 'ActiveParticipant1: UserIsRequestor should have a value of "false"')
  t.equals(ActiveParticipant1.attr('NetworkAccessPointID').value(), ctx.requestorIp, `ActiveParticipant1: NetworkAccessPointID should have a value of "${ctx.requestorIp}"`)
  t.equals(ActiveParticipant1.attr('NetworkAccessPointTypeCode').value(), '2', 'ActiveParticipant1: NetworkAccessPointTypeCode should have a value of "2"')
  const ActiveParticipant1RoleIDCode = xmlDoc.get('//ActiveParticipant[1]/RoleIDCode')
  t.equals(ActiveParticipant1RoleIDCode.attr('csd-code').value(), '110153', 'ActiveParticipant1RoleIDCode: csd-code should have a value of "110153"')
  t.equals(ActiveParticipant1RoleIDCode.attr('originalText').value(), 'Source', 'ActiveParticipant1RoleIDCode: originalText should have a value of "Application"')
  t.equals(ActiveParticipant1RoleIDCode.attr('codeSystemName').value(), 'DCM', 'ActiveParticipant1RoleIDCode: codeSystemName should have a value of "DCM"')

  const ActiveParticipant2 = xmlDoc.get('//ActiveParticipant[2]') // Destination is the PIXm manager
  t.equals(ActiveParticipant2.attr('UserID').value(), ctx.authenticatedUser, `ActiveParticipant2: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals(ActiveParticipant2.attr('AlternativeUserID').value(), '', 'ActiveParticipant2: AlternativeUserID should have a value of ""')
  t.equals(ActiveParticipant2.attr('UserIsRequestor').value(), 'true', 'ActiveParticipant2: UserIsRequestor should have a value of "true"')
  const ActiveParticipant2RoleIDCode = xmlDoc.get('//ActiveParticipant[2]/RoleIDCode')
  t.equals(ActiveParticipant2RoleIDCode.attr('csd-code').value(), '110152', 'ActiveParticipant2RoleIDCode: csd-code should have a value of "110152"')
  t.equals(ActiveParticipant2RoleIDCode.attr('originalText').value(), 'DCM', 'ActiveParticipant2RoleIDCode: originalText should have a value of "DCM"')
  t.equals(ActiveParticipant2RoleIDCode.attr('codeSystemName').value(), 'Destination', 'ActiveParticipant2RoleIDCode: codeSystemName should have a value of "Destination"')

  const AuditSourceIdentification = xmlDoc.get('//AuditSourceIdentification')
  t.equals(AuditSourceIdentification.attr('AuditEnterpriseSiteID').value(), '', 'AuditSourceIdentification: AuditEnterpriseSiteID should have a value of ""')
  t.equals(AuditSourceIdentification.attr('AuditSourceID').value(), ctx.authenticatedUser, `AuditSourceIdentification: AuditSourceID should have a value of ${ctx.authenticatedUser}`)
  t.equals(AuditSourceIdentification.attr('code').value(), '3', 'AuditSourceIdentification: code should have a value of "3"')

  const ParticipantObjectIdentification = xmlDoc.get('//ParticipantObjectIdentification')
  t.equals(ParticipantObjectIdentification.attr('ParticipantObjectID').value(), ctx.fullUrl, `ParticipantObjectIdentification: ParticipantObjectID should have a value of "${ctx.fullUrl}"`)
  t.equals(ParticipantObjectIdentification.attr('ParticipantObjectTypeCode').value(), '2', 'ParticipantObjectIdentification: ParticipantObjectTypeCode should have a value of "2"')
  t.equals(ParticipantObjectIdentification.attr('ParticipantObjectTypeCodeRole').value(), '24', 'ParticipantObjectIdentification: ParticipantObjectTypeCodeRole should have a value of "24"')
  const ParticipantObjectIDTypeCode = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectIDTypeCode')
  t.equals(ParticipantObjectIDTypeCode.attr('csd-code').value(), 'ITI-83', 'ParticipantObjectIDTypeCode: csd-code should have a value of "ITI-83"')
  t.equals(ParticipantObjectIDTypeCode.attr('originalText').value(), 'Mobile Patient Identifier Cross-reference Query', 'ParticipantObjectIDTypeCode: originalText should have a value of "Mobile Patient Identifier Cross-reference Query"')
  t.equals(ParticipantObjectIDTypeCode.attr('codeSystemName').value(), 'IHE Transactions', 'ParticipantObjectIDTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ParticipantObjectQuery = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectQuery')
  t.equals(ParticipantObjectQuery.text(), ctx.fullUrl, `ParticipantObjectQuery: should have a value of "${ctx.fullUrl}"`)

  // ParticipantObjectDetail
  const ParticipantObjectDetailAuthUsername = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-username')
  t.equals(ParticipantObjectDetailAuthUsername.text(), ctx.headers['auth-username'], `ParticipantObjectDetailAuthUsername: should have a value of "${ctx.headers['auth-username']}"`)
  const ParticipantObjectDetailAuthTs = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-ts')
  t.equals(ParticipantObjectDetailAuthTs.text(), ctx.headers['auth-ts'], `ParticipantObjectDetailAuthTs: should have a value of "${ctx.headers['auth-ts']}"`)
  const ParticipantObjectDetailAuthSalt = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-salt')
  t.equals(ParticipantObjectDetailAuthSalt.text(), ctx.headers['auth-salt'], `ParticipantObjectDetailAuthSalt: should have a value of "${ctx.headers['auth-salt']}"`)
  const ParticipantObjectDetailAuthToken = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-token')
  t.equals(ParticipantObjectDetailAuthToken.text(), ctx.headers['auth-token'], `ParticipantObjectDetailAuthToken: should have a value of "${ctx.headers['auth-token']}"`)
  const ParticipantObjectDetailAuthHost = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/host')
  t.equals(ParticipantObjectDetailAuthHost.text(), ctx.headers['host'], `ParticipantObjectDetailAuthHost: should have a value of "${ctx.headers['host']}"`)
  const ParticipantObjectDetailAccept = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/accept')
  t.equals(ParticipantObjectDetailAccept.text(), ctx.headers['accept'], `ParticipantObjectDetailAccept: should have a value of "${ctx.headers['accept']}"`)

  t.end()
})

tap.test('ATNA Audit - should construct a valid ATNA audit PDQm message', (t) => {
  const ctx = {
    domain: 'http://localhost:3447/fhir',
    authenticatedUser: 'sysadmin',
    fullUrl: 'http://localhost:3447/fhir',
    requestorIp: 'http://192.168.10.10:5001/fhir',
    headers: {
      'auth-username': 'sysadmin@hearth.org',
      'auth-ts': '2017-03-23T11:40:18.229Z',
      'auth-salt': '22222222-555555-333333-1111-444444444444',
      'auth-token': '11111111111111111111111',
      host: 'localhost:3447',
      accept: 'application/json'
    }
  }

  const msg = atnaAudit.buildPDQmAuditMsg(ctx)
  const parsedMessage = syslogParser.parse(msg)
  const xmlDoc = libxmljs.parseXml(parsedMessage.message)

  t.equal(xmlDoc.errors.length, 0)

  const EventIdentification = xmlDoc.get('//EventIdentification')
  t.equals(EventIdentification.attr('EventActionCode').value(), 'E', 'EventIdentification: EventActionCode should have a value of "E"')
  t.equals(EventIdentification.attr('EventOutcomeIndicator').value(), '0', 'EventIdentification: EventOutcomeIndicator should have a value of "0"')
  const EventIdentificationEventID = xmlDoc.get('//EventIdentification/EventID')
  t.equals(EventIdentificationEventID.attr('csd-code').value(), '110112', 'EventIdentificationEventID: csd-code should have a value of "110112"')
  t.equals(EventIdentificationEventID.attr('originalText').value(), 'Query', 'EventIdentificationEventID: originalText should have a value of "Query"')
  t.equals(EventIdentificationEventID.attr('codeSystemName').value(), 'DCM', 'EventIdentificationEventID: codeSystemName should have a value of "DCM"')
  const EventIdentificationEventTypeCode = xmlDoc.get('//EventIdentification/EventTypeCode')
  t.equals(EventIdentificationEventTypeCode.attr('csd-code').value(), 'ITI-78', 'EventIdentificationEventTypeCode: csd-code should have a value of "ITI-78"')
  t.equals(EventIdentificationEventTypeCode.attr('originalText').value(), 'Mobile Patient Demographics Query', 'EventIdentificationEventTypeCode: originalText should have a value of "Mobile Patient Demographics Query"')
  t.equals(EventIdentificationEventTypeCode.attr('codeSystemName').value(), 'IHE Transactions', 'EventIdentificationEventTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ActiveParticipant1 = xmlDoc.get('//ActiveParticipant[1]')  // Source is the PDQm consumer
  t.equals(ActiveParticipant1.attr('UserID').value(), ctx.authenticatedUser, `ActiveParticipant1: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals(ActiveParticipant1.attr('AlternativeUserID').value(), '', 'ActiveParticipant1: AlternativeUserID should have a value of ""')
  t.equals(ActiveParticipant1.attr('UserIsRequestor').value(), 'false', 'ActiveParticipant1: UserIsRequestor should have a value of ""')
  t.equals(ActiveParticipant1.attr('NetworkAccessPointID').value(), ctx.requestorIp, `ActiveParticipant1: NetworkAccessPointID should have a value of "${ctx.requestorIp}"`)
  t.equals(ActiveParticipant1.attr('NetworkAccessPointTypeCode').value(), '2', 'ActiveParticipant1: NetworkAccessPointTypeCode should have a value of "2"')
  const ActiveParticipant1RoleIDCode = xmlDoc.get('//ActiveParticipant[1]/RoleIDCode')
  t.equals(ActiveParticipant1RoleIDCode.attr('csd-code').value(), '110153', 'ActiveParticipant1RoleIDCode: csd-code should have a value of "110153"')
  t.equals(ActiveParticipant1RoleIDCode.attr('originalText').value(), 'Source', 'ActiveParticipant1RoleIDCode: originalText should have a value of "Application"')
  t.equals(ActiveParticipant1RoleIDCode.attr('codeSystemName').value(), 'DCM', 'ActiveParticipant1RoleIDCode: codeSystemName should have a value of "DCM"')

  const ActiveParticipant2 = xmlDoc.get('//ActiveParticipant[2]') // Destination is the PDQm supplier
  t.equals(ActiveParticipant2.attr('UserID').value(), ctx.authenticatedUser, `ActiveParticipant2: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals(ActiveParticipant2.attr('AlternativeUserID').value(), '', 'ActiveParticipant2: AlternativeUserID should have a value of ""')
  t.equals(ActiveParticipant2.attr('UserIsRequestor').value(), 'true', 'ActiveParticipant2: UserIsRequestor should have a value of ""')
  const ActiveParticipant2RoleIDCode = xmlDoc.get('//ActiveParticipant[2]/RoleIDCode')
  t.equals(ActiveParticipant2RoleIDCode.attr('csd-code').value(), '110152', 'ActiveParticipant2RoleIDCode: csd-code should have a value of "110152"')
  t.equals(ActiveParticipant2RoleIDCode.attr('originalText').value(), 'DCM', 'ActiveParticipant2RoleIDCode: originalText should have a value of "DCM"')
  t.equals(ActiveParticipant2RoleIDCode.attr('codeSystemName').value(), 'Destination', 'ActiveParticipant2RoleIDCode: codeSystemName should have a value of "Destination"')

  const AuditSourceIdentification = xmlDoc.get('//AuditSourceIdentification')
  t.equals(AuditSourceIdentification.attr('AuditEnterpriseSiteID').value(), '', 'AuditSourceIdentification: AuditEnterpriseSiteID should have a value of ""')
  t.equals(AuditSourceIdentification.attr('AuditSourceID').value(), ctx.authenticatedUser, `AuditSourceIdentification: AuditSourceID should have a value of "${ctx.authenticatedUser}"`)
  t.equals(AuditSourceIdentification.attr('code').value(), '3', 'AuditSourceIdentification: code should have a value of "3"')

  const ParticipantObjectIdentification = xmlDoc.get('//ParticipantObjectIdentification')
  t.equals(ParticipantObjectIdentification.attr('ParticipantObjectID').value(), ctx.fullUrl, `ParticipantObjectIdentification: ParticipantObjectID should have a value of "${ctx.fullUrl}"`)
  t.equals(ParticipantObjectIdentification.attr('ParticipantObjectTypeCode').value(), '2', 'ParticipantObjectIdentification: ParticipantObjectTypeCode should have a value of "2"')
  t.equals(ParticipantObjectIdentification.attr('ParticipantObjectTypeCodeRole').value(), '24', 'ParticipantObjectIdentification: ParticipantObjectTypeCodeRole should have a value of "24"')
  const ParticipantObjectIDTypeCode = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectIDTypeCode')
  t.equals(ParticipantObjectIDTypeCode.attr('csd-code').value(), 'ITI-78', 'ParticipantObjectIDTypeCode: csd-code should have a value of "ITI-78"')
  t.equals(ParticipantObjectIDTypeCode.attr('originalText').value(), 'Mobile Patient Demographics Query', 'ParticipantObjectIDTypeCode: originalText should have a value of "Mobile Patient Demographics Query"')
  t.equals(ParticipantObjectIDTypeCode.attr('codeSystemName').value(), 'IHE Transactions', 'ParticipantObjectIDTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ParticipantObjectQuery = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectQuery')
  t.equals(ctx.fullUrl, ParticipantObjectQuery.text(), 'ParticipantObjectIDTypeCode: should have a value of "Mobile Patient Demographics Query"')

  // ParticipantObjectDetail
  const ParticipantObjectDetailAuthUsername = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-username')
  t.equals(ParticipantObjectDetailAuthUsername.text(), ctx.headers['auth-username'], `ParticipantObjectDetailAuthUsername: should have a value of "${ctx.headers['auth-username']}"`)
  const ParticipantObjectDetailAuthTs = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-ts')
  t.equals(ParticipantObjectDetailAuthTs.text(), ctx.headers['auth-ts'], `ParticipantObjectDetailAuthTs: should have a value of "${ctx.headers['auth-ts']}"`)
  const ParticipantObjectDetailAuthSalt = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-salt')
  t.equals(ParticipantObjectDetailAuthSalt.text(), ctx.headers['auth-salt'], `ParticipantObjectDetailAuthSalt: should have a value of "${ctx.headers['auth-salt']}"`)
  const ParticipantObjectDetailAuthToken = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-token')
  t.equals(ParticipantObjectDetailAuthToken.text(), ctx.headers['auth-token'], `ParticipantObjectDetailAuthToken: should have a value of "${ctx.headers['auth-token']}"`)
  const ParticipantObjectDetailAuthHost = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/host')
  t.equals(ParticipantObjectDetailAuthHost.text(), ctx.headers['host'], `ParticipantObjectDetailAuthHost: should have a value of "${ctx.headers['host']}"`)
  const ParticipantObjectDetailAccept = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/accept')
  t.equals(ParticipantObjectDetailAccept.text(), ctx.headers['accept'], `ParticipantObjectDetailAccept: should have a value of "${ctx.headers['accept']}"`)

  t.end()
})
