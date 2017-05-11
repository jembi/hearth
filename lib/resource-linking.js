'use strict'

const logger = require('winston')

const FhirCommon = require('./fhir/common')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)

  const linkResource = (resource, referenceLink, linkType, matchScore, callback) => {
    logger.debug('Processing resource to be updated with reference link')

    const resourceId = resource.id
    const resourceType = resource.resourceType

    const linkObj = {
      other: {
        reference: referenceLink
      },
      type: linkType,
      extension: [{
        url: 'http://hearth.org/link-matching-score',
        valueDecimal: matchScore
      }]
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
          return callback(new Error('Could not find resource to link to'))
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

    const createPromiseHandlerFunc = (resolve, reject) => {
      return (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      }
    }

    const promises = []
    resources.forEach((resource) => {
      if (resource.search.extension.valueCode === 'certain') {
        promises.push(new Promise((resolve, reject) => {
          linkResource(resource.resource, referenceLink, 'replaces', resource.search.score, createPromiseHandlerFunc(resolve, reject))
        }))
      }
      if (resource.search.extension.valueCode === 'probable') {
        promises.push(new Promise((resolve, reject) => {
          linkResource(resource.resource, referenceLink, 'probable-duplicate', resource.search.score, createPromiseHandlerFunc(resolve, reject))
        }))
      }
    })

    Promise.all(promises).then(() => {
      callback()
    }).catch(reason => {
      callback(reason)
    })
  }

  return {
    linkResource: linkResource,
    addLinkReferenceToMatches: addLinkReferenceToMatches
  }
}
