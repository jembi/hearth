 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const _ = require('lodash')

/**
 * Transaction utilities
 */
module.exports = (mongo) => {
  return {
    /**
     * Sorts a FHIR transaction or batch bundle so that the interaction are in
     * the correct order and returns a new Bundle object that is sorted. It also
     * stored the original index of each entry in _originalIndex.
     *
     * @param {Object} bundle the bundle to sort
     * @return {Object} the sorted bundle
     */
    sortTransactionBundle: (bundle) => {
      const sortOrder = {
        DELETE: 0,
        POST: 1,
        PUT: 2,
        GET: 3
      }

      const ret = _.cloneDeep(bundle)

      // store original index
      ret.entry.forEach((entry, i) => {
        entry._originalIndex = i
      })

      ret.entry.sort((a, b) => {
        return sortOrder[a.request.method] - sortOrder[b.request.method]
      })

      return ret
    },

    /**
     * @callback RevertCreateCallback
     * @param {Object} err
     * @param {Boolean} success Whether a document with the matching id was deleted.
     */
    /**
     * Undo the creation of a new resource. Effectively just deletes the document.
     *
     * @param {String} resourceType The type of resource
     * @param {String} id The resource's id
     * @param {RevertCreateCallback} callback
     */
    revertCreate: (resourceType, id, callback) => {
      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        let c = db.collection(resourceType)
        c.deleteOne({ id: id }, (err, result) => {
          if (err) {
            return callback(err)
          }
          callback(null, result.deletedCount === 1)
        })
      })
    },

    /**
     * @callback RevertUpdateCallback
     * @param {Object} err
     * @param {Boolean} success Whether the document was reverted
     */
    /**
     * Undo the update of an existing resource.  Effectively deletes the updated document, and retrieve the latest version from history
     *
     * @param {String} resourceType
     * @param {String} id
     * @param {RevertUpdateCallback} callback
     */
    revertUpdate: (resourceType, id, callback) => {
      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const c = db.collection(resourceType)
        const cHistory = db.collection(`${resourceType}_history`)
        cHistory.findOneAndDelete({ id: id }, { sort: { '_transforms.meta.lastUpdated': -1 } }, (err, result) => {
          if (err) {
            return callback(err)
          }

          if (result.value) {
            delete result.value._id
            c.findOneAndReplace({ id: id }, result.value, (err, result) => {
              if (err) {
                return callback(err)
              }
              callback(null, !!result.value)
            })
          } else {
            c.deleteOne({ id: id }, (err, result) => {
              if (err) {
                return callback(err)
              }
              callback(null, result.deletedCount)
            })
          }
        })
      })
    },

    /**
     * @callback RevertDeleteCallback
     * @param {Object} err
     * @param {Boolean} success Whether the document was reverted
     */
    /**
     * Undo the deletion of an existing resource.  Effectively remove latest from history collection and add to resource collection
     *
     * @param {String} resourceType
     * @param {String} id
     * @param {RevertUpdateCallback} callback
     */
    revertDelete: (resourceType, id, callback) => {
      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const c = db.collection(resourceType)
        const cHistory = db.collection(`${resourceType}_history`)
        cHistory.findOneAndDelete({ id: id }, { sort: { '_transforms.meta.lastUpdated': -1 } }, (err, result) => {
          if (err) {
            return callback(err)
          }
          // ensure findoneanddelete return deleted document
          if (!result.value) {
            return callback(null, false)
          }

          delete result.value._id
          c.findOneAndReplace({ id: id }, result.value, { upsert: true }, (err, result) => {
            if (err) {
              return callback(err)
            }
            callback(null, true)
          })
        })
      })
    }
  }
}
