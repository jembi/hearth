/**
* Copyright (c) 2017-present, Jembi Health Systems NPC.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict'

const FHIR = require('fhir')
const config = require('../config')

const profileLoader = require('../fhir/profile-loader')()

let fhir = null
switch (config.getConf('server:fhirVersion')) {
  case 'dstu1':
    fhir = new FHIR(FHIR.DSTU1)
    break
  case 'dstu2':
    fhir = new FHIR(FHIR.DSTU2)
    break
  case 'stu3':
    fhir = new FHIR(FHIR.STU3)
    break
}

module.exports = () => {
  return {
    hooks: {
      before: [
        {
          resourceType: '*',
          interactions: ['create', 'update'],
          userType: '*',
          function: (interaction, ctx, resourceType, resource, callback) => {
            if (!config.getConf('validation:enabled')) {
              return callback(null, null)
            }

            const profiles = profileLoader.getProfiles()

            try {
              let result = null
              if (profiles[resourceType]) {
                result = fhir.ValidateJSResource(resource, profiles[resourceType])
              } else {
                result = fhir.ValidateJSResource(resource)
              }

              // handle results
              if (result.valid === true) {
                callback(null, null)
              } else {
                callback(null, {
                  httpStatus: 400,
                  resource: {
                    resourceType: 'OperationOutcome',
                    issue: result.errors.map((error) => {
                      return {
                        severity: 'error',
                        code: 'invalid',
                        details: { text: error }
                      }
                    })
                  }
                })
              }
            } catch (err) {
              callback(err)
            }
          }
        }
      ]
    }
  }
}
