'use strict'

const mongoDbQueue = require('mongodb-queue')
const logger = require('winston')

const matchingConfig = require('../../config/matching')
const constants = require('../constants')

module.exports = (mongo) => {
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
