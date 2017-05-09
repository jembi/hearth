'use strict'

const logger = require('winston')

const FhirCommon = require('./fhir/common')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)

  const linkResource = (resource, referenceLink, callback) => {
    logger.debug('Processing resource to be updated with reference link')

    const resourceId = resource.id
    const resourceType = resource.resourceType

    let linkObj = {
      'other': {
        'reference': referenceLink
      },
      'type': 'refer'
    }

    // add link to matched resource
    if (!resource.link) {
      resource.link = []
    }

    function linkAlreadyExists (element, index, array) {
      return element.other.reference === referenceLink
    }
    if (resource.link.some(linkAlreadyExists)) {
      logger.debug(`Linking reference already exist in resource: ${resourceId}`)
      return callback(null, null)
    }

    resource.link.push(linkObj)

    mongo.getDB((err, db) => {
      if (err) {
        return callback(err, null)
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
      c.findOneAndReplace({ id: resourceId }, resource, options, (err, result) => {
        if (err) {
          return callback(err, null)
        }

        if (!result.value) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }

        delete result.value._id

        const cHistory = db.collection(`${resourceType}_history`)
        cHistory.insert(result.value, (err) => {
          if (err) {
            return callback(err, null)
          }

          callback(null, null)
        })
      })
    })
  }

  const processLinkResourcesArray = (resources, referenceLink, callback) => {
    logger.debug('Processing matched results for linking')

    let promises = []
    resources.forEach((obj) => {
      if (['certain', 'probable'].indexOf(obj.search.extension.valueCode) !== -1) {
        let promise = new Promise((resolve, reject) => {
          linkResource(obj.resource, referenceLink, (err, result) => {
            if (err) {
              reject(err)
            }

            resolve(obj.resource.id)
          })
        })
        promises.push(promise)
      }
    })

    Promise.all(promises).then(values => {
      callback(null, null, 'success')
    }).catch(reason => {
      callback(reason, null)
    })
  }

  return {
    linkResource: linkResource,
    processLinkResourcesArray: processLinkResourcesArray
  }
}
