/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
