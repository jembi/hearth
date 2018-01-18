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
const _ = require('lodash')

const config = require('../config')
const searchParamMappings = require('./search-parameter-mapping.js')
const moduleLoader = require('./module-loader')

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

      c.find(query).project({ id: 1 }).toArray((err, results) => {
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
          .findOne({ id: resourceId, 'meta.versionId': versionId }, callback)
      } else {
        db.collection(resourceType).findOne({ id: resourceId }, callback)
      }
    })
  }

  function resolveNestedProperties (resultList, includeReference, callback) {
    const promises = []

    const evaluateProperties = (property, nextProperty) => {
      if (property == null) {
        // No resource property
        return
      }

      _.castArray(property).map((prop) => {
        if (nextProperty[0]) {
          evaluateProperties(prop[nextProperty[0]], nextProperty.slice(1))
        } else {
          if (!prop.reference) {
            // No reference
            return
          }
          promises.push(new Promise((resolve, reject) => {
            resolveReference(prop.reference, (err, data) => {
              if (err) {
                reject(err)
              } else {
                resolve(data)
              }
            })
          }))
        }
      })
    }

    // resolve references in nested objects recursively
    evaluateProperties(resultList[includeReference[0]], includeReference.slice(1))

    Promise.all(promises)
      .then((res) => {
        callback(null, res)
      }).catch((err) => {
        callback(err)
      })
  }

  const resolveIncludeParameters = (item, results) => {
    if (item == null) {
      return Promise.reject(new Error('Undefined include parameter'))
    }

    const itemList = item.split('.')

    if (itemList.length < 2) {
      return Promise.reject(new Error(`Invalid format for include parameter: ${item}`))
    }

    const itemResource = itemList[0]
    const itemReference = itemList.slice(1)

    const promises = results
      .filter(item => item['resourceType'] === itemResource)
      .map(item => new Promise((resolve, reject) => {
        resolveNestedProperties(item, itemReference, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      }))

    return Promise.all(promises)
      .then((res) => [].concat.apply([], res))
  }

  function mapSearchNameToPath (searchParameters) {
    const promises = []
    if (!searchParameters) {
      return Promise.resolve()
    }

    _.castArray(searchParameters).forEach((parameter) => {
      promises.push(new Promise((resolve, reject) => {
        const itemList = parameter.split(':')
        if (itemList.length < 2) {
          return reject(new Error(`Invalid search expression: ${parameter}`))
        }

        const itemResource = itemList[0]
        const itemReference = itemList[1].split('.')

        resolve(searchParamMappings.nameToPath[itemResource][itemReference])
      }))
    })

    return Promise.all(promises)
      .then((res) => {
        const flattenedRes = [].concat.apply([], res)

        return _.uniq(flattenedRes)
      })
  }

  function includeResources (includeParams, results) {
    if (!results && !Array.isArray(results)) {
      return Promise.reject(new Error(`Invalid results parameter "${results}"`))
    }
    if (!includeParams || results.length === 0) {
      return Promise.resolve([])
    }

    const promises = []

    _.castArray(includeParams).forEach((item) => {
      promises.push(resolveIncludeParameters(item, results))
    })

    return Promise.all(promises).then((res) => {
      let flattenedRes = [].concat.apply([], res)

      for (var i = flattenedRes.length - 1; i >= 0; i--) {
        if (flattenedRes[i] == null) {
          flattenedRes.splice(i, 1) // remove null values from the result set
        }
      }

      return _.uniqWith(flattenedRes, _.isEqual)
    })
  }

  function reverseIncludeResources (revincludes, results) {
    if (!revincludes || !results || results.length === 0) {
      // No _revinclude parameter or no results
      return Promise.resolve([])
    }

    if (Array.isArray(revincludes)) {
      // Multiple _revinclude parameters
      const promises = revincludes.map(revinclude => performReverseInclude(revinclude, results))
      return Promise.all(promises).then(([...results]) => [].concat(...results))
    } else {
      // Single _revinclude parameter
      return performReverseInclude(revincludes, results)
    }
  }

  function performReverseInclude (revinclude, results) {
    // Parse the _revinclude parameter value
    const parts = revinclude.split(':')
    if (parts.length !== 2) {
      return Promise.reject(new Error(`Invalid _revinclude parameter value: "${revinclude}"`))
    }
    const resourceType = parts[0]
    const queryParam = parts[1]

    // Get a reference to the module for searching by the resource type
    const module = moduleLoader.getLoadedModule(resourceType)
    if (!module || !module.searchFilters) {
      return Promise.reject(new Error(`The _revinclude parameter is not supported for "${resourceType}"`))
    }

    // Build a query for each result
    const queryPromises = results.map((result) => {
      const searchCtx = {
        query: {
          [queryParam]: `${result.resourceType}/${result.id}`
        }
      }
      return new Promise((resolve, reject) => {
        module.searchFilters(searchCtx, (err, badRequest, query) => {
          if (err) {
            return reject(err)
          }
          if (badRequest) {
            const error = new Error(`Invalid _revinclude query parameter value: "${revinclude}"`)
            error.operationOutcome = badRequest
            return reject(error)
          }
          resolve(query)
        })
      })
    })

    // Combine and execute all of the queries
    return Promise.all(queryPromises).then((queries) => {
      return new Promise((resolve, reject) => {
        mongo.getDB((err, db) => {
          if (err) {
            return reject(err)
          }
          resolve(db)
        })
      }).then(db => db.collection(resourceType).find({$or: queries}).toArray())
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
        if ( entry._request.method == 'POST' ) {
            entry._request.url = entry.resourceType
        } else {
            entry._request.url = entry.resourceType+"/"+entry.id
        }

          const ret = {
            fullUrl: `${config.getConf('server:publicFhirBase')}/${entry.resourceType}/${entry.id}/_history/${entry.meta.versionId}`,
            resource: entry,
            request: entry._request
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
     * Map search names to paths
     *
     * @param {Object} searchParameters Some search parameters
     * @param {Function} callback The callback will resolve with the parsed search paths
     */
    mapSearchNameToPath,

    /**
     * Include resources referenced by the given query parameters. Resolved using a promise.
     *
     * @param {Object} ctx The context object.
     * @param {Object} results The results bundle where the linked resources will be added
     */
    includeResources,

    /**
     * Include resources which reference the given results by the query parameters.
     */
    reverseIncludeResources,

    /**
     * Check if json object exists in an array objects
     *
     * @param {Object} obj The search object.
     * @param {Object} list The array of json objects as the search context
     */
    containsObject: (obj, list) => {
      var i
      for (i = 0; i < list.length; i++) {
        if (_.isEqual(list[i], obj)) {
          return true
        }
      }

      return false
    },

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
      let _count = 100

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
