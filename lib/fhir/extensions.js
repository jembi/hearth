'use strict'

const extensionConf = require('../../config/queryparam-extensions.json')
const constants = require('../constants')

module.exports = (queryParams, resourceType) => {
  const buildQuery = (paramConf, paramVal) => {
    const query = {
      extension: {
        $elemMatch: { url: paramConf.url }
      }
    }
    query.extension['$elemMatch'][paramConf.valuePropPath] = paramVal
    return query
  }

  return {
    generateSearchFiltersForExtensions: () => {
      const queries = []

      if (extensionConf[resourceType]) {
        for (let param in queryParams) {
          if (queryParams[param] && extensionConf[resourceType][param]) {
            const paramConf = extensionConf[resourceType][param]

            if (Array.isArray(queryParams[param][constants.NO_MODIFER])) {
              queryParams[param][constants.NO_MODIFER].forEach((paramVal) => {
                queries.push(buildQuery(paramConf, paramVal))
              })
            } else {
              queries.push(buildQuery(paramConf, queryParams[param][constants.NO_MODIFER]))
            }
          }
        }

        return queries
      }

      return []
    }
  }
}
