 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const logger = require('winston')

const fhirResources = {}

function getLoadedModules () {
  return fhirResources
}

function getLoadedModule (resourceType) {
  return fhirResources[resourceType]
}

module.exports = exports = (mongo) => {
  return {
    loadModules: () => {
      fs.readdirSync(path.resolve(`${global.appRoot}/lib/fhir/resources`)).filter(function(file) { return path.extname(file) === '.js' } ).forEach((file) => {
        let module = require(`./resources/${file}`)(mongo)
        fhirResources[module.name] = module
        logger.info(`Loaded FHIR resource module: ${module.name}`)
      })
    },

    getLoadedModules: getLoadedModules
  }
}

exports.getLoadedModule = getLoadedModule
exports.getLoadedModules = getLoadedModules
