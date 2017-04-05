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

  t.ok(xmlDoc.errors)

  const EventIdentification = xmlDoc.get('//EventIdentification')
  t.equals('E', EventIdentification.attr('EventActionCode').value(), 'EventIdentification: EventActionCode should have a value of "E"')
  t.equals('0', EventIdentification.attr('EventOutcomeIndicator').value(), 'EventIdentification: EventOutcomeIndicator should have a value of "0"')
  const EventIdentificationEventID = xmlDoc.get('//EventIdentification/EventID')
  t.equals('110112', EventIdentificationEventID.attr('csd-code').value(), 'EventIdentificationEventID: csd-code should have a value of "110112"')
  t.equals('Query', EventIdentificationEventID.attr('originalText').value(), 'EventIdentificationEventID: originalText should have a value of "Query"')
  t.equals('DCM', EventIdentificationEventID.attr('codeSystemName').value(), 'EventIdentificationEventID: codeSystemName should have a value of "DCM"')
  const EventIdentificationEventTypeCode = xmlDoc.get('//EventIdentification/EventTypeCode')
  t.equals('ITI-83', EventIdentificationEventTypeCode.attr('csd-code').value(), 'EventIdentificationEventTypeCode: csd-code should have a value of "ITI-83"')
  t.equals('Mobile Patient Identifier Cross-reference Query', EventIdentificationEventTypeCode.attr('originalText').value(), 'EventIdentificationEventTypeCode: originalText should have a value of "Mobile Patient Identifier Cross-reference Query"')
  t.equals('IHE Transactions', EventIdentificationEventTypeCode.attr('codeSystemName').value(), 'EventIdentificationEventTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ActiveParticipant1 = xmlDoc.get('//ActiveParticipant[1]')  // Source is the PIXm consumer
  t.equals(ctx.authenticatedUser, ActiveParticipant1.attr('UserID').value(), `ActiveParticipant1: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals('', ActiveParticipant1.attr('AlternativeUserID').value(), 'ActiveParticipant1: AlternativeUserID should have a value of ""')
  t.equals('', ActiveParticipant1.attr('UserIsRequestor').value(), 'ActiveParticipant1: UserIsRequestor should have a value of ""')
  t.equals(ctx.requestorIp, ActiveParticipant1.attr('NetworkAccessPointID').value(), `ActiveParticipant1: NetworkAccessPointID should have a value of "${ctx.requestorIp}"`)
  t.equals('2', ActiveParticipant1.attr('NetworkAccessPointTypeCode').value(), 'ActiveParticipant1: NetworkAccessPointTypeCode should have a value of "2"')
  const ActiveParticipant1RoleIDCode = xmlDoc.get('//ActiveParticipant[1]/RoleIDCode')
  t.equals('110153', ActiveParticipant1RoleIDCode.attr('csd-code').value(), 'ActiveParticipant1RoleIDCode: csd-code should have a value of "110153"')
  t.equals('Source', ActiveParticipant1RoleIDCode.attr('originalText').value(), 'ActiveParticipant1RoleIDCode: originalText should have a value of "Application"')
  t.equals('DCM', ActiveParticipant1RoleIDCode.attr('codeSystemName').value(), 'ActiveParticipant1RoleIDCode: codeSystemName should have a value of "DCM"')

  const ActiveParticipant2 = xmlDoc.get('//ActiveParticipant[2]') // Destination is the PIXm manager
  t.equals('HEARTH', ActiveParticipant2.attr('UserID').value(), 'ActiveParticipant2: UserID should have a value of "HEARTH"')
  t.equals('', ActiveParticipant2.attr('AlternativeUserID').value(), 'ActiveParticipant2: AlternativeUserID should have a value of ""')
  t.equals('', ActiveParticipant2.attr('UserIsRequestor').value(), 'ActiveParticipant2: UserIsRequestor should have a value of ""')
  t.equals(ctx.fullUrl, ActiveParticipant2.attr('NetworkAccessPointID').value(), `ActiveParticipant2: NetworkAccessPointID should have a value of "${ctx.fullUrl}"`)
  t.equals('1', ActiveParticipant2.attr('NetworkAccessPointTypeCode').value(), 'ActiveParticipant2: NetworkAccessPointTypeCode should have a value of "1"')
  const ActiveParticipant2RoleIDCode = xmlDoc.get('//ActiveParticipant[2]/RoleIDCode')
  t.equals('110152', ActiveParticipant2RoleIDCode.attr('csd-code').value(), 'ActiveParticipant2RoleIDCode: csd-code should have a value of "110152"')
  t.equals('DCM', ActiveParticipant2RoleIDCode.attr('originalText').value(), 'ActiveParticipant2RoleIDCode: originalText should have a value of "DCM"')
  t.equals('Destination', ActiveParticipant2RoleIDCode.attr('codeSystemName').value(), 'ActiveParticipant2RoleIDCode: codeSystemName should have a value of "Destination"')

  const AuditSourceIdentification = xmlDoc.get('//AuditSourceIdentification')
  t.equals('', AuditSourceIdentification.attr('AuditEnterpriseSiteID').value(), 'AuditSourceIdentification: AuditEnterpriseSiteID should have a value of ""')
  t.equals('HEARTH', AuditSourceIdentification.attr('AuditSourceID').value(), 'AuditSourceIdentification: AuditSourceID should have a value of "HEARTH"')
  t.equals('', AuditSourceIdentification.attr('AuditSourceTypeCode').value(), 'AuditSourceIdentification: code should have a value of ""')

  const ParticipantObjectIdentification = xmlDoc.get('//ParticipantObjectIdentification')
  t.equals(ctx.fullUrl, ParticipantObjectIdentification.attr('ParticipantObjectID').value(), `ParticipantObjectIdentification: ParticipantObjectID should have a value of "${ctx.fullUrl}"`)
  t.equals('2', ParticipantObjectIdentification.attr('ParticipantObjectTypeCode').value(), 'ParticipantObjectIdentification: ParticipantObjectTypeCode should have a value of "2"')
  t.equals('24', ParticipantObjectIdentification.attr('ParticipantObjectTypeCodeRole').value(), 'ParticipantObjectIdentification: ParticipantObjectTypeCodeRole should have a value of "24"')
  const ParticipantObjectIDTypeCode = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectIDTypeCode')
  t.equals('ITI-83', ParticipantObjectIDTypeCode.attr('csd-code').value(), 'ParticipantObjectIDTypeCode: csd-code should have a value of "ITI-83"')
  t.equals('Mobile Patient Identifier Cross-reference Query', ParticipantObjectIDTypeCode.attr('originalText').value(), 'ParticipantObjectIDTypeCode: originalText should have a value of "Mobile Patient Identifier Cross-reference Query"')
  t.equals('IHE Transactions', ParticipantObjectIDTypeCode.attr('codeSystemName').value(), 'ParticipantObjectIDTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ParticipantObjectQuery = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectQuery')
  t.equals(ctx.fullUrl, ParticipantObjectQuery.text(), `ParticipantObjectQuery: should have a value of "${ctx.fullUrl}"`)

  // ParticipantObjectDetail
  const ParticipantObjectDetailAuthUsername = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-username')
  t.equals(ctx.headers['auth-username'], ParticipantObjectDetailAuthUsername.text(), `ParticipantObjectDetailAuthUsername: should have a value of "${ctx.headers['auth-username']}"`)
  const ParticipantObjectDetailAuthTs = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-ts')
  t.equals(ctx.headers['auth-ts'], ParticipantObjectDetailAuthTs.text(), `ParticipantObjectDetailAuthTs: should have a value of "${ctx.headers['auth-ts']}"`)
  const ParticipantObjectDetailAuthSalt = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-salt')
  t.equals(ctx.headers['auth-salt'], ParticipantObjectDetailAuthSalt.text(), `ParticipantObjectDetailAuthSalt: should have a value of "${ctx.headers['auth-salt']}"`)
  const ParticipantObjectDetailAuthToken = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-token')
  t.equals(ctx.headers['auth-token'], ParticipantObjectDetailAuthToken.text(), `ParticipantObjectDetailAuthToken: should have a value of "${ctx.headers['auth-token']}"`)
  const ParticipantObjectDetailAuthHost = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/host')
  t.equals(ctx.headers['host'], ParticipantObjectDetailAuthHost.text(), `ParticipantObjectDetailAuthHost: should have a value of "${ctx.headers['host']}"`)
  const ParticipantObjectDetailAccept = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/accept')
  t.equals(ctx.headers['accept'], ParticipantObjectDetailAccept.text(), `ParticipantObjectDetailAccept: should have a value of "${ctx.headers['accept']}"`)

  t.end()
})

tap.test('ATNA Audit - should construct a valid ATNA audit PDQm message', (t) => {
  const ctx = {
    domain: 'http://localhost:3447/fhir',
    authenticatedUser: 'sysadmin',
    fullUrl: 'http://localhost:3447/fhir',
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

  t.ok(xmlDoc.errors)

  const EventIdentification = xmlDoc.get('//EventIdentification')
  t.equals('E', EventIdentification.attr('EventActionCode').value(), 'EventIdentification: EventActionCode should have a value of "E"')
  t.equals('0', EventIdentification.attr('EventOutcomeIndicator').value(), 'EventIdentification: EventOutcomeIndicator should have a value of "0"')
  const EventIdentificationEventID = xmlDoc.get('//EventIdentification/EventID')
  t.equals('110112', EventIdentificationEventID.attr('csd-code').value(), 'EventIdentificationEventID: csd-code should have a value of "110112"')
  t.equals('Query', EventIdentificationEventID.attr('originalText').value(), 'EventIdentificationEventID: originalText should have a value of "Query"')
  t.equals('DCM', EventIdentificationEventID.attr('codeSystemName').value(), 'EventIdentificationEventID: codeSystemName should have a value of "DCM"')
  const EventIdentificationEventTypeCode = xmlDoc.get('//EventIdentification/EventTypeCode')
  t.equals('ITI-78', EventIdentificationEventTypeCode.attr('csd-code').value(), 'EventIdentificationEventTypeCode: csd-code should have a value of "ITI-78"')
  t.equals('Mobile Patient Demographics Query', EventIdentificationEventTypeCode.attr('originalText').value(), 'EventIdentificationEventTypeCode: originalText should have a value of "Mobile Patient Demographics Query"')
  t.equals('IHE Transactions', EventIdentificationEventTypeCode.attr('codeSystemName').value(), 'EventIdentificationEventTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ActiveParticipant1 = xmlDoc.get('//ActiveParticipant[1]')  // Source is the PDQm consumer
  t.equals(ctx.authenticatedUser, ActiveParticipant1.attr('UserID').value(), `ActiveParticipant1: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals('', ActiveParticipant1.attr('AlternativeUserID').value(), 'ActiveParticipant1: AlternativeUserID should have a value of ""')
  t.equals('', ActiveParticipant1.attr('UserIsRequestor').value(), 'ActiveParticipant1: UserIsRequestor should have a value of ""')
  t.equals(ctx.requestorIp, ActiveParticipant1.attr('NetworkAccessPointID').value(), `ActiveParticipant1: NetworkAccessPointID should have a value of "${ctx.requestorIp}"`)
  t.equals('2', ActiveParticipant1.attr('NetworkAccessPointTypeCode').value(), 'ActiveParticipant1: NetworkAccessPointTypeCode should have a value of "2"')
  const ActiveParticipant1RoleIDCode = xmlDoc.get('//ActiveParticipant[1]/RoleIDCode')
  t.equals('110153', ActiveParticipant1RoleIDCode.attr('csd-code').value(), 'ActiveParticipant1RoleIDCode: csd-code should have a value of "110153"')
  t.equals('Source', ActiveParticipant1RoleIDCode.attr('originalText').value(), 'ActiveParticipant1RoleIDCode: originalText should have a value of "Application"')
  t.equals('DCM', ActiveParticipant1RoleIDCode.attr('codeSystemName').value(), 'ActiveParticipant1RoleIDCode: codeSystemName should have a value of "DCM"')

  const ActiveParticipant2 = xmlDoc.get('//ActiveParticipant[2]') // Destination is the PDQm supplier
  t.equals('HEARTH', ActiveParticipant2.attr('UserID').value(), 'ActiveParticipant2: UserID should have a value of "HEARTH"')
  t.equals('', ActiveParticipant2.attr('AlternativeUserID').value(), 'ActiveParticipant2: AlternativeUserID should have a value of ""')
  t.equals('', ActiveParticipant2.attr('UserIsRequestor').value(), 'ActiveParticipant2: UserIsRequestor should have a value of ""')
  t.equals(ctx.fullUrl, ActiveParticipant2.attr('NetworkAccessPointID').value(), `ActiveParticipant2: NetworkAccessPointID should have a value of "${ctx.fullUrl}"`)
  t.equals('1', ActiveParticipant2.attr('NetworkAccessPointTypeCode').value(), 'ActiveParticipant2: NetworkAccessPointTypeCode should have a value of "1"')
  const ActiveParticipant2RoleIDCode = xmlDoc.get('//ActiveParticipant[2]/RoleIDCode')
  t.equals('110152', ActiveParticipant2RoleIDCode.attr('csd-code').value(), 'ActiveParticipant2RoleIDCode: csd-code should have a value of "110152"')
  t.equals('DCM', ActiveParticipant2RoleIDCode.attr('originalText').value(), 'ActiveParticipant2RoleIDCode: originalText should have a value of "DCM"')
  t.equals('Destination', ActiveParticipant2RoleIDCode.attr('codeSystemName').value(), 'ActiveParticipant2RoleIDCode: codeSystemName should have a value of "Destination"')

  const AuditSourceIdentification = xmlDoc.get('//AuditSourceIdentification')
  t.equals('', AuditSourceIdentification.attr('AuditEnterpriseSiteID').value(), 'AuditSourceIdentification: AuditEnterpriseSiteID should have a value of ""')
  t.equals('HEARTH', AuditSourceIdentification.attr('AuditSourceID').value(), 'AuditSourceIdentification: AuditSourceID should have a value of "HEARTH"')
  t.equals('', AuditSourceIdentification.attr('AuditSourceTypeCode').value(), 'AuditSourceIdentification: code should have a value of ""')

  const ParticipantObjectIdentification = xmlDoc.get('//ParticipantObjectIdentification')
  t.equals(ctx.fullUrl, ParticipantObjectIdentification.attr('ParticipantObjectID').value(), `ParticipantObjectIdentification: ParticipantObjectID should have a value of "${ctx.fullUrl}"`)
  t.equals('2', ParticipantObjectIdentification.attr('ParticipantObjectTypeCode').value(), 'ParticipantObjectIdentification: ParticipantObjectTypeCode should have a value of "2"')
  t.equals('24', ParticipantObjectIdentification.attr('ParticipantObjectTypeCodeRole').value(), 'ParticipantObjectIdentification: ParticipantObjectTypeCodeRole should have a value of "24"')
  const ParticipantObjectIDTypeCode = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectIDTypeCode')
  t.equals('ITI-78', ParticipantObjectIDTypeCode.attr('csd-code').value(), 'ParticipantObjectIDTypeCode: csd-code should have a value of "ITI-78"')
  t.equals('Mobile Patient Demographics Query', ParticipantObjectIDTypeCode.attr('originalText').value(), 'ParticipantObjectIDTypeCode: originalText should have a value of "Mobile Patient Demographics Query"')
  t.equals('IHE Transactions', ParticipantObjectIDTypeCode.attr('codeSystemName').value(), 'ParticipantObjectIDTypeCode: codeSystemName should have a value of "IHE Transactions"')

  const ParticipantObjectQuery = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectQuery')
  t.equals(ctx.fullUrl, ParticipantObjectQuery.text(), 'ParticipantObjectIDTypeCode: should have a value of "Mobile Patient Demographics Query"')

  // ParticipantObjectDetail
  const ParticipantObjectDetailAuthUsername = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-username')
  t.equals(ctx.headers['auth-username'], ParticipantObjectDetailAuthUsername.text(), `ParticipantObjectDetailAuthUsername: should have a value of "${ctx.headers['auth-username']}"`)
  const ParticipantObjectDetailAuthTs = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-ts')
  t.equals(ctx.headers['auth-ts'], ParticipantObjectDetailAuthTs.text(), `ParticipantObjectDetailAuthTs: should have a value of "${ctx.headers['auth-ts']}"`)
  const ParticipantObjectDetailAuthSalt = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-salt')
  t.equals(ctx.headers['auth-salt'], ParticipantObjectDetailAuthSalt.text(), `ParticipantObjectDetailAuthSalt: should have a value of "${ctx.headers['auth-salt']}"`)
  const ParticipantObjectDetailAuthToken = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/auth-token')
  t.equals(ctx.headers['auth-token'], ParticipantObjectDetailAuthToken.text(), `ParticipantObjectDetailAuthToken: should have a value of "${ctx.headers['auth-token']}"`)
  const ParticipantObjectDetailAuthHost = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/host')
  t.equals(ctx.headers['host'], ParticipantObjectDetailAuthHost.text(), `ParticipantObjectDetailAuthHost: should have a value of "${ctx.headers['host']}"`)
  const ParticipantObjectDetailAccept = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectDetail/accept')
  t.equals(ctx.headers['accept'], ParticipantObjectDetailAccept.text(), `ParticipantObjectDetailAccept: should have a value of "${ctx.headers['accept']}"`)

  t.end()
})
