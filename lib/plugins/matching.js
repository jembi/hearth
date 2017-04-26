'use strict'

const matchingConfig = require('../../config/matching')

const algorithms = {
  'double-metaphone': require('talisman/phonetics/double-metaphone')
}

const walk = require('../../lib/path-walker')

module.exports = () => {
  const addRepresentationToResource = (representation, resource, path) => {
    if (!resource._transforms) {
      resource._transforms = {}
    }
    if (!resource._transforms.matching) {
      resource._transforms.matching = {}
    }
    resource._transforms.matching[path] = representation
  }

  return {
    hooks: {
      before: [
        {
          resourceType: '*',
          interactions: [ 'create', 'update' ],
          userType: '*',
          function: (interaction, ctx, resourceType, resource, callback) => {
            if (matchingConfig.resourceConfig[resourceType]) {
              const pathConfigs = matchingConfig.resourceConfig[resourceType].matchingProperties
              const algorithmTypeMap = matchingConfig.matchSettings.algorithmMap

              Object.keys(pathConfigs).forEach((path) => {
                const pathConfig = pathConfigs[path]
                if (algorithmTypeMap[pathConfig.algorithm] === 'exact') {
                  const fieldValue = walk(path, resource)

                  if (Array.isArray(fieldValue)) {
                    const representationValues = []
                    fieldValue.forEach((val) => {
                      representationValues.push(algorithms[pathConfig.algorithm](val))
                    })

                    addRepresentationToResource(representationValues, resource, path)
                  } else {
                    const representation = algorithms[pathConfig.algorithm](fieldValue)
                    addRepresentationToResource(representation, resource, path)
                  }
                }
              })
            }

            callback(null, null)
          }
        }
      ]
    }
  }
}
