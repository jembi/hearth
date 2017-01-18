'use strict'

module.exports = (mongo) => {
  return {
    allowedResourceTypes: [
      {
        resourceType: 'Patient',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Practitioner',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Organization',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Location',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Encounter',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Questionnaire',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'AllergyIntolerance',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Procedure',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'ProcedureRequest',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'Questionnaire',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'QuestionnaireResponse',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'DocumentManifest',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'user',
        interactions: '*',
        searchAllAllowed: true
      }
    ],

    // N/A as the sysadmin can anyway access all
    allowBreakTheGlass: false
  }
}
