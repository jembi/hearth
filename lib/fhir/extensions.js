'use strict'

const extensionConf = require('../../config/queryparam-extensions.json')

module.exports = (queryParams, resourceType) => {
  return {
    generateSearchFiltersForExtensions: () => {
      const queries = []

      if (extensionConf[resourceType]) {
        for (let param in queryParams) {
          if (queryParams[param] && extensionConf[resourceType][param]) {
            const paramConf = extensionConf[resourceType][param]

            const query = {
              extension: {
                $elemMatch: { url: paramConf.url }
              }
            }
            query.extension['$elemMatch'][paramConf.valuePropPath] = queryParams[param]['default']

            queries.push(query)
          }
        }

        return queries
      }

      return []
    }
  }
}
