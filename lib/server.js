'use strict'
require('./init')

const logger = require('winston')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const moment = require('moment')
const fs = require('fs')
const path = require('path')
const URL = require('url')

const config = require('./config')
const mongo = require('./mongo')()
const user = require('./custom-api/user')(mongo)
const authentication = require('./security/authentication')(mongo)
const authorization = require('./security/authorization')(mongo)
const terminologyService = require('./fhir/services/terminology-service')(mongo)
const fhirCommon = require('./fhir/common')(mongo)
const hooks = require('./fhir/hooks')()
const matchingQueue = require('./matching-queue/matching-queue')(mongo)

process.title = 'Hearth'

// Load FHIR resource modules
let fhirResources = {}
fs.readdirSync(path.resolve(`${global.appRoot}/lib/fhir/resources`)).forEach((file) => {
  let module = require(`./fhir/resources/${file}`)(mongo)
  fhirResources[module.name] = module
  logger.info(`Loaded FHIR resource module: ${module.name}`)
})

// Load plugins
fs.readdirSync(path.resolve(`${global.appRoot}/lib/plugins`)).forEach((file) => {
  const plugin = require(`./plugins/${file}`)(mongo)
  if (plugin.userTypeRestrictions) {
    authorization.addUserTypeRestrictions(plugin.userTypeRestrictions)
  }
  if (plugin.hooks) {
    hooks.addHooks(plugin.hooks)
  }
})

// Instantiate FHIR core with the available resource modules
const fhirCore = require('./fhir/core')(mongo, fhirResources)

// Instantiate FHIR root handling
const fhirRoot = require('./fhir/root')(mongo, fhirResources)

// Setup express
let app = express()

app.use(bodyParser.json({limit: '10Mb', type: ['application/json+fhir', 'application/json']}))
app.use(cors({ exposedHeaders: 'Location' }))

const startTime = moment()
app.get('/api/heartbeat', (req, res) => res.send({uptime: moment().diff(startTime)}))

app.get('/api/authenticate/:email', user.authenticate)

app.use(authentication.authenticate)

const checkForOperation = (req, res, next) => {
  const url = URL.parse(req.url)
  const parts = url.pathname.split('/')
  const lastSegment = parts.pop()

  if (lastSegment[0] === '$') {
    url.pathname = parts.join('/')
    req.url = URL.format(url)
    res.locals.operation = lastSegment
  }
  next()
}

app.use(checkForOperation)

const setupContext = (req, res, next) => {
  const fhirDomain = config.getConf('server:publicFhirBase')
  const parts = fhirDomain.split('/')
  parts.pop()
  const fullUrl = parts.join('/') + req.originalUrl

  const ctx = {
    authenticatedUser: res.locals.authenticatedUser,
    url: req.originalUrl,
    query: req.query,
    headers: req.headers,
    operation: res.locals.operation,
    domain: fhirDomain,
    fullUrl: fullUrl,
    requestorIp: req.connection.remoteAddress
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
app.get('/fhir/ValueSet', terminologyService.lookup)

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
  fhirRoot.processRootBundle(res.locals.ctx, req.body, buildCoreCallbackHandler(req, res, next))
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
  if (res.locals.ctx.operation === '$match') {
    return fhirCore.match(res.locals.ctx, req.params.resourceType, req.body, buildCoreCallbackHandler(req, res, next))
  }
  fhirCore.create(res.locals.ctx, req.params.resourceType, req.body, buildCoreCallbackHandler(req, res, next))
})
app.put('/fhir/:resourceType/:id', (req, res, next) => {
  fhirCore.update(res.locals.ctx, req.params.resourceType, req.params.id, req.body, buildCoreCallbackHandler(req, res, next))
})
app.delete('/fhir/:resourceType/:id', (req, res, next) => {
  fhirCore.delete(res.locals.ctx, req.params.resourceType, req.params.id, buildCoreCallbackHandler(req, res, next))
})

const returnContentTypeHandler = (req, res, next) => {
  if (res.locals.outcome && res.locals.outcome.resource) {
    const accepts = req.accepts(['application/json+fhir', 'application/json'])
    if (accepts) {
      res.set('content-type', accepts)
    } else {
      return res.sendStatus(406) // not acceptable
    }
  }

  next()
}

app.use(returnContentTypeHandler)

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

const workers = {}
let start = (callback) => {
  server = app.listen(config.getConf('server:port'), config.getConf('server:hostname'), () => {
    logger.info(`[${process.env.NODE_ENV}] Hearth FHIR server running on ${server.address().address}:${server.address().port}`)
    matchingQueue.startQueueWorkers(workers, config.getConf('matchingQueue:numberOfWorkers'), (err) => {
      if (err) {
        logger.error(`Problem with one or more workers in the matching queue ${err}`)
        return callback(err)
      }
      logger.info('Workers for matching queue successfully started')
      callback()
    })
  })
}

let stop = (callback) => {
  Object.keys(workers).forEach((key) => {
    workers[key].kill()
  })
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

      // interrupt signal, e.g. ctrl-c
      process.on('SIGINT', () => stop(process.exit))
      // terminate signal
      process.on('SIGTERM', () => stop(process.exit))
    })
  })
}

exports.start = start
exports.stop = stop
exports.workers = workers
