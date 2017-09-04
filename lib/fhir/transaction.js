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
