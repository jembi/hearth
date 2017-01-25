'use strict'
const _ = require('lodash')

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
    }
  }
}
