'use strict'

const fs = require('fs')
const path = require('path')
const logger = require('winston')

const fhirResources = {}

module.exports = (mongo) => {
  return {
    loadModules: () => {
      fs.readdirSync(path.resolve(`${global.appRoot}/lib/fhir/resources`)).forEach((file) => {
        let module = require(`./resources/${file}`)(mongo)
        fhirResources[module.name] = module
        logger.info(`Loaded FHIR resource module: ${module.name}`)
      })
    },

    getLoadedModules: () => {
      return fhirResources
    }
  }
}

