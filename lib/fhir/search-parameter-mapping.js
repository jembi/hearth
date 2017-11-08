exports.nameToPath = {
  AllergyIntolerance: {
    patient: 'AllergyIntolerance.patient',
    recorder: 'AllergyIntolerance.recorder'
  },
  AuditEvent: {
    agent: 'AuditEvent.agent.reference',
    entity: 'AuditEvent.entity.reference',
    patient: ['AuditEvent.agent.reference', 'AuditEvent.entity.reference']
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
    'related-ref': 'Composition.relatesTo.target.as(Reference)', // This doesn't look right
    subject: 'Composition.subject'
  },
  DocumentManifest: {
    author: 'DocumentManifest.author',
    'content-ref': 'DocumentManifest.content.p.as(Reference)',
    patient: 'DocumentManifest.subject',
    recipient: 'DocumentManifest.recipient',
    'related-ref': 'DocumentManifest.related.ref',
    subject: 'DocumentManifest.subject'
  },
  DocumentReference: {
    authenticator: 'DocumentReference.authenticator',
    author: 'DocumentReference.author',
    custodian: 'DocumentReference.custodian',
    encounter: 'DocumentReference.context.encounter'
  }
}
