 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const MongoClient = require('mongodb').MongoClient
const config = require('./config')
const logger = require('winston')

const collapseWhenSingleClause = (query) => {
  const collapseOperatorsList = ['$and', '$or']

  for (const mainKey in query) { // foreach property in object
    if (collapseOperatorsList.indexOf(mainKey) !== -1) { // check if key exist in list of operators to collapse
      if (Array.isArray(query[mainKey])) {  // verify this is an array
        if (query[mainKey].length === 1) { // check the length of the array
          if (Object.keys(query).length === 1) { // if length is 1, replace the entire query variable
            query = collapseWhenSingleClause(query[mainKey][0])
          } else { // replace only the current mainKey/value property
            const newObj = collapseWhenSingleClause(query[mainKey][0])
            for (const key in newObj) {
              query[key] = newObj[key]
            }
            delete query[mainKey] // delete original key/value
          }
        } else { // apply collapse for each item in the array
          query[mainKey].forEach((obj, index, array) => {
            array[index] = collapseWhenSingleClause(obj)
          })
        }
      }
    }
  }

  return query
}

module.exports = () => {
  let db = null

  return {
    getDB: (callback) => {
      if (db) {
        return callback(null, db)
      }

      const mongoUrl = config.getConf('mongodb:url')
      logger.info(`Initializing MongoDB connection to ${mongoUrl}`)
      MongoClient.connect(mongoUrl, (err, database) => {
        if (err) {
          return callback(err)
        }
        db = database
        callback(null, db)
      })
    },

    closeDB: (callback) => {
      if (!db) {
        return callback()
      }

      logger.debug('Closing db')
      db.close((err) => {
        db = null
        callback(err)
      })
    },

    util: {
      // if there is just one $and/$or clause, then we don't need the $and/$or - used recursively
      collapseWhenSingleClause: collapseWhenSingleClause,

      hasQueryOperators: (query) => {
        return (query['$and'] && query['$and'].length !== 0) || (query['$or'] && query['$or'].length !== 0)
      },

      debugLog: (collection, operation, filter, options) => {
        // mongo's own debug logging is quite verbose, so we'll leave its log level as is and handle ourselves
        if (options) {
          logger.debug('Executing mongo query: %s.%s(%j, %j)', collection, operation, filter, options)
        } else {
          logger.debug('Executing mongo query: %s.%s(%j)', collection, operation, filter)
        }
      }
    }
  }
}
