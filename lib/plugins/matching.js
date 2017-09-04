/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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

            callback(null, null)
          }
        }
      ]
    }
  }
}
