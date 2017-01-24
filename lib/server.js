'use strict'
require('./init')

const logger = require('winston')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const moment = require('moment')
const fs = require('fs')
const path = require('path')

const config = require('./config')
const mongo = require('./mongo')()
const user = require('./custom-api/user')(mongo)
const authentication = require('./security/authentication')(mongo)
const authorization = require('./security/authorization')(mongo)
const terminologyService = require('./fhir/services/terminology-service')(mongo)
const fhirCommon = require('./fhir/common')(mongo)

// Load FHIR resource modules
let fhirResources = {}
fs.readdirSync(path.resolve(`${global.appRoot}/lib/fhir/resources`)).forEach((file) => {
  let module = require(`./fhir/resources/${file}`)(mongo)
  fhirResources[module.name] = module
  logger.info(`Loaded FHIR resource module: ${module.name}`)
})

// Instantiate FHIR core with the available resource modules
const fhirCore = require('./fhir/core')(mongo, fhirResources)

// Instantiate FHIR base handlling
const fhirRoot = require('./fhir/rootHandler')(mongo)

// Setup express
let app = express()

app.use(bodyParser.json({limit: '10Mb'}))
app.use(cors({ exposedHeaders: 'Location' }))

const startTime = moment()
app.get('/api/heartbeat', (req, res) => res.send({uptime: moment().diff(startTime)}))

app.get('/api/authenticate/:email', user.authenticate)

app.use(authentication.authenticate)
app.use(authorization.loadAuthorizer)
// Everything after here will require authentication and authorisation

// User API - non-FHIR specific
app.get('/api/user', user.search)
app.get('/api/user/:email', user.read)
app.post('/api/user', user.create)
app.put('/api/user/:email', user.update)

// FHIR Services
app.get('/fhir/ValueSet/:operation', terminologyService.lookup)

// FHIR Interactions - handled by fhirCore which delagates to resource modules if needed
app.get('/fhir/:resourceType', fhirCore.search)
app.get('/fhir/:resourceType/:id', fhirCore.read)
app.get('/fhir/:resourceType/:id/_history/:vid', fhirCore.vread)
app.post('/fhir/:resourceType', fhirCore.create)
app.put('/fhir/:resourceType/:id', fhirCore.update)

// FHIR root handling
app.post('/fhir', fhirRoot.transaction)
app.get('/fhir', fhirRoot.searchAll)
app.options('/fhir', fhirRoot.conformance)
app.get('/fhir/metadata', fhirRoot.conformance)

// Default error handler
app.use((err, req, res, next) => {
  logger.error(err)
  res.status(500).send(fhirCommon.internalServerErrorOutcome())
})

// server handle
let server = null

let start = (callback) => {
  server = app.listen(config.getConf().server.port, config.getConf().server.hostname, () => {
    logger.info(`[${process.env.NODE_ENV}] Hearth FHIR server running on ${server.address().address}:${server.address().port}`)
    callback()
  })
}

let stop = (callback) => {
  server.close(() => {
    mongo.closeDB(callback)
  })
}

if (!module.parent) {
  start(() => {
    user.loadDefaultSysadmin((err) => {
      if (err) {
        logger.error(err)
      }

      process.on('exit', stop)
      // interrupt signal, e.g. ctrl-c
      process.on('SIGINT', () => stop(process.exit))
      // terminate signal
      process.on('SIGTERM', () => stop(process.exit))
    })
  })
}

exports.start = start
exports.stop = stop
