 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const matchingConfig = require('../../config/matching')

const algorithms = {
  'double-metaphone': require('talisman/phonetics/double-metaphone')
}

const walk = require('../../lib/path-walker')

module.exports = () => {
  const assignValueToObjectAtPath = (obj, keyPath, value) => {
    const lastKeyIndex = keyPath.length - 1
    keyPath.forEach((key, index) => {
      if (index === lastKeyIndex) {
        obj[key] = value
      }

      if (!obj[key]) {
        obj[key] = {}
      }

      obj = obj[key]
    })
  }

  const addRepresentationToResource = (representation, resource, path) => {
    if (!resource._transforms) {
      resource._transforms = {}
    }
    if (!resource._transforms.matching) {
      resource._transforms.matching = {}
    }

    assignValueToObjectAtPath(resource._transforms.matching, path.split('.'), representation)
  }

  const addRepresentationForPath = (path, pathConfig, resource, algorithmTypeMap) => {
    if (algorithmTypeMap[pathConfig.algorithm] === 'exact-match-representation') {
      const fieldValue = walk(path, resource)
      if (!fieldValue) {
        return // continue loop
      }

      if (Array.isArray(fieldValue)) {
        if (fieldValue.length > 0) {
          const representationValues = []
          fieldValue.forEach((val) => {
            representationValues.push(algorithms[pathConfig.algorithm](val))
          })

          addRepresentationToResource(representationValues, resource, path)
        }
      } else {
        const representation = algorithms[pathConfig.algorithm](fieldValue)
        addRepresentationToResource(representation, resource, path)
      }
    }
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
              const matchingPathConfigs = matchingConfig.resourceConfig[resourceType].matchingProperties
              const discriminatorPathConfigs = matchingConfig.resourceConfig[resourceType].discriminatorProperties
              const algorithmTypeMap = matchingConfig.matchSettings.algorithmTypeMap

              try {
                if (matchingPathConfigs) {
                  Object.keys(matchingPathConfigs).forEach((path) => {
                    addRepresentationForPath(path, matchingPathConfigs[path], resource, algorithmTypeMap)
                  })
                }
                if (discriminatorPathConfigs) {
                  Object.keys(discriminatorPathConfigs).forEach((path) => {
                    addRepresentationForPath(path, discriminatorPathConfigs[path], resource, algorithmTypeMap)
                  })
                }
              } catch (err) {
                return callback(err)
              }
            }

            callback(null, null, resource)
          }
        }
      ]
    }
  }
}
