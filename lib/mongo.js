'use strict'
const MongoClient = require('mongodb').MongoClient
const config = require('./config')
const logger = require('winston')

module.exports = () => {
  let db = null

  return {
    getDB: (callback) => {
      if (db) {
        return callback(null, db)
      }

      let conf = config.getConf('mongodb')
      logger.info(`Initializing MongoDB connection to ${conf.url}`)
      MongoClient.connect(conf.url, (err, database) => {
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
      // if there is just one $and clause, then we don't need the $and
      collapseWhenSingleClause: (query) => ((query['$and'].length === 1) ? query['$and'][0] : query),

      debugLog: (collection, operation, filter, options) => {
        // mongo's own debug logging is quite verbose, so we'll leave its log level as is and handle ourselves
        if (options) {
          logger.debug(`Executing mongo query: ${collection}
            .${operation}(${JSON.stringify(filter)}, ${JSON.stringify(options)})`)
        } else {
            logger.debug(`Executing mongo query: ${collection}.${operation}(${JSON.stringify(filter)})`)
        }
      }
    }
  }
}
