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

          Object.keys(resourceConfig[collection].matchingProperties).forEach((path) => {
            promises.push(c.createIndex({ [path]: 1 }))
            promises.push(c.createIndex({ [`_transforms.matching.${path}`]: 1 }))
          })
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
