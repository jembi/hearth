'use strict'
const _ = require('lodash')
const ObjectID = require('mongodb').ObjectID

module.exports = (mongo) => {
  return {
    /**
     * Sorts a FHIR transaction bundle so that the interaction are in the correct
     * order and returns a new Bundle object that is sorted.
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
     * @param {String} id The resource's id
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
    }
  }
}
