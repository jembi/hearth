'use strict'
const moment = require('moment')
const config = require('../config')
const URI = require('urijs')
const Uuid1 = require('uuid/v1')
const Uuid4 = require('uuid/v4')

const dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZ'

module.exports = (mongo) => {
  const standardFHIRParams = ['_summary', '_count', '_getpagesoffset']

  const formatResource = (resource) => {
    delete resource._id
    delete resource._transforms
    delete resource._request
    return resource
  }

  const validateID = (id) => /^[A-Za-z0-9-.]{1,64}$/.test(id)

  const isValidReferenceString = (ref) => {
    const spl = ref.split('/')
    return spl.length === 2 && validateID(spl[1])
  }

  const buildOperationOutcome = (severity, code, detailsText) => {
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
    if (!doc.meta.security) {
      doc.meta.security = []
    }
    doc.meta.security.push({
      system: system,
      code: code,
      display: display
    })
  }

  const transformDate = (value) => {
    if (value.length === 'YYYY'.length) {
      value = `${value}-01-01`
    } else if (value.length === 'YYYY-MM'.length) {
      value = `${value}-01`
    }

    return moment(value).toDate()
  }

  // same as transformDate, except it will initialize the returned value
  // with an end value, e.g. 2016 => 2016-12-31T23:59...
  const transformDateWithMaxValue = (value) => {
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
      const from = {}
      from[period.start] = {
        $lte: transformDate(param)
      }
      const to = {}
      to[period.end] = {
        $gte: transformDate(param)
      }
      opClause['$and'].push(from)
      opClause['$and'].push(to)
    } else {
      opClause['$or'] = []
      const start = {}
      start[period.start] = {}
      start[period.start][op] = transformDate(param)
      const end = {}
      end[period.end] = {}
      end[period.end][op] = transformDate(param)
      opClause['$or'].push(start)
      opClause['$or'].push(end)
    }

    return opClause
  }

  // Build a mongo find clause for a date or dateTime field
  const buildClauseForDate = (op, field, param) => {
    const opClause = {}
    opClause[field] = {}

    if (op === '$eq') {
      opClause[field] = {
        $gte: transformDate(param),
        $lte: transformDateWithMaxValue(param)
      }
    } else {
      opClause[field][op] = transformDate(param)
    }

    return opClause
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
          return {
            fullUrl: `${config.getConf('server:publicFhirBase')}/${entry.resourceType}/${entry.id}`,
            resource: formatResource(entry)
          }
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
      tokenToSystemValueElemMatch: (fieldToMatch, token) => {
        const match = (fieldToMatch, token) => {
          const clause = {}
          const multipleDomains = token.split(',')
          if (multipleDomains.length > 1) {
            return {
              $and: multipleDomains.map((domain) => {
                return match(fieldToMatch, domain)
              })
            }
          }

          const split = token.split('|')
          if (split.length > 1) {
            split[0] = split[0] ? split[0] : { $exists: false }
            split[1] = split[1] ? split[1] : { $exists: true }

            clause[fieldToMatch] = {
              $elemMatch: {
                system: split[0],
                value: split[1]
              }
            }
          } else {
            clause[fieldToMatch] = {
              $elemMatch: {
                value: split[0]
              }
            }
          }
          return clause
        }

        if (Array.isArray(token)) {
          return {
            $and: token.map((t) => {
              return match(fieldToMatch, t)
            })
          }
        }
        return match(fieldToMatch, token)
      },

      removeIdentifiersFromTokens: (token) => {
        const removeIdentifiers = (t) => {
          if (t.split(',').length > 1) {
            return t
          }
          const split = t.split('|')
          if (split.length > 1) {
            return `${split[0]}|`
          }
          return null
        }

        if (Array.isArray(token)) {
          return token.map((t) => {
            return removeIdentifiers(t)
          }).filter((f) => {
            return !!f
          })
        }
        return removeIdentifiers(token)
      },

      tokenToSystemCodeElemMatch: (fieldToMatch, token) => {
        const clause = {}
        const split = token.split('|')
        if (split.length > 1) {
          clause[fieldToMatch] = {
            $elemMatch: {
              system: split[0],
              code: split[1]
            }
          }
        } else {
          clause[fieldToMatch] = {
            $elemMatch: {
              code: split[0]
            }
          }
        }
        return clause
      },

      tokenToLinkElemMatch: (token) => {
        const split = token.split('|')

        const removeTrailingSlash = split[0].split('/')
        if (!removeTrailingSlash.pop()) {
          split[0] = removeTrailingSlash.join('/')
        }
        const clause = { link: { $elemMatch: { other: { $regex: `^${split[0] + '/Patient/' + split[1]}` } } } }
        return clause
      },

      nameToMongoClause: (type, value, operator) => {
        const addToClause = (value) => {
          const clause = {}
          switch (operator) {
            case 'exact':
              clause[`name.${type}`] = value
              break
            default: // default to regex
              clause[`name.${type}`] = {
                $regex: value,
                $options: 'i'
              }
          }
          return clause
        }

        if (Array.isArray(value)) {
          return {
            $and: value.map((n) => {
              return addToClause(n)
            })
          }
        }
        return addToClause(value)
      },

      dateToMongoClause: (fieldToMatch, date) => {
        const buildQuery = (date) => {
          const operator = date.substring(0, 2)
          const dateString = date.substring(2)
          const mongoOperators = {
            eq: '$regex', // allow partial match for period dates - eg, 2017, 2017-01
            ne: '$ne',
            lt: '$lt',
            le: '$lte',
            gt: '$gt',
            ge: '$gte'
          }

          const clause = {}
          if (mongoOperators[operator]) {
            clause[fieldToMatch] = {}
            if (mongoOperators[operator] === '$regex') {
              clause[fieldToMatch][mongoOperators[operator]] = `^${dateString}`
              return clause
            }
            clause[fieldToMatch][mongoOperators[operator]] = dateString
          }
          return clause
        }

        if (Array.isArray(date)) {
          return {
            $and: date.map((d) => {
              return buildQuery(d)
            })
          }
        }
        return buildQuery(date)
      },

      addressToMongoClause: (fieldToMatch, address, operator) => {
        const buildQuery = (address) => {
          switch (operator) {
            case 'exact':
              address = `^${address}$`
              break
            default:
              address = `^${address}`
          }

          return {
            $or: [
              { address: { $elemMatch: { line: { $regex: address, $options: 'i' } } } },
              { address: { $elemMatch: { city: { $regex: address, $options: 'i' } } } },
              { address: { $elemMatch: { state: { $regex: address, $options: 'i' } } } },
              { address: { $elemMatch: { country: { $regex: address, $options: 'i' } } } },
              { address: { $elemMatch: { postalCode: { $regex: address, $options: 'i' } } } },
              { address: { $elemMatch: { text: { $regex: address, $options: 'i' } } } }
            ]
          }
        }

        if (Array.isArray(address)) {
          return {
            $and: address.map((a) => {
              return buildQuery(a)
            })
          }
        }
        return buildQuery(address)
      },

      validateAndParseQueryParams: (queryParams, supported, callback) => {
        const getRequiredParams = (obj) => {
          let requiredParams = []
          for (const key in obj) {
            if (obj[key].required) {
              requiredParams.push(key)
            }
          }
          return requiredParams
        }

        const queryObject = {}
        // sanitize object for required check
        for (const key in queryParams) {
          const keySplit = key.split(':')
          const keyActual = keySplit[0]
          const keyOperator = keySplit[1] || 'default'

          // valid param if key found in standardFHIRParams
          if (standardFHIRParams.indexOf(keyActual) !== -1) {
            continue
          }

          // parameter not supported
          if (!supported[keyActual]) {
            return callback(`This endpoint does not support the query parameter: ${keyActual}`)
          }

          // if keyOperator supplied, but not allowed in supported settings
          if (keyOperator !== 'default' && !supported[keyActual].operators[keyOperator]) {
            return callback(`This endpoint has the following query parameter: '${keyActual}' which does not allow for the ':${keyOperator}' operator`)
          }

          // parameter not allowed to be an array
          if (!supported[keyActual].allowArray && Array.isArray(queryParams[keyActual])) {
            return callback(`This endpoint does not support the query parameter to be in array format: ${keyActual}`)
          }

          if (!queryObject[keyActual]) {
            queryObject[keyActual] = {}
          }
          queryObject[keyActual][keyOperator] = queryParams[key]
        }

        // check required fields first
        for (const key in supported) {
          // required value not in queryParams
          if (supported[key].required && !queryObject[key]) {
            const requiredParams = getRequiredParams(supported)
            return callback(`This endpoint has the following required query parameters: ${JSON.stringify(requiredParams)}`)
          }
        }

        callback(null, queryObject)
      },

      validateFullSourceIdentifierToken: (token) => {
        const split = token.split('|')
        if (split.length < 2 || !split[0]) {
          return 'sourceIdentifier Assigning Authority not found'
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
          const nameCheck = (type) => patient.name[0][type] && patient.name[0][type].length > 0
          const given = nameCheck('given') ? patient.name[0].given[0] : ''
          const family = nameCheck('family') ? patient.name[0].family[0] : ''
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
        const ctx = { query: {} }
        ctx.query[chainedParam] = value
        // fetch the referenced filters using reference FHIR module
        chainedModule.searchFilters(ctx, (err, badRequest, filters) => {
          if (err) { return callback(err) }
          if (badRequest) { return callback(new Error(`Bad request made to ${chainedModule.name} module while chaining parameters`)) }
          mongo.getDB((err, db) => {
            if (err) { return callback(err) }
            const c = db.collection(chainedModule.name)
            // find patients in question
            c.find(filters).project({ id: 1 }).toArray((err, results) => {
              if (err) { return callback(err) }
              if (results.length === 0) {
                // return query to a non-existant resource so an empty result set is returned
                const query = {}
                query[baseParam] = `${chainedModule.name}/_none`
                return callback(null, query)
              }

              // build up a query that finds docs for each matching resource
              const clauses = []
              results.forEach((resource) => {
                const clause = {}
                clause[baseParam] = `${chainedModule.name}/${resource.id}`
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
      },

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
      validateID: validateID,

      addSearchFiltersToQuery: (query, searchFilters) => {
        if (query['$or'] && query['$or'].length !== 0) {
          query['$or'].forEach((and) => {
            and['$and'].push(searchFilters)
          })
        } else {
          query['$and'].push(searchFilters)
        }
      }
    }
  }
}
