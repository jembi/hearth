'use strict'

const mongoDbQueue = require('mongodb-queue')
const logger = require('winston')

module.exports = (mongo) => {

  const returnObj = {
    hooks: {
      after: [
        {
          resourceType: 'Patient',
          interactions: [ 'create', 'update' ],
          userType: '*',
          function: (interaction, ctx, resourceType, data, callback) => {
            if (returnObj.hooks.after[0].interactions.indexOf(interaction) === -1) {
              let badRequestError = new Error(`Supplied interaction "${interaction}" is not supported in this plugin`)
              return callback(null, badRequestError)
            }

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
              const queueObj = {
                patientId: data.id,
                queueId: id
              }
              callback(null, null, queueObj)
            })
          }
        }
      ]
    }
  }

  return returnObj
}
