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
        resourceType: 'Questionnaire',
        interactions: '*',
        searchAllAllowed: true
      }, {
        resourceType: 'user',
        interactions: '*',
        searchAllAllowed: true
      }
    ]
  }
}
