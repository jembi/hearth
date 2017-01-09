'use strict'

module.exports = (mongo) => {
  return {
    allowedResourceTypes: [
      {
        resourceType: 'Patient',
        interactions: '*'
      }, {
        resourceType: 'Practitioner',
        interactions: '*'
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
        interactions: '*'
      }
    ]
  }
}
