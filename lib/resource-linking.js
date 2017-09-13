 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const logger = require('winston')

const FhirCommon = require('./fhir/common')
const constants = require('./constants')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)

  const removeLinkIfExists = (resource, referenceLink) => {
    if (resource.link) {
      return resource.link.filter((link) => {
        if (link && link.other && link.other.reference) {
          return link.other.reference.indexOf(referenceLink) === -1
        } else {
          return true
        }
      })
    }
  }

  const addLinkToResource = (resource, referenceLink, linkType, matchScore) => {
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

    if (!resource.link) {
      resource.link = []
    }

    resource.link = removeLinkIfExists(resource, referenceLink)

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

  const addLinkToMatchAndUpdate = (match, resource, linkType) => {
    return new Promise((resolve, reject) => {
      const matchLink = `${resource.resourceType}/${resource.id}`
      const linkedResource = addLinkToResource(match, matchLink, linkType, match._mpi.search.score)
      updateResource(linkedResource, createPromiseErrHandlerForCallback(resolve, reject))
    })
  }

  const addLinkToMatches = (matchesArray, resource, callback) => {
    logger.debug('Processing matched results for linking')

    const promises = []
    matchesArray.forEach((match) => {
      switch (match._mpi.search.extension.valueCode) {
        case 'certain':
          promises.push(addLinkToMatchAndUpdate(match, resource, constants.LINK_TYPE_CERTAIN_DUPLICATE_SOURCE))
          break
        case 'probable':
          promises.push(addLinkToMatchAndUpdate(match, resource, constants.LINK_TYPE_PROBABLE_DUPLICATE_SOURCE))
          break
        case 'possible':
          promises.push(addLinkToMatchAndUpdate(match, resource, constants.LINK_TYPE_POSSIBLE_DUPLICATE_SOURCE))
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

  const addMatchesLinksToResource = (matchesArray, resource, callback) => {
    matchesArray.forEach((match) => {
      const matchLink = `${match.resourceType}/${match.id}`
      switch (match._mpi.search.extension.valueCode) {
        case 'certain':
          addLinkToResource(resource, matchLink, constants.LINK_TYPE_CERTAIN_DUPLICATE_TARGET, match._mpi.search.score)
          break
        case 'probable':
          addLinkToResource(resource, matchLink, constants.LINK_TYPE_PROBABLE_DUPLICATE_TARGET, match._mpi.search.score)
          break
        case 'possible':
          addLinkToResource(resource, matchLink, constants.LINK_TYPE_POSSIBLE_DUPLICATE_TARGET, match._mpi.search.score)
          break
        default: // ignore
      }
    })

    updateResource(resource, callback)
  }

  const removePreviousMatchingLinks = (resource, callback) => {
    const matchLink = `${resource.resourceType}/${resource.id}`

    const linksToRemove = []
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      const c = db.collection(resource.resourceType)
      c.find({ 'link.other.reference': matchLink }, { id: 1, resourceType: 1 }).toArray((err, matches) => {
        if (err) {
          return callback(err)
        }

        if (matches.length === 0) {
          return callback(null, resource)
        }

        const promises = matches.map((match) => {
          linksToRemove.push(`${match.resourceType}/${match.id}`)
          match.link = removeLinkIfExists(match, matchLink)
          return new Promise((resolve, reject) => {
            updateResource(match, createPromiseErrHandlerForCallback(resolve, reject))
          })
        })

        Promise.all(promises).then(() => {
          linksToRemove.forEach((link) => {
            resource.link = removeLinkIfExists(resource, link)
          })
          callback(null, resource)
        }).catch(err => {
          callback(err)
        })
      })
    })
  }

  return {
    addLinkToResource: addLinkToResource,
    addLinkToMatches: addLinkToMatches,
    addMatchesLinksToResource: addMatchesLinksToResource,
    removePreviousMatchingLinks: removePreviousMatchingLinks
  }
}
