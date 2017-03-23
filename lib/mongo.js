'use strict'
const MongoClient = require('mongodb').MongoClient
const config = require('./config')
const logger = require('winston')

const collapseWhenSingleClause = (query) => {
  if (query['$and']) {
    if (query['$and'].length === 1) {
      query = collapseWhenSingleClause(query['$and'][0])
    } else {
      query['$and'].forEach((obj, index, array) => {
        array[index] = collapseWhenSingleClause(obj)
      })
    }
  } else if (query['$or']) {
    if (query['$or'].length === 1) {
      query = collapseWhenSingleClause(query['$or'][0])
    } else {
      query['$or'].forEach((obj, index, array) => {
        array[index] = collapseWhenSingleClause(obj)
      })
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
