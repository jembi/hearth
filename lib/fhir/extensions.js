 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const extensionConf = require('../../config/queryparam-extensions.json')
const QueryUtils = require('./query-utils')

module.exports = (mongo, queryObject, resourceType) => {
  const queryUtils = QueryUtils(mongo)

  return {
    generateSearchFiltersForExtensions: () => {
      const queries = []

      if (extensionConf[resourceType]) {
        for (let param in queryObject) {
          if (queryObject[param] && extensionConf[resourceType][param]) {
            const paramConf = extensionConf[resourceType][param]

            for (const modifier in queryObject[param]) {
              queries.push(queryUtils.extensionToMongoClause(paramConf, queryObject[param][modifier], modifier))
            }
          }
        }
      }
      return queries
    }
  }
}
