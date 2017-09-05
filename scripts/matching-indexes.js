 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const resourceConfig = require('../config/matching').resourceConfig

module.exports = (mongo) => {
  return {
    createMatchingIndexes: (callback) => {
      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        const promises = []
        Object.keys(resourceConfig).forEach((collection) => {
          const c = db.collection(collection)

          if (resourceConfig[collection].matchingProperties) {
            Object.keys(resourceConfig[collection].matchingProperties).forEach((path) => {
              promises.push(c.createIndex({ [path]: 1 }))
              promises.push(c.createIndex({ [`_transforms.matching.${path}`]: 1 }))
            })
          }
          if (resourceConfig[collection].discriminatorProperties) {
            Object.keys(resourceConfig[collection].discriminatorProperties).forEach((path) => {
              promises.push(c.createIndex({ [path]: 1 }))
              promises.push(c.createIndex({ [`_transforms.matching.${path}`]: 1 }))
            })
          }
        })

        Promise.all(promises).then(() => {
          callback()
        }).catch((err) => {
          callback(err)
        })
      })
    }
  }
}
