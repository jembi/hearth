/**
* Copyright (c) 2017-present,
 Jembi Health Systems NPC.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

// These mappings are based on FHIR DSTU2
module.exports.nameToPath = {
  AllergyIntolerance: {
    patient: 'AllergyIntolerance.patient',
    recorder: 'AllergyIntolerance.recorder',
    reporter: 'AllergyIntolerance.reporter'
  },
  AuditEvent: {
    reference: 'AuditEvent.object.reference',
    participant: 'AuditEvent.participant.reference',
    patient: ['AuditEvent.object.reference',
      'AuditEvent.participant.reference']
  },
  Basic: {
    author: 'Basic.author',
    patient: 'Basic.subject',
    subject: 'Basic.subject'
  },
  Composition: {
    attester: 'Composition.attester.party',
    author: 'Composition.author',
    encounter: 'Composition.encounter',
    entry: 'Composition.section.entry',
    patient: 'Composition.subject',
    subject: 'Composition.subject'
  },
  DocumentManifest: {
    author: 'DocumentManifest.author',
    'content-ref': 'DocumentManifest.content.pReference',
    patient: 'DocumentManifest.subject',
    recipient: 'DocumentManifest.recipient',
    'related-ref': 'DocumentManifest.related.ref',
    subject: 'DocumentManifest.subject'
  },
  DocumentReference: {
    authenticator: 'DocumentReference.authenticator',
    author: 'DocumentReference.author',
    custodian: 'DocumentReference.custodian',
    encounter: 'DocumentReference.context.encounter',
    patient: 'DocumentReference.subject',
    'related-ref': 'DocumentReference.context.related.ref',
    relatesto: 'DocumentReference.context.relatedTo.target',
    subject: 'DocumentReference.subject'
  },
  Encounter: {
    'appointment': 'Encounter.appointment',
    'condition': 'Encounter.indication',
    'episodeofcare': 'Encounter.episodeOfCare',
    'incomingreferral': 'Encounter.incomingReferral',
    'indication': 'Encounter.indication',
    'location': 'Encounter.location.location',
    'part-of': 'Encounter.partOf',
    'participant': 'Encounter.participant.individual',
    'patient': 'Encounter.patient',
    'practitioner': 'Encounter.participant.individual',
    'procedure': 'Encounter.indication'
  },
  HealthcareService: {
    'location': 'HealthcareService.location',
    'organization': 'HealthcareService.organization'
  },
  Immunization: {
    'location': 'Immunization.location',
    'manufacturer': 'Immunization.manufacturer',
    'patient': 'Immunization.patient',
    'performer': 'Immunization.performer',
    'reaction': 'Immunization.reaction.detail',
    'requester': 'Immunization.requester'
  },
  Location: {
    'organization': 'Location.managingOrganization',
    'partof': 'Location.partOf'
  },
  Observation: {
    'device': 'Observation.device',
    'encounter': 'Observation.encounter',
    'patient': 'Observation.subject',
    'performer': 'Observation.performer',
    'related-target': 'Observation.related.target',
    'specimen': 'Observation.specimen',
    'subject': 'Observation.subject'
  },
  Organization: {
    'partof': 'Organization.partOf'
  },
  Patient: {
    'careprovider': 'Patient.careProvider',
    'link': 'Patient.link.other',
    'organization': 'Patient.managingOrganization'
  },
  Practitioner: {
    'location': 'Practitioner.practitionerRole.location',
    'organization': 'Practitioner.practitionerRole.managingOrganization'
  },
  PractitionerRole: {
    'location': 'PractitionerRole.location',
    'organization': 'PractitionerRole.organization',
    'practitioner': 'PractitionerRole.practitioner',
    'service': 'PractitionerRole.healthcareService'
  },
  ProcedureRequest: {
    'encounter': 'ProcedureRequest.encounter',
    'orderer': 'ProcedureRequest.orderer',
    'patient': 'ProcedureRequest.subject',
    'performer': 'ProcedureRequest.performer',
    'subject': 'ProcedureRequest.subject'
  },
  QuestionnaireResponse: {
    'author': 'QuestionnaireResponse.author',
    'encounter': 'QuestionnaireResponse.encounter',
    'patient': 'QuestionnaireResponse.subject',
    'questionnaire': 'QuestionnaireResponse.questionnaire',
    'source': 'QuestionnaireResponse.source',
    'subject': 'QuestionnaireResponse.subject'
  }
}
