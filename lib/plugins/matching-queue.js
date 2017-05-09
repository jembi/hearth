'use strict'

const mongoDbQueue = require('mongodb-queue')
const logger = require('winston')

module.exports = (mongo) => {
  return {
    hooks: {
      after: [
        {
          resourceType: '*',
          interactions: [ 'create', 'update' ],
          userType: '*',
          function: (interaction, ctx, resourceType, data, callback) => {
            mongo.getDB((err, db) => {
              if (err) {
                return callback(err)
              }

              const queue = mongoDbQueue(db, 'matchingQueue')

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
