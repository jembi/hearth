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

// Instantiate FHIR root handling
const fhirRoot = require('./fhir/root')(mongo, fhirResources)

// Setup express
let app = express()

app.use(bodyParser.json({limit: '10Mb'}))
app.use(cors({ exposedHeaders: 'Location' }))

const startTime = moment()
app.get('/api/heartbeat', (req, res) => res.send({uptime: moment().diff(startTime)}))

app.get('/api/authenticate/:email', user.authenticate)

app.use(authentication.authenticate)
app.use(authorization.loadAuthorizer)

const setupContext = (req, res, next) => {
  const ctx = {
    authenticatedUser: res.locals.authenticatedUser,
    authorizer: res.locals.authorizer,
    url: req.originalUrl,
    query: req.query,
    headers: req.headers
  }
  res.locals.ctx = ctx
  next()
}

app.use(setupContext)

// Everything after here will require authentication and authorisation

// User API - non-FHIR specific
app.get('/api/user', user.search)
app.get('/api/user/:email', user.read)
app.post('/api/user', user.create)
app.put('/api/user/:email', user.update)

// FHIR Services
app.get('/fhir/ValueSet/:operation', terminologyService.lookup)

const buildCoreCallbackHandler = (req, res, next) => {
  return (err, outcome) => {
    if (err) {
      return next(err)
    }
    res.locals.outcome = outcome
    next()
  }
}

// FHIR root handler
app.post('/fhir', (req, res, next) => {
  fhirRoot.transaction(res.locals.ctx, req.body, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir', (req, res, next) => {
  fhirRoot.searchAll(res.locals.ctx, buildCoreCallbackHandler(req, res, next))
})
app.options('/fhir', (req, res, next) => {
  fhirRoot.conformance(res.locals.ctx, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/metadata', (req, res, next) => {
  fhirRoot.conformance(res.locals.ctx, buildCoreCallbackHandler(req, res, next))
})

// FHIR Resource Interactions - handled by fhirCore which delagates to resource modules if needed
app.get('/fhir/:resourceType', (req, res, next) => {
  fhirCore.search(res.locals.ctx, req.params.resourceType, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/:resourceType/:id', (req, res, next) => {
  fhirCore.read(res.locals.ctx, req.params.resourceType, req.params.id, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/:resourceType/:id/_history/:vid', (req, res, next) => {
  fhirCore.vread(res.locals.ctx, req.params.resourceType, req.params.id, req.params.vid, buildCoreCallbackHandler(req, res, next))
})
app.post('/fhir/:resourceType', (req, res, next) => {
  fhirCore.create(res.locals.ctx, req.params.resourceType, req.body, buildCoreCallbackHandler(req, res, next))
})
app.put('/fhir/:resourceType/:id', (req, res, next) => {
  fhirCore.update(res.locals.ctx, req.params.resourceType, req.params.id, req.body, buildCoreCallbackHandler(req, res, next))
})

const outcomeHandler = (req, res, next) => {
  if (!res.locals.outcome) {
    return next(new Error('Interaction outcome not set'))
  }

  if (res.locals.outcome.location) {
    res.set('Location', res.locals.outcome.location)
  }
  if (res.locals.outcome.resource) {
    res.status(res.locals.outcome.httpStatus).send(res.locals.outcome.resource)
  } else {
    res.sendStatus(res.locals.outcome.httpStatus)
  }
}

app.use(outcomeHandler)

// Error handler
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
