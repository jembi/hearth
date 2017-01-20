'use strict'
const logger = require('winston')
const async = require('async')
const uuid = require('uuid')
const moment = require('moment')
const config = require('../config')
const ObjectID = require('mongodb').ObjectID
const _ = require('lodash')
const URI = require('urijs')

const dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZ'

module.exports = (mongo) => {
  const standardFHIRParams = ['_summary', '_count', '_getpagesoffset']

  let formatResource = (resource) => {
    resource.latest.id = resource._id

    if (resource.latest._transforms) {
      delete resource.latest._transforms
    }

    return resource.latest
  }

  let formatResourceFromHistory = (resource, vid) => {
    resource.history[vid].resource.id = resource._id

    if (resource.history[vid].resource._transforms) {
      delete resource.history[vid].resource._transforms
    }

    return resource.history[vid].resource
  }

  let isValidReferenceString = (ref) => {
    let spl = ref.split('/')
    return spl.length === 2 && ObjectID.isValid(spl[1])
  }

  let buildOperationOutcome = (severity, code, detailsText) => {
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

  let lookupResource = (resource, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      let resourceType = resource.split('/')[0]
      let c = db.collection(resourceType)
      c.findOne({_id: ObjectID(resource.split('/')[1])}, {fields: {latest: 1}}, (err, result) => {
        callback(err, (result ? result.latest : null))
      })
    })
  }

  let lookupPractitionersForOrganization = (organization, callback) => {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }

      let c = db.collection('Practitioner')
      let query = {
        'latest.practitionerRole': {
          $elemMatch: {
            'managingOrganization.reference': organization
          }
        }
      }

      mongo.util.debugLog('Practitioner', 'find', query)

      c.find(query).project({_id: 1}).toArray((err, results) => {
        if (err) {
          return callback(err)
        }
        callback(null, results.map((r) => `Practitioner/${r._id}`))
      })
    })
  }

  let addSecurityLabel = (doc, system, code, display) => {
    if (!doc.meta.security) {
      doc.meta.security = []
    }
    doc.meta.security.push({
      system: system,
      code: code,
      display: display
    })
  }

  let transformDate = (value) => {
    if (value.length === 'YYYY'.length) {
      value = `${value}-01-01`
    } else if (value.length === 'YYYY-MM'.length) {
      value = `${value}-01`
    }

    return moment(value).toDate()
  }

  // same as transformDate, except it will initialize the returned value
  // with an end value, e.g. 2016 => 2016-12-31T23:59...
  let transformDateWithMaxValue = (value) => {
    let result

    if (value.length === 'YYYY'.length) {
      value = `${value}-01-01`
      result = moment(value).endOf('year').toDate()
    } else if (value.length === 'YYYY-MM'.length) {
      value = `${value}-01`
      result = moment(value).endOf('month').toDate()
    } else if (value.length === 'YYYY-MM-DD'.length) {
      result = moment(value).endOf('day').toDate()
    } else if (value.length === 'YYYY-MM-DDTHH:MM'.length) {
      result = moment(value).endOf('minute').toDate()
    } else if (value.length === 'YYYY-MM-DDTHH:MMZ'.length) {
      result = moment(value).endOf('minute').toDate()
    } else if (value.length === 'YYYY-MM-DDTHH:MM+ZZ:ZZ'.length) {
      result = moment(value).endOf('minute').toDate()
    } else if (value.length === 'YYYY-MM-DDTHH:MM:SS'.length) {
      result = moment(value).endOf('second').toDate()
    } else if (value.length === 'YYYY-MM-DDTHH:MM:SSZ'.length) {
      result = moment(value).endOf('second').toDate()
    } else if (value.length === 'YYYY-MM-DDTHH:MM:SS+ZZ:ZZ'.length) {
      result = moment(value).endOf('second').toDate()
    } else {
      result = moment(value).toDate()
    }

    return result
  }

  // Build a mongo find clause for a FHIR period
  const buildClauseForPeriod = (op, period, param) => {
    const opClause = {}

    if (op === '$eq') {
      opClause['$and'] = []
      let from = {}
      from[`latest.${period.start}`] = {
        $lte: transformDate(param)
      }
      let to = {}
      to[`latest.${period.end}`] = {
        $gte: transformDate(param)
      }
      opClause['$and'].push(from)
      opClause['$and'].push(to)
    } else {
      opClause['$or'] = []
      let start = {}
      start[`latest.${period.start}`] = {}
      start[`latest.${period.start}`][op] = transformDate(param)
      let end = {}
      end[`latest.${period.end}`] = {}
      end[`latest.${period.end}`][op] = transformDate(param)
      opClause['$or'].push(start)
      opClause['$or'].push(end)
    }

    return opClause
  }

  // Build a mongo find clause for a date or dateTime field
  const buildClauseForDate = (op, field, param) => {
    const opClause = {}
    opClause[`latest.${field}`] = {}

    if (op === '$eq') {
      opClause[`latest.${field}`] = {
        $gte: transformDate(param),
        $lte: transformDateWithMaxValue(param)
      }
    } else {
      opClause[`latest.${field}`][op] = transformDate(param)
    }

    return opClause
  }

  return {
    formatResource: formatResource,
    formatResourceFromHistory: formatResourceFromHistory,

    bundleResults: (type, entries, total, callingUrl) => {
      let url = URI(callingUrl)
      return {
        resourceType: 'Bundle',
        id: uuid.v1(),
        meta: {
          lastUpdated: moment().format(dateFormat)
        },
        type: type,
        total: ((total !== null) ? total : entries.length),
        link: [
          {
            relation: 'self',
            url: `${config.getConf().server.publicFhirBase}/${url.segment(-1)}${url.search()}`
          }
        ],
        entry: entries.map((entry) => {
          return {
            fullUrl: `${config.getConf().server.publicFhirBase}/${entry.latest.resourceType}/${entry._id}`,
            resource: formatResource(entry)
          }
        })
      }
    },

    addBundleLinkNext: (bundle, callingUrl, offset, count) => {
      let url = URI(callingUrl).setSearch('_getpagesoffset', offset).setSearch('_count', count)
      bundle.link.push({
        relation: 'next',
        url: `${config.getConf().server.publicFhirBase}/${url.segment(-1)}${url.search()}`
      })
    },

    buildOperationOutcome: buildOperationOutcome,
    internalServerErrorOutcome: () => buildOperationOutcome('fatal', 'exception', 'Internal server error'),

    isValidReferenceString: isValidReferenceString,

    validateReferencesForEncounter: (encounter, callback) => {
      let locations = []
      let practitioners = []

      if (encounter.location) {
        for (let loc of encounter.location) {
          if (loc.location && loc.location.reference) {
            if (isValidReferenceString(loc.location.reference)) {
              locations.push(loc.location.reference.replace('Location/', ''))
            } else {
              return callback(null, `Invalid reference for location.location: ${loc.location.reference}`)
            }
          }
        }
      }

      if (encounter.participant) {
        for (let prac of encounter.participant) {
          if (prac.individual && prac.individual.reference) {
            if (isValidReferenceString(prac.individual.reference)) {
              practitioners.push(prac.individual.reference.replace('Practitioner/', ''))
            } else {
              return callback(null, `Invalid reference for participant.individual: ${prac.individual.reference}`)
            }
          }
        }
      }

      if (locations.length > 0 || practitioners.length > 0) {
        mongo.getDB((err, db) => {
          if (err) {
            return callback(err)
          }

          let toObjectID = (elem) => ObjectID(elem)

          let count = (collectionName, ids, callback) => {
            let c = db.collection(collectionName)
            c.count({_id: {$in: (ids.map(toObjectID))}}, (err, count) => {
              if (err) {
                return callback(err)
              }
              callback(null, count === ids.length)
            })
          }

          let countPractitioners = () => count('Practitioner', practitioners, (err, foundAll) => {
            if (err) {
              return callback(err)
            }
            if (!foundAll) {
              return callback(null, 'Invalid reference(s) for participant.individual')
            }
            callback()
          })

          if (locations.length > 0) {
            count('Location', locations, (err, foundAll) => {
              if (err) {
                return callback(err)
              }
              if (!foundAll) {
                return callback(null, 'Invalid reference(s) for location.location')
              }
              countPractitioners()
            })
          } else {
            countPractitioners()
          }
        })
      } else {
        callback()
      }
    },

    /**
     * Extracts an attachment from a document and stores it seperately, removing it from the document
     *
     * At the moment it jsut supports photo data, e.g. for patient and practitioner
     */
    referenceAttachment: (doc, callback) => {
      if (doc.photo && doc.photo.length > 0 && doc.photo[0].data) {
        mongo.getDB((err, db) => {
          if (err) {
            return callback(err)
          }

          let cAttach = db.collection('attachmentData')
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

          let cAttach = db.collection('attachmentData')
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

    setVersionId: (doc, version) => {
      if (!doc.meta) {
        doc.meta = {}
      }
      doc.meta.versionId = version
      doc.meta.lastUpdated = new Date()
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

    /**
     * Is a particular patient under the care of a practitioner
     *
     * @param {String}    patient Patient resource, e.g. Patient/123
     * @param {String}    practitioner Practitioner resource, e.g. Practitioner/123
     * @param {Function}  callback  (err, isLinked)
     */
    isPatientLinkedToPractitioner: (patient, practitioner, callback) => {
      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        let c = db.collection('Encounter')
        let crit = {
          $and: [
            {
              'latest.patient.reference': patient
            },
            {
              'latest.participant': {
                $elemMatch: {
                  'individual.reference': practitioner
                }
              }
            }
          ]
        }

        mongo.util.debugLog('Encounter', 'count', crit)
        c.count(crit, (err, count) => callback(err, count > 0))
      })
    },

    /**
     * Is a particular patient under the care of a practitioner's organization
     *
     * @param {String}    patient Patient resource, e.g. Patient/123
     * @param {String}    practitioner Practitioner resource, e.g. Practitioner/123
     * @param {Function}  callback  (err, isLinked)
     */
    isPatientLinkedToPractitionerOrganization: (patient, practitioner, callback) => {
      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        lookupResource(practitioner, (err, practitionerDoc) => {
          if (err) {
            return callback(err)
          }
          if (!practitionerDoc) {
            return callback(new Error(`${practitioner} not found in database`))
          }
          if (!practitionerDoc.practitionerRole || practitionerDoc.practitionerRole.length === 0 ||
            !practitionerDoc.practitionerRole[0].managingOrganization ||
            !practitionerDoc.practitionerRole[0].managingOrganization.reference) {
            return callback(new Error(`${practitioner} does not have a managing organization`))
          }

          lookupPractitionersForOrganization(practitionerDoc.practitionerRole[0].managingOrganization.reference, (err, practitioners) => {
            if (err) {
              return callback(err)
            }
            let cEnc = db.collection('Encounter')
            let crit = {
              $and: [
                {
                  'latest.patient.reference': patient
                },
                {
                  'latest.participant': {
                    $elemMatch: {
                      'individual.reference': {
                        $in: practitioners
                      }
                    }
                  }
                }
              ]
            }

            mongo.util.debugLog('Encounter', 'count', crit)
            cEnc.count(crit, (err, count) => callback(err, count > 0))
          })
        })
      })
    },

    breakTheGlassCategory: 'http://hl7.org/fhir/security-label#break-the-glass',

    addSecurityLabel: addSecurityLabel,

    addSubsettedSecurityLabel: (doc) => {
      addSecurityLabel(doc, 'http://hl7.org/fhir/ValueSet/v3-SecurityIntegrityObservationValue', 'SUBSETTED', 'subsetted')
    },

    addRedactedSecurityLabel: (doc) => {
      addSecurityLabel(doc, 'http://hl7.org/fhir/ValueSet/v3-SecurityIntegrityObservationValue', 'REDACTED', 'redacted')
    },

    getPagingParams: (req, res, callback) => {
      let _getpagesoffset = 0
      let _count = 10

      if (req.query._getpagesoffset) {
        _getpagesoffset = parseInt(req.query._getpagesoffset)
      }
      if (req.query._count) {
        _count = parseInt(req.query._count)
      }

      if (isNaN(_getpagesoffset) || _getpagesoffset < 0) {
        let msg = `Invalid value for query parameter: _getpagesoffset=${req.query._getpagesoffset}`
        return res.status(400).send(buildOperationOutcome('error', 'invalid', msg))
      }

      if (isNaN(_count) || _count < 0) {
        let msg = `Invalid value for query parameter: _count=${req.query._count}`
        return res.status(400).send(buildOperationOutcome('error', 'invalid', msg))
      }

      callback(_getpagesoffset, _count)
    },

    updateEncounterQueryFields: (encounter) => {
      mongo.getDB((err, db) => {
        if (err) {
          return logger.error(err)
        }

        logger.debug(`Setting query fields for Encounter/${encounter.id}`)

        let query = {
          practitioners: [],
          organizations: []
        }

        let inserts = []

        if (encounter.participant) {
          encounter.participant.forEach((participant) => {
            inserts.push((asyncCallback) => {
              lookupResource(participant.individual.reference, (err, practitioner) => {
                if (err) {
                  return asyncCallback(err)
                }
                query.practitioners.push(participant.individual.reference)
                practitioner.practitionerRole.forEach((role) => {
                  query.organizations.push(role.managingOrganization.reference)
                })
                asyncCallback()
              })
            })
          })
        }

        async.parallel(inserts, (err) => {
          if (err) {
            return logger.error(err)
          }
          let update = {
            $set: {
              'query.practitioners': query.practitioners,
              'query.organizations': query.organizations
            }
          }
          db.collection('Encounter').updateOne({_id: ObjectID(encounter.id)}, update)
        })
      })
    },

    updateEncounterQueryFieldsForProcedure: (procedure) => {
      mongo.getDB((err, db) => {
        if (err) {
          return logger.error(err)
        }

        logger.debug(`Setting query fields for ${procedure.encounter.reference}`)

        let update = {
          $set: {
            'query.codes': procedure.code.coding.map((c) => c.code)
          }
        }

        if (procedure.scheduledDateTime) {
          update['$set']['query.reportingDate'] = moment(procedure.scheduledDateTime).toDate()
        } else if (procedure.performedDateTime) {
          update['$set']['query.reportingDate'] = moment(procedure.performedDateTime).toDate()
        }

        db.collection('Encounter').updateOne({_id: ObjectID(procedure.encounter.reference.replace('Encounter/', ''))}, update)
      })
    },

    util: {
      tokenToSystemValueElemMatch: (fieldToMatch, token) => {
        let clause = {}
        let split = token.split('|')
        if (split.length > 1) {
          clause[`latest.${fieldToMatch}`] = {
            $elemMatch: {
              system: split[0],
              value: split[1]
            }
          }
        } else {
          clause[`latest.${fieldToMatch}`] = {
            $elemMatch: {
              value: split[0]
            }
          }
        }
        return clause
      },

      tokenToSystemCodeElemMatch: (fieldToMatch, token) => {
        let clause = {}
        let split = token.split('|')
        if (split.length > 1) {
          clause[`latest.${fieldToMatch}`] = {
            $elemMatch: {
              system: split[0],
              code: split[1]
            }
          }
        } else {
          clause[`latest.${fieldToMatch}`] = {
            $elemMatch: {
              code: split[0]
            }
          }
        }
        return clause
      },

      nameToMongoClause: (type, name) => {
        let clause = {}
        clause[`latest.name.${type}`] = {
          $elemMatch: {
            $regex: name,
            $options: 'i'
          }
        }
        return clause
      },

      validateSearchParams: (queryParams, expected) => {
        let _expected = _.union(expected, standardFHIRParams)
        if (!_.isEmpty(queryParams) && _.difference(_.keys(queryParams), _expected).length > 0) {
          return `This endpoint only supports the following queries: [${_expected.map((e) => `'${e}'`).join(', ')}]`
        }
        return null
      },

      paramAsReference: (param, defaultType) => (param.indexOf('/') < 0 ? `${defaultType}/${param}` : param),

      nameOrEmail: (user, person) => {
        return person.name && person.name.length > 0 && person.name[0].given && person.name[0].given.length > 0
          ? person.name[0].given[0] : (
            (person.name && person.name.given && person.name.given.length > 0)
            ? person.name.given[0] : user.email
          )
      },

      displayPatientName: (patient) => {
        if (patient.name && patient.name.length > 0) {
          let nameCheck = (type) => patient.name[0][type] && patient.name[0][type].length > 0
          let given = nameCheck('given') ? patient.name[0].given[0] : ''
          let family = nameCheck('family') ? patient.name[0].family[0] : ''
          return `${given} ${family}`
        } else {
          return ''
        }
      },

      /**
       * Build a mongo query clause that allows for date or period searching.
       *
       * Multiple date params will be handle, e.g. field=geFROM&field=leTO
       *
       * @param {String|Object} fields The FHIR fields that will be matched.
       *                               The value can either be a single FHIR date or dateTime field (string),
       *                                or it can be a object specifying the start and end fields, if it is a FHIR period.
       * @param {String|Array} params A query param or array of params. The FHIR prefixes (eq, ge, etc.) will be handled.
       * @returns {Object} Mongo query clause
       */
      paramAsDateRangeClause: (fields, params) => {
        if (!Array.isArray(params)) {
          params = [params]
        }

        let clause = { $and: [] }

        for (let param of params) {
          let op = '$eq'

          if (!/\d\d/.test(param.substring(0, 2))) {
            switch (param.substring(0, 2)) {
              case 'eq':
                break
              case 'gt':
                op = '$gt'
                break
              case 'lt':
                op = '$lt'
                break
              case 'ge':
                op = '$gte'
                break
              case 'le':
                op = '$lte'
                break
              default:
                // TODO respond with bad request outcome
                // just let default error middleware handle for now
                throw new Error('Unsupported')
            }

            param = param.substring(2)
          }

          if (typeof fields === 'object') {
            clause['$and'].push(buildClauseForPeriod(op, fields, param))
          } else {
            const field = fields
            clause['$and'].push(buildClauseForDate(op, field, param))
          }
        }

        clause = mongo.util.collapseWhenSingleClause(clause)
        return clause
      },

      /**
       * Transform a FHIR ISO date string into a js Date.
       * Partial dates will be handled as the lowest value in the precision,
       * e.g 2016 will be transformed to 2016-01-01T00:00:00.000
       *
       * @param {String}  value The date value to transform
       * @returns {Date}  The transformed date
       */
      transformDate: transformDate,

      /**
       * Returns a mongo query for a chained query parameters. Currently only
       * supports a single level of chaining i.e. patient.identifier
       *
       * @param {String}    value the search value of the chained parameter
       * @param {String}    baseParam the string name of first parameter in the
       *                              chained
       * @param {String}    chainedParam the string name of the next parameter
       *                                 in the chain
       * @param {Object}    chainedModule an instanciated FHIR module for the
       *                                  chained parameter's type
       * @param {Function}  callback a node style callback (err, query) where
       *                             query is a mongo query string for the
       *                             chained parameters
       */
      genChainedParamQuery: (value, baseParam, chainedParam, chainedModule, callback) => {
        let refQueryParams = {}
        refQueryParams[chainedParam] = value
        // fetch the referenced filters using reference FHIR module
        chainedModule.searchFilters(refQueryParams, (err, badRequest, filters) => {
          if (err) { return callback(err) }
          if (badRequest) { return callback(new Error(`Bad request made to ${chainedModule.name} module while chaining parameters`)) }
          mongo.getDB((err, db) => {
            if (err) { return callback(err) }
            const c = db.collection(chainedModule.name)
            // find patients in question
            c.find(filters).project({ _id: 1 }).toArray((err, results) => {
              if (err) { return callback(err) }
              if (results.length === 0) {
                // return query to a non-existant resource so an empty result set is returned
                let query = {}
                query[`latest.${baseParam}`] = `${chainedModule.name}/_none`
                return callback(null, query)
              }

              // build up a query that finds docs for each matching resource
              let clauses = []
              results.forEach((resource) => {
                let clause = {}
                clause[`latest.${baseParam}`] = `${chainedModule.name}/${resource._id}`
                clauses.push(clause)
              })
              if (clauses.length > 1) {
                callback(null, { '$or': clauses })
              } else {
                callback(null, clauses[0])
              }
            })
          })
        })
      }
    }
  }
}
