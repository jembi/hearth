 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
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
    patient: ['AuditEvent.object.reference', 'AuditEvent.participant.reference']
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
  }
}
