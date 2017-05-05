'use strict'

const mongoDbQueue = require('mongodb-queue')
const logger = require('winston')

module.exports = (mongo) => {
  return {
    hooks: {
      after: [
        {
          resourceType: 'Patient',
          interactions: [ 'create', 'update' ],
          userType: '*',
          function: (interaction, ctx, resourceType, data, callback) => {
            let queue
            mongo.getDB((err, db) => {
              if (err) {
                return callback(err)
              }

              queue = mongoDbQueue(db, 'matchingQueue')
            })

            queue.add(data, (err, id) => {
              if (err) {
                return callback(err)
              }

              logger.info(`New Patient resource: ${data.id} has been added to the matching queue: #${id}`)
              callback(null, null)
            })
          }
        }
      ]
    }
  }
}
