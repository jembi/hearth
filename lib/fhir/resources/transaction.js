'use strict'
const _ = require('lodash')

module.exports = (mongo) => {
  return {
    name: 'Transaction',

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

      console.log(ret.type)
      if (ret.type && ret.type !== 'transaction') {
        console.log('throwing up')
        throw new Error('Bundle is not of type transaction')
      }

      ret.entry.sort((a, b) => {
        return sortOrder[a.request.method] - sortOrder[b.request.method]
      })

      return ret
    }
  }
}
