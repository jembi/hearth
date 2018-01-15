 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const moment = require('moment')

const constants = require('../constants')

const standardFHIRParams = ['_summary', '_count', '_getpagesoffset']

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

module.exports = (mongo) => {
  return {
    /**
     * Transform a FHIR ISO date string into a js Date.
     * Partial dates will be handled as the lowest value in the precision,
     * e.g 2016 will be transformed to 2016-01-01T00:00:00.000
     *
     * @param {String}  value The date value to transform
     * @returns {Date}  The transformed date
     */
    transformDate: transformDate,

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
      const clause = { link: { $elemMatch: { 'other.reference': { $regex: `^${split[0] + '/Patient/' + split[1]}` } } } }
      return clause
    },

/*
    nameToMongoClause: (type, value, modifier) => {
      const addToClause = (value) => {
        const clause = {}
        switch (modifier) {
          case 'exact':
            clause[`name.${type}`] = value
            break
          case 'contains':
            clause[`name.${type}`] = {
              $regex: `${value}`,
              $options: 'i'
            }
            break
          default: // default to regex
            clause[`name.${type}`] = {
              $regex: `^${value}`,
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
*/

    nameToMongoClause: (fieldToMatch, value, modifier) => {
      let options = '';
      const buildQuery = (value) => {
        switch (modifier) {
          case 'exact':
            value = `^${value}$`
            break
          case 'contains':
            value = `${value}$`
            options = 'i';
            break
          default:
            value = `^${value}`
            options = 'i';
        }

        if ( fieldToMatch === 'name' ) {
            return {
            $or: [
                { name: { $elemMatch: { family: { $regex: value, $options: options } } } },
                { name: { $elemMatch: { given: { $regex: value, $options: options } } } },
                { name: { $elemMatch: { prefix: { $regex: value, $options: options } } } },
                { name: { $elemMatch: { suffix: { $regex: value, $options: options } } } },
                { name: { $elemMatch: { text: { $regex: value, $options: options } } } }
            ]
            }
         } else {
           const clause = {}
           clause['name.'+fieldToMatch] = { $regex: value, $options: options }
           return clause
         }
      }

      if (Array.isArray(value)) {
        return {
          $and: value.map((v) => {
            return buildQuery(v)
          })
        }
      }
      return buildQuery(value)
    },


    stringToMongoClause: (type, value, modifier) => {
      const addToClause = (value) => {
        const clause = {}
        switch (modifier) {
          case 'exact':
            clause[`${type}`] = value
            break
          case 'contains':
            clause[`${type}`] = {
              $regex: `${value}`,
              $options: 'i'
            }
            break
          default: // default to regex
            clause[`${type}`] = {
              $regex: `^${value}`,
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

    tokenToMongoClause: (type, value ) => {
      const addToClause = (value) => {
        const clause = {}
        clause[`${type}`] = value
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

    boolToMongoClause: (type, value ) => {
      const addToClause = (value) => {
        const clause = {}
        clause[`${type}`] = value == 'true'
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

    addressToMongoClause: (fieldToMatch, address, modifier) => {
      let options = '';
      const buildQuery = (address) => {
        switch (modifier) {
          case 'exact':
            address = `^${address}$`
            break
          case 'contains':
            address = `${address}$`
            options = 'i';
            break
          default:
            address = `^${address}`
            options = 'i';
        }

        if ( fieldToMatch === 'address' ) {
            return {
            $or: [
                { address: { $elemMatch: { line: { $regex: address, $options: options } } } },
                { address: { $elemMatch: { city: { $regex: address, $options: options } } } },
                { address: { $elemMatch: { state: { $regex: address, $options: options } } } },
                { address: { $elemMatch: { country: { $regex: address, $options: options } } } },
                { address: { $elemMatch: { postalCode: { $regex: address, $options: options } } } },
                { address: { $elemMatch: { text: { $regex: address, $options: options } } } }
            ]
            }
         } else {
           const clause = {}
           clause['address.'+fieldToMatch] = { $regex: address, $options: options }
           return clause
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
      let error
      // sanitize object for required check
      for (const key in queryParams) {
        const keySplit = key.split(':')
        const keyActual = keySplit[0]
        const keyModifier = keySplit[1] || constants.NO_MODIFER

        // valid param if key found in standardFHIRParams
        if (standardFHIRParams.indexOf(keyActual) !== -1) {
          continue
        }

        // parameter not supported
        if (!supported[keyActual]) {
          error = `This endpoint does not support the query parameter: ${keyActual}`
          return callback(error)
        }

        // if keyModifier supplied, but not allowed in supported settings
        if (keyModifier !== constants.NO_MODIFER && !supported[keyActual].modifiers[keyModifier]) {
          error = `This endpoint has the following query parameter: '${keyActual}' which does not allow for the ':${keyModifier}' modifier`
          return callback(error)
        }

        // parameter not allowed to be an array
        if (!supported[keyActual].allowArray && Array.isArray(queryParams[keyActual])) {
          error = `This endpoint does not support the query parameter to be in array format: ${keyActual}`
          return callback(error)
        }

        if (!queryObject[keyActual]) {
          queryObject[keyActual] = {}
        }
        queryObject[keyActual][keyModifier] = queryParams[key]
      }

      // check required fields first
      for (const key in supported) {
        // required value not in queryParams
        if (supported[key].required && !queryObject[key]) {
          const requiredParams = getRequiredParams(supported)
          error = `This endpoint has the following required query parameters: ${JSON.stringify(requiredParams)}`
          return callback(error)
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

    addSearchFiltersToQuery: (query, searchFilters) => {
      if (query['$or'] && query['$or'].length !== 0) {
        query['$or'].forEach((and) => {
          and['$and'].push(searchFilters)
        })
      } else {
        query['$and'].push(searchFilters)
      }
    },

    extensionToMongoClause: (paramConf, parameters, modifier) => {
      const buildQuery = (parameter) => {
        const clause = {
          extension: {
            $elemMatch: { url: paramConf.url }
          }
        }

        switch (modifier) {
          case 'exact':
            clause.extension['$elemMatch'][paramConf.valuePropPath] = parameter
            break
          case 'contains':
            clause.extension['$elemMatch'][paramConf.valuePropPath] = {
              $regex: `${parameter}`,
              $options: 'i'
            }
            break
          default: // default to regex
            clause.extension['$elemMatch'][paramConf.valuePropPath] = {
              $regex: `^${parameter}`,
              $options: 'i'
            }
        }
        return clause
      }

      if (Array.isArray(parameters)) {
        return {
          $and: parameters.map((p) => {
            return buildQuery(p)
          })
        }
      }
      return buildQuery(parameters)
    },

    referenceToMongoClause: (referencePath, parameters) => {
      const buildQuery = (parameter) => {
        const clause = {
          [referencePath]: parameter
        }
        return clause
      }

      if (Array.isArray(parameters)) {
        return {
          $and: parameters.map((p) => {
            return buildQuery(p)
          })
        }
      }
      return buildQuery(parameters)
    }
  }
}
