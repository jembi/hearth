'use strict'

module.exports = () => {
  return {
    hooks: {
      before: [
        {
          resourceType: '*',
          interactions: '*',
          userType: '*',
          function: (interaction, ctx, resourceType, resource, callback) => {
            // pre-process fields in a resource according to the matching config
            callback(null, null, resource)
          }
        }
      ]
    }
  }
}
