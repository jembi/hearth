 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const moment = require('moment')
const URI = require('urijs')
const Uuid1 = require('uuid/v1')
const Uuid4 = require('uuid/v4')

const config = require('../config')

const dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZ'

function buildOperationOutcome (severity, code, detailsText) {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: severity,
        code: code,
        details: {
          text: detailsText
        }
      }
    ]
  }
}

module.exports = exports = (mongo) => {
  const formatResource = (resource) => {
    delete resource._id
    delete resource._transforms
    delete resource._request
    delete resource._mpi
    return resource
  }

  const validateID = (id) => /^[A-Za-z0-9-.]{1,64}$/.test(id)

  const isValidReferenceString = (ref) => {
    const spl = ref.split('/')
    return spl.length === 2 && validateID(spl[1])
  }

  const buildHTTPOutcome = (httpStatus, severity, code, detailsText) => {
    return {
      httpStatus: httpStatus,
      resource: buildOperationOutcome(severity, code, detailsText)
    }
  }

  const lookupResource = (resource, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      const resourceType = resource.split('/')[0]
      const c = db.collection(resourceType)
      c.findOne({id: resource.split('/')[1]}, (err, result) => {
        callback(err, result)
      })
    })
  }

  const lookupPractitionersForOrganization = (organization, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      const c = db.collection('Practitioner')
      const query = {
        practitionerRole: {
          $elemMatch: {
            'managingOrganization.reference': organization
          }
        }
      }

      mongo.util.debugLog('Practitioner', 'find', query)

      c.find(query).project({id: 1}).toArray((err, results) => {
        if (err) {
          return callback(err)
        }
        callback(null, results.map((r) => `Practitioner/${r.id}`))
      })
    })
  }

  const addSecurityLabel = (doc, system, code, display) => {
    if (!doc.meta) {
      doc.meta = {}
    }
    if (!doc.meta.security) {
      doc.meta.security = []
    }
    doc.meta.security.push({
      system: system,
      code: code,
      display: display
    })
  }

  const generateID = () => {
    const generator = config.getConf('idGenerator')
    if (generator === 'uuidv1') {
      return Uuid1()
    } else if (generator === 'uuidv4') {
      return Uuid4()
    }

    throw new Error(`Unknown ID generator '${generator}'. Valid options are 'uuidv1' or 'uuidv4'`)
  }

  return {
    // Common JSDoc definitions
    /**
     * FHIR interaction outcome
     * @typedef {Object} Outcome
     * @param {Number} httpStatus An applicable http status code
     * @param {Object} resource A FHIR resource
     * @param {String} [location] The location of the resource
     * @param {String} [id] The id of the acted upon resource
     */
    // end jsdoc

    formatResource: formatResource,

    bundleResults: (type, entries, total, callingUrl) => {
      const url = URI(callingUrl)
      return {
        resourceType: 'Bundle',
        id: generateID(),
        meta: {
          lastUpdated: moment().format(dateFormat)
        },
        type: type,
        total: ((total !== null) ? total : entries.length),
        link: [
          {
            relation: 'self',
            url: `${config.getConf('server:publicFhirBase')}/${url.segment(-1)}${url.search()}`
          }
        ],
        entry: entries.map((entry) => {
          let search
          if (entry._mpi) {
            search = entry._mpi.search
          }
          const ret = {
            fullUrl: `${config.getConf('server:publicFhirBase')}/${entry.resourceType}/${entry.id}`,
            resource: entry
          }

          if (search) {
            ret.search = search
          }
          return ret
        })
      }
    },

    addBundleLinkNext: (bundle, callingUrl, offset, count) => {
      const url = URI(callingUrl).setSearch('_getpagesoffset', offset).setSearch('_count', count)
      bundle.link.push({
        relation: 'next',
        url: `${config.getConf('server:publicFhirBase')}/${url.segment(-1)}${url.search()}`
      })
    },

    buildOperationOutcome: buildOperationOutcome,
    buildHTTPOutcome: buildHTTPOutcome,
    internalServerErrorOutcome: () => buildOperationOutcome('fatal', 'exception', 'Internal server error'),

    isValidReferenceString: isValidReferenceString,

    /**
     * Extracts an attachment from a document and stores it seperately, removing it from the document
     *
     * At the moment it just supports photo data, e.g. for patient and practitioner
     *
     * TODO OHIE-203
     */
    referenceAttachment: (doc, callback) => {
      if (doc.photo && doc.photo.length > 0 && doc.photo[0].data) {
        mongo.getDB((err, db) => {
          if (err) {
            return callback(err)
          }

          const cAttach = db.collection('attachmentData')
          cAttach.insertOne({data: doc.photo[0].data}, (err, r) => {
            if (err) {
              return callback(err)
            }
            doc.photo[0]._dataRef = r.insertedId
            delete doc.photo[0].data
            callback()
          })
        })
      } else {
        callback()
      }
    },

    /**
     * Retrieves a referenced attachment for a document and embeds it
     */
    dereferenceAttachment: (doc, callback) => {
      if (doc.photo && doc.photo.length > 0 && doc.photo[0]._dataRef) {
        mongo.getDB((err, db) => {
          if (err) {
            return callback(err)
          }

          const cAttach = db.collection('attachmentData')
          cAttach.findOne({_id: doc.photo[0]._dataRef}, (err, data) => {
            if (err) {
              return callback(err)
            }
            doc.photo[0].data = data.data
            callback()
          })
        })
      } else {
        callback()
      }
    },

    touchResource: (resource) => {
      if (!resource.meta) {
        resource.meta = {}
      }
      if (!resource._transforms) {
        resource._transforms = {}
      }
      if (!resource._transforms.meta) {
        resource._transforms.meta = {}
      }
      if (!resource._request) {
        resource._request = {}
      }
      resource._transforms.meta.lastUpdated = new Date()
      resource.meta.lastUpdated = moment(resource._transforms.meta.lastUpdated).format(dateFormat)
    },

    lookupResource: lookupResource,

    /**
     * Finds all practitioners linked to a particular organization
     * (practitioner.practitionerRole.managingOrganization)
     *
     * @param {String}    organization Org resource, e.g. Organization/123
     * @param {Function}  callback  (err, array<String>) with array an list of resources,
     *                              e.g. ['Practitioner/123']
     */
    lookupPractitionersForOrganization: lookupPractitionersForOrganization,

    breakTheGlassCategory: 'http://hl7.org/fhir/security-label#break-the-glass',

    addSecurityLabel: addSecurityLabel,

    addSubsettedSecurityLabel: (doc) => {
      addSecurityLabel(doc, 'http://hl7.org/fhir/ValueSet/v3-SecurityIntegrityObservationValue', 'SUBSETTED', 'subsetted')
    },

    addRedactedSecurityLabel: (doc) => {
      addSecurityLabel(doc, 'http://hl7.org/fhir/ValueSet/v3-SecurityIntegrityObservationValue', 'REDACTED', 'redacted')
    },

    /**
     * FHIR core interaction callback
     * @callback PagingParamsCallback
     * @param {Object} err
     * @param {Outcome} badRequest If an invalid value is present for a particular parameter
     * @param {Number} _getpagesoffset Offset
     * @param {Number} _count Number of resources per page
     */
    /**
     * Process a set of query parameters for the FHIR paging values.
     *
     * @param {Object} queryParams HTTP query parameters
     * @param {PagingParamsCallback} callback
     */
    getPagingParams: (queryParams, callback) => {
      let _getpagesoffset = 0
      let _count = 10

      if (queryParams._getpagesoffset) {
        _getpagesoffset = parseInt(queryParams._getpagesoffset)
      }
      if (queryParams._count) {
        _count = parseInt(queryParams._count)
      }

      if (isNaN(_getpagesoffset) || _getpagesoffset < 0) {
        const msg = `Invalid value for query parameter: _getpagesoffset=${queryParams._getpagesoffset}`
        return callback(null, buildHTTPOutcome(400, 'error', 'invalid', msg))
      }

      if (isNaN(_count) || _count < 0) {
        const msg = `Invalid value for query parameter: _count=${queryParams._count}`
        return callback(null, buildHTTPOutcome(400, 'error', 'invalid', msg))
      }

      callback(null, null, _getpagesoffset, _count)
    },

    util: {

      /**
       * resolveReferences - Resolve the references in the passed in resource.
       * Any references matching olfRef will be replaced with newRef.
       *
       * @param  {Object} resource the resource to resolve referenced in
       * @param  {String} oldRef   the old refrence value to replace
       * @param  {String} newRef   the reference value to replace old ref with
       * @return {Object}          a reference to the original resource.
       */
      resolveReferences: function resolveReferences (resource, oldRef, newRef) {
        for (let prop in resource) {
          if (prop === 'reference' && resource[prop] === oldRef) {
            resource[prop] = newRef
          } else if (typeof resource[prop] === 'object') {
            if (Array.isArray(resource[prop])) {
              resource[prop].forEach((element) => {
                resolveReferences(element, oldRef, newRef)
              })
            } else {
              resolveReferences(resource[prop], oldRef, newRef)
            }
          }
        }
      },

      generateID: generateID,

      /**
       * Validate a value as a FHIR id datatype
       *
       * @param  {String} id The value to validate
       * @return {Boolean}
       */
      validateID: validateID

    }
  }
}

exports.buildOperationOutcome = buildOperationOutcome
