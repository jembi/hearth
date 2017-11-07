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

const REFERENCE_REGEX = /((http|https):\/\/([A-Za-z0-9\\/.:%$])*)?(Account|AllergyIntolerance|Appointment|AppointmentResponse|AuditEvent|Basic|Binary|BodySite|Bundle|CarePlan|Claim|ClaimResponse|ClinicalImpression|Communication|CommunicationRequest|Composition|ConceptMap|Condition|Conformance|Contract|Coverage|DataElement|DetectedIssue|Device|DeviceComponent|DeviceMetric|DeviceUseRequest|DeviceUseStatement|DiagnosticOrder|DiagnosticReport|DocumentManifest|DocumentReference|EligibilityRequest|EligibilityResponse|Encounter|EnrollmentRequest|EnrollmentResponse|EpisodeOfCare|ExplanationOfBenefit|FamilyMemberHistory|Flag|Goal|Group|HealthcareService|ImagingObjectSelection|ImagingStudy|Immunization|ImmunizationRecommendation|ImplementationGuide|List|Location|Media|Medication|MedicationAdministration|MedicationDispense|MedicationOrder|MedicationStatement|MessageHeader|NamingSystem|NutritionOrder|Observation|OperationDefinition|OperationOutcome|Order|OrderResponse|Organization|Patient|PaymentNotice|PaymentReconciliation|Person|Practitioner|Procedure|ProcedureRequest|ProcessRequest|ProcessResponse|Provenance|Questionnaire|QuestionnaireResponse|ReferralRequest|RelatedPerson|RiskAssessment|Schedule|SearchParameter|Slot|Specimen|StructureDefinition|Subscription|Substance|SupplyDelivery|SupplyRequest|TestScript|ValueSet|VisionPrescription)\/([A-Za-z0-9\-.]{1,64})(\/_history\/([A-Za-z0-9\-.]{1,64}))?/

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

  function resolveReference (reference, callback) {
    const matches = REFERENCE_REGEX.exec(reference)
    if (!matches) {
      return callback(new Error(`Invalid resource reference "${reference}"`))
    }
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }
      const resourceType = matches[4]
      const resourceId = matches[5]
      const versionId = matches[7]
      if (versionId) {
        db
          .collection(`${resourceType}_history`)
          .findOne({id: resourceId, 'meta.versionId': versionId}, callback)
      } else {
        db.collection(resourceType).findOne({id: resourceId}, callback)
      }
    })
  }

  // resolve references in nested objects recursively
  function resolveNestedProperties (property, nextProperty, callback) {
    if (property == null) {
      return callback(new Error('Undefined resource property.'))
    }

    if (Array.isArray(property)) {
      for (var n = 0; n < property.length; n++) {
        if (nextProperty[0] && property[n][nextProperty[0]] != null) {
          resolveNestedProperties(property[n][nextProperty[0]], nextProperty.slice(1), callback)
        } else if (property[n].reference) {
          resolveReference(property[n].reference, callback)
        } else {
          return callback(new Error(`Invalid resource reference: "${JSON.stringify(property[n])}"`))
        }
      }
    } else {
      if (nextProperty[0] && property[nextProperty[0]] != null) {
        resolveNestedProperties(property[nextProperty[0]], nextProperty.slice(1), callback)
      } else if (property.reference) {
        resolveReference(property.reference, callback)
      } else {
        return callback(`Invalid resource reference: "${JSON.stringify(property)}"`)
      }
    }
  }

  const parseIncludeParams = (item, results) => {
    return new Promise((resolve, reject) => {
      const itemList = item.split(':')
      const itemResource = itemList[0]
      const itemReference = itemList[1].split('.')

      results.forEach((item) => {
        if (item['resourceType'] === itemResource) {
          resolveNestedProperties(item[itemReference[0]], itemReference.slice(1), (err, data) => {
            if (err) {
              reject(err)
            } else {
              resolve(data)
            }
          })
        }
      })
    })
  }

  function includeResources (ctx, results) {
    return new Promise((resolve, reject) => {
      if (!ctx) {
        reject(`Invalid context parameter "${ctx}"`)
      }
      if (!Array.isArray(results)) {
        reject(`Invalid results parameter "${results}"`)
      } else if (results.length === 0) {
        reject('Empty search result set.')
      }

      let promises = []

      if (ctx.query && ctx.query._include) {
        if (Array.isArray(ctx.query._include)) {
          ctx.query._include.forEach((item) => {
            promises.push(parseIncludeParams(item, results))
          })
        } else {
          promises.push(parseIncludeParams(ctx.query._include, results))
        }
      }

      // wait for all references to be resolved before adding to results array
      Promise.all(promises).then((res) => {
        for (var i = res.length - 1; i >= 0; i--) {
          if (res[i] == null) {
            res.splice(i, 1) // remove all null values from the result set
          }
        }

        resolve(res)
      }).catch((err) => {
        reject(err)
      })
    })
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
          cAttach.insertOne({ data: doc.photo[0].data }, (err, r) => {
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
          cAttach.findOne({ _id: doc.photo[0]._dataRef }, (err, data) => {
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

    lookupResource: resolveReference,

    /**
     * Look up the resource referenced by the given reference value.
     *
     * @param {String} reference The reference value.
     * @param {Function} callback The callback which will be resolved with an optional error and the resolved resource.
     */
    resolveReference,

    /**
     * Include resources referenced by the given query parameters
     *
     * @param {Object} ctx The context object.
     * @param {Object} results The results bundle where the linked resources will be added
     */
    includeResources,

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
       * @param  {String} oldRef   the old reference value to replace
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
