/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const moment = require('moment')

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
    opClause.$and = []
    const from = {}
    from[period.start] = {
      $lte: transformDate(param)
    }
    const to = {}
    to[period.end] = {
      $gte: transformDate(param)
    }
    opClause.$and.push(from)
    opClause.$and.push(to)
  } else {
    opClause.$or = []
    const start = {}
    start[period.start] = {}
    start[period.start][op] = transformDate(param)
    const end = {}
    end[period.end] = {}
    end[period.end][op] = transformDate(param)
    opClause.$or.push(start)
    opClause.$or.push(end)
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

const paramAsReference = (param, defaultType) => (param.indexOf('/') < 0 ? `${defaultType}/${param}` : param)

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

    tokenToSystemValue: (fieldToMatch, token, propertyDefObj) => {
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

          // multiple entries allowed, property must be an array
          if (propertyDefObj && propertyDefObj.max === '*') {
            clause[fieldToMatch] = {
              $elemMatch: {
                system: split[0],
                value: split[1]
              }
            }
          } else {
            clause[`${fieldToMatch}.system`] = split[0]
            clause[`${fieldToMatch}.value`] = split[1]
          }
        } else {
          // multiple entries allowed, property must be an array
          if (propertyDefObj && propertyDefObj.max === '*') {
            clause[fieldToMatch] = {
              $elemMatch: {
                value: split[0]
              }
            }
          } else {
            clause[`${fieldToMatch}.value`] = split[0]
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

    tokenToConditionalElemMatch: (fieldToMatch, token, condition) => {
      const conditionSplitArray = condition.replace(/'/g, '').split('=')
      const conditionPath = conditionSplitArray[0]
      const conditionValue = conditionSplitArray[1]

      const clause = {}
      clause[fieldToMatch] = {
        $elemMatch: {
          value: token
        }
      }
      clause[fieldToMatch].$elemMatch[conditionPath] = conditionValue

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

    boolToMongoClause: (type, value) => {
      const addToClause = (value) => {
        const clause = {}
        clause[`${type}`] = value === 'true'
        return clause
      }

      return addToClause(value)
    },

    dateToMongoClause: (fieldToMatch, date) => {
      const buildQuery = (date) => {
        let operator = date.substring(0, 2)
        let dateString = date
        const mongoOperators = {
          eq: '$regex', // allow partial match for period dates - eg, 2017, 2017-01
          ne: '$ne',
          lt: '$lt',
          le: '$lte',
          gt: '$gt',
          ge: '$gte'
        }

        const clause = {}

        if (!mongoOperators[operator]) {
          operator = 'eq'
        } else {
          dateString = date.substring(2)
        }

        clause[fieldToMatch] = {}
        if (mongoOperators[operator] === '$regex') {
          clause[fieldToMatch][mongoOperators[operator]] = `^${dateString}`
          return clause
        }
        clause[fieldToMatch][mongoOperators[operator]] = dateString

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
      const buildQuery = (address) => {
        switch (modifier) {
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

    stringToMongoClause: (pathToMatch, value, modifier) => {
      const buildQuery = (value) => {
        let options = null
        switch (modifier) {
          case 'exact':
            value = `^${value}$`
            break
          case 'contains':
            options = 'i'
            break
          default:
            options = 'i'
            value = `^${value}`
        }

        const query = {}
        query[pathToMatch] = { $regex: value }
        if (options) { query[pathToMatch].$options = options }

        return query
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

    validateFullSourceIdentifierToken: (token) => {
      const split = token.split('|')
      if (split.length < 2 || !split[0]) {
        return new Error('sourceIdentifier Assigning Authority not found')
      }
      return null
    },

    paramAsReference: paramAsReference,

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
          clause.$and.push(buildClauseForPeriod(op, fields, param))
        } else {
          const field = fields
          clause.$and.push(buildClauseForDate(op, field, param))
        }
      }

      clause = mongo.util.collapseWhenSingleClause(clause)
      return clause
    },

    wrapInExtensionUrlFilter: (query, extensionUrl) => {
      const clause = {
        extension: {
          $elemMatch: Object.assign({ url: extensionUrl }, query)
        }
      }
      return clause
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
    },

    filterOutProperties: (rawObj, properties) => {
      return Object.keys(rawObj)
        .filter(key => !properties.includes(key))
        .reduce((obj, key) => {
          obj[key] = rawObj[key]
          return obj
        }, {})
    }
  }
}
