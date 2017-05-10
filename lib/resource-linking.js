'use strict'

const logger = require('winston')

const FhirCommon = require('./fhir/common')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)

  const linkResource = (resource, referenceLink, callback) => {
    logger.debug('Processing resource to be updated with reference link')

    const resourceId = resource.id
    const resourceType = resource.resourceType

    const linkObj = {
      'other': {
        'reference': referenceLink
      },
      'type': 'refer'
    }

    // add link to matched resource
    if (!resource.link) {
      resource.link = []
    }

    const linkAlreadyExists = (element, index, array) => {
      return element.other.reference === referenceLink
    }
    if (resource.link.some(linkAlreadyExists)) {
      logger.debug(`Linking reference already exist in resource: ${resourceId}`)
      return callback()
    }

    resource.link.push(linkObj)

    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      fhirCommon.touchResource(resource)

      // metadata required for history
      resource._request.method = 'PUT'

      resource.meta.versionId = fhirCommon.util.generateID()

      const options = {
        returnOriginal: true
      }

      const c = db.collection(resourceType)
      c.findOneAndReplace({ id: resourceId }, resource, options, (err, result) => {
        if (err) {
          return callback(err)
        }

        if (!result.value) {
          return callback(null, 'Not found')
        }

        delete result.value._id

        const cHistory = db.collection(`${resourceType}_history`)
        cHistory.insert(result.value, (err) => {
          if (err) {
            return callback(err)
          }

          callback()
        })
      })
    })
  }

  const addLinkReferenceToMatches = (resources, referenceLink, callback) => {
    logger.debug('Processing matched results for linking')

    const promises = []
    resources.forEach((obj) => {
      if (['certain', 'probable'].indexOf(obj.search.extension.valueCode) !== -1) {
        promises.push(new Promise((resolve, reject) => {
          linkResource(obj.resource, referenceLink, (err, result) => {
            if (err) {
              return reject(err)
            }

            resolve()
          })
        }))
      }
    })

    Promise.all(promises).then(() => {
      callback()
    }).catch(reason => {
      callback(reason, null)
    })
  }

  return {
    linkResource: linkResource,
    addLinkReferenceToMatches: addLinkReferenceToMatches
  }
}
