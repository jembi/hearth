'use strict'

const FhirCommon = require('./common')

module.exports = (mongo) => {

  function linkResource (resourceReferenceToLink, resourceIdToAddLink, resourceType, callback) {
  
    console.log(resourceReferenceToLink)
    console.log(resourceIdToAddLink)
    console.log(resourceType)

    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      fhirCommon.touchResource(resource)

      // metadata required for history
      resource._request.method = 'PUT'

      resource.meta.versionId = fhirCommon.util.generateID()

      const options = {
        upsert: false, // TODO OHIE-168
        returnOriginal: true
      }

      const c = db.collection(resourceType)
      c.findOneAndReplace({ id: resourceIdToAddLink }, resource, options, (err, result) => {
        if (err) {
          return callback(err)
        }

        if (!result.value) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }

        delete result.value._id

        const cHistory = db.collection(`${resourceType}_history`)
        cHistory.insert(result.value, (err) => {
          if (err) {
            return callback(err)
          }
          
          callback(null, 'Patient Updated')
        })
      })
    })


  }


  return {
    linkResource: linkResource
  }
}