'use strict'

const logger = require('winston')

const FhirCommon = require('./fhir/common')
const constants = require('./constants')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)

  const linkResource = (resource, referenceLink, linkType, matchScore) => {
    logger.debug('Processing resource to be updated with reference link')

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
      throw new Error(`Linking reference already exist in resource: ${resource.id}`)
    }

    resource.link.push(linkObj)
    return resource
  }

  const updateResource = (resource, callback) => {
    const resourceType = resource.resourceType

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
      c.findOneAndReplace({ id: resource.id }, resource, options, (err, result) => {
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

  const createPromiseErrHandlerForCallback = (resolve, reject) => {
    return (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    }
  }

  const addLinkReferenceToMatches = (matchesBundleEntries, resource, callback) => {
    logger.debug('Processing matched results for linking')

    const promises = []
    matchesBundleEntries.forEach((matchEntry) => {
      switch (matchEntry.search.extension.valueCode) {
        case 'certain':
          promises.push(linkMatchToResourceAndUpdate(matchEntry, resource, constants.LINK_TYPE_CERTAIN_DUPLICATE_SOURCE))
          break
        case 'probable':
          promises.push(linkMatchToResourceAndUpdate(matchEntry, resource, constants.LINK_TYPE_PROBABLE_DUPLICATE_SOURCE))
          break
        case 'possible':
          promises.push(linkMatchToResourceAndUpdate(matchEntry, resource, constants.LINK_TYPE_POSSIBLE_DUPLICATE_SOURCE))
          break
        default: // ignore
      }
    })

    Promise.all(promises).then(() => {
      callback()
    }).catch(reason => {
      callback(reason)
    })
  }

  const linkMatchToResourceAndUpdate = (matchEntry, resource, linkType) => {
    return new Promise((resolve, reject) => {
      const matchLink = `${resource.resourceType}/${resource.id}`
      try {
        const resource = linkResource(matchEntry.resource, matchLink, linkType, matchEntry.search.score)
        updateResource(resource, createPromiseErrHandlerForCallback(resolve, reject))
      } catch (err) {
        logger.debug(err)
        resolve() // ignore error where the link already exists
      }
    })
  }

  const linkMatchToResource = (matchEntry, resource, linkType) => {
    return new Promise((resolve, reject) => {
      const matchLink = `${matchEntry.resource.resourceType}/${matchEntry.resource.id}`
      try {
        linkResource(resource, matchLink, linkType, matchEntry.search.score, createPromiseErrHandlerForCallback(resolve, reject))
      } catch (err) {
        logger.debug(err)
        resolve() // ignore error where the link already exists
      }
    })
  }

  const addMatchesLinksToResource = (matchBundleEntries, resource, callback) => {
    matchBundleEntries.forEach((matchEntry) => {
      switch (matchEntry.search.extension.valueCode) {
        case 'certain':
          linkMatchToResource(matchEntry, resource, constants.LINK_TYPE_CERTAIN_DUPLICATE_TARGET)
          break
        case 'probable':
          linkMatchToResource(matchEntry, resource, constants.LINK_TYPE_PROBABLE_DUPLICATE_TARGET)
          break
        case 'possible':
          linkMatchToResource(matchEntry, resource, constants.LINK_TYPE_POSSIBLE_DUPLICATE_TARGET)
          break
        default: // ignore
      }
    })

    updateResource(resource, callback)
  }

  return {
    linkResource: linkResource,
    addLinkReferenceToMatches: addLinkReferenceToMatches,
    addMatchesLinksToResource: addMatchesLinksToResource
  }
}
