 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const mongoDbQueue = require('mongodb-queue')

const matchingConfig = require('../../config/matching')
const constants = require('../constants')

module.exports = (mongo, _fhirResources, logger) => {
  return {
    hooks: {
      after: [
        {
          resourceType: Object.keys(matchingConfig.resourceConfig),
          interactions: [ 'create', 'update' ],
          userType: '*',
          function: (interaction, ctx, resourceType, data, callback) => {
            mongo.getDB((err, db) => {
              if (err) {
                return callback(err)
              }

              const queue = mongoDbQueue(db, constants.MATCHING_QUEUE_COLLECTION)

              queue.add(data, (err, id) => {
                if (err) {
                  return callback(err)
                }

                logger.info(`New ${resourceType} resource: ${data.id} has been added to the matching queue: ${id}`)
                return callback(null, null)
              })
            })
          }
        }
      ]
    }
  }
}
