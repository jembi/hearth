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

  const ActiveParticipant1 = xmlDoc.get('//ActiveParticipant[1]')
  t.equals('HEARTH', ActiveParticipant1.attr('UserID').value(), 'ActiveParticipant1: UserID should have a value of "HEARTH"')
  t.equals('', ActiveParticipant1.attr('AlternativeUserID').value(), 'ActiveParticipant1: AlternativeUserID should have a value of ""')
  t.equals('false', ActiveParticipant1.attr('UserIsRequestor').value(), 'ActiveParticipant1: UserIsRequestor should have a value of "false"')
  t.equals(ctx.fullUrl, ActiveParticipant1.attr('NetworkAccessPointID').value(), `ActiveParticipant1: NetworkAccessPointID should have a value of "${ctx.fullUrl}"`)
  t.equals('2', ActiveParticipant1.attr('NetworkAccessPointTypeCode').value(), 'ActiveParticipant1: NetworkAccessPointTypeCode should have a value of "2"')
  const ActiveParticipant1RoleIDCode = xmlDoc.get('//ActiveParticipant[1]/RoleIDCode')
  t.equals('110150', ActiveParticipant1RoleIDCode.attr('csd-code').value(), 'ActiveParticipant1RoleIDCode: csd-code should have a value of "110150"')
  t.equals('Application', ActiveParticipant1RoleIDCode.attr('originalText').value(), 'ActiveParticipant1RoleIDCode: originalText should have a value of "Application"')
  t.equals('DCM', ActiveParticipant1RoleIDCode.attr('codeSystemName').value(), 'ActiveParticipant1RoleIDCode: codeSystemName should have a value of "DCM"')

  const ActiveParticipant2 = xmlDoc.get('//ActiveParticipant[2]')
  t.equals(ctx.authenticatedUser, ActiveParticipant2.attr('UserID').value(), `ActiveParticipant2: UserID should have a value of "${ctx.authenticatedUser}"`)
  t.equals('', ActiveParticipant2.attr('AlternativeUserID').value(), 'ActiveParticipant2: AlternativeUserID should have a value of ""')
  t.equals('true', ActiveParticipant2.attr('UserIsRequestor').value(), 'ActiveParticipant2: UserIsRequestor should have a value of "true"')
  const ActiveParticipant2RoleIDCode = xmlDoc.get('//ActiveParticipant[2]/RoleIDCode')
  t.equals('110151', ActiveParticipant2RoleIDCode.attr('csd-code').value(), 'ActiveParticipant2RoleIDCode: csd-code should have a value of "110151"')
  t.equals('DCM', ActiveParticipant2RoleIDCode.attr('originalText').value(), 'ActiveParticipant2RoleIDCode: originalText should have a value of "DCM"')
  t.equals('Destination', ActiveParticipant2RoleIDCode.attr('codeSystemName').value(), 'ActiveParticipant2RoleIDCode: codeSystemName should have a value of "Destination"')

  const AuditSourceIdentification = xmlDoc.get('//AuditSourceIdentification')
  t.equals('', AuditSourceIdentification.attr('AuditEnterpriseSiteID').value(), 'AuditSourceIdentification: AuditEnterpriseSiteID should have a value of ""')
  t.equals('HEARTH', AuditSourceIdentification.attr('AuditSourceID').value(), 'AuditSourceIdentification: AuditSourceID should have a value of "HEARTH"')
  t.equals('3', AuditSourceIdentification.attr('code').value(), 'AuditSourceIdentification: code should have a value of "3"')
  t.equals('', AuditSourceIdentification.attr('codeSystemName').value(), 'AuditSourceIdentification: codeSystemName should have a value of ""')
  t.equals('', AuditSourceIdentification.attr('originalText').value(), 'AuditSourceIdentification: originalText should have a value of ""')

  const ParticipantObjectIdentification = xmlDoc.get('//ParticipantObjectIdentification')
  t.equals(ctx.fullUrl, ParticipantObjectIdentification.attr('ParticipantObjectID').value(), `ParticipantObjectIdentification: ParticipantObjectID should have a value of "${ctx.fullUrl}"`)
  t.equals('2', ParticipantObjectIdentification.attr('ParticipantObjectTypeCode').value(), 'ParticipantObjectIdentification: ParticipantObjectTypeCode should have a value of "2"')
  t.equals('24', ParticipantObjectIdentification.attr('ParticipantObjectTypeCodeRole').value(), 'ParticipantObjectIdentification: ParticipantObjectTypeCodeRole should have a value of "24"')
  const ParticipantObjectIDTypeCode = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectIDTypeCode')
  t.equals('ITI-83', ParticipantObjectIDTypeCode.attr('csd-code').value(), 'ParticipantObjectIDTypeCode: csd-code should have a value of "ITI-83"')
  t.equals('Mobile Patient Identifier Cross-reference Query', ParticipantObjectIDTypeCode.attr('originalText').value(), 'ParticipantObjectIDTypeCode: originalText should have a value of "Mobile Patient Identifier Cross-reference Query"')
  t.equals('IHE Transactions', ParticipantObjectIDTypeCode.attr('codeSystemName').value(), 'ParticipantObjectIDTypeCode: codeSystemName should have a value of "IHE Transactions"')
  const ParticipantObjectName = xmlDoc.get('//ParticipantObjectIdentification/ParticipantObjectName')
  t.equals('Mobile Patient Identifier Cross-reference Query', ParticipantObjectName.text(), 'ParticipantObjectIDTypeCode: should have a value of "Mobile Patient Identifier Cross-reference Query"')

  t.end()
})
