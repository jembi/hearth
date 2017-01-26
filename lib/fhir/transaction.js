'use strict'
const _ = require('lodash')
const ObjectID = require('mongodb').ObjectID

/**
 * Transaction utilities
 */
module.exports = (mongo) => {
  return {
    /**
     * Sorts a FHIR transaction bundle so that the interaction are in the correct
     * order and returns a new Bundle object that is sorted. It also stored the
     * original index of each entry in _originalIndex.
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

      if (ret.type && ret.type !== 'transaction') {
        throw new Error('Bundle is not of type transaction')
      }

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
        c.deleteOne({ _id: ObjectID(id) }, (err, result) => {
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
     * @param {Boolean} success Whether a document with the matching id was deleted and the newest entry in history set to latest
     */
    /**
     * Undo the update of an existing resource.  Effectively delete the updated document, query newest in that document history and set to latest
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
        let c = db.collection(resourceType)
        c.findOne({ _id: ObjectID(id) }, {}, (err, doc) => {
          if (err) {
            return callback(err)
          }
          if (!doc) {
            return callback(null, false)
          }

          let previousLatest = String(Math.max(Object.keys(doc.history).map((key) => parseInt(key))))
          doc.latest = doc.history[previousLatest].resource
          doc.request = doc.history[previousLatest].request
          if (previousLatest === '1') {
            delete doc.history
          } else {
            delete doc.history[previousLatest]
          }

          c.updateOne({ _id: ObjectID(id) }, doc, (err, doc) => {
            if (err) {
              return callback(err)
            }
            callback(null, !!doc)
          })
        })
      })
    }
  }
}
