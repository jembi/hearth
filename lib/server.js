 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
require('./init')

const logger = require('./logger')
const express = require('express')
const bodyParser = require('body-parser')
const xmlParser = require('express-xml-bodyparser')
const cors = require('cors')
const moment = require('moment')
const fs = require('fs')
const path = require('path')
const URL = require('url')
const FHIR = require('fhir')

const config = require('./config')
const mongo = require('./mongo')()
const user = require('./custom-api/user')(mongo)
const session = require('./custom-api/session')(mongo)
const ohmAuthentication = require('./security/openhim-style-authentication')(mongo)
const noAuthentication = require('./security/disabled-authentication')(mongo)
const authorization = require('./security/authorization')(mongo)
const terminologyService = require('./fhir/services/terminology-service')(mongo)
const fhirCommon = require('./fhir/common')(mongo)
const hooks = require('./fhir/hooks')()
const matchingQueue = require('./matching-queue/matching-queue')(mongo)
const matchingIndexes = require('../scripts/matching-indexes')(mongo)
const moduleLoader = require('./fhir/module-loader')(mongo)
const profileLoader = require('./fhir/profile-loader')()

const acceptedJSONContentTypes = ['application/json+fhir', 'application/fhir+json', 'application/json', 'text/json']
const acceptedXMLContentTypes = ['application/xml+fhir', 'application/fhir+xml', 'application/xml', 'text/xml']

process.title = 'Hearth'

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

if (config.getConf('createIndexes')) {
  matchingIndexes.createMatchingIndexes((err) => {
    if (err) {
      logger.error(err)
    }
    logger.info('Matching Indexes created')
  })
}

moduleLoader.loadModules()
const fhirResources = moduleLoader.getLoadedModules()

// Load validation profiles
const validationConf = config.getConf('validation')
if (validationConf.enabled) {
  profileLoader.loadProfiles(validationConf.additionProfilePaths)
}

// Load plugins
fs.readdirSync(path.resolve(`${global.appRoot}/lib/plugins`)).forEach((file) => {
  const plugin = require(`./plugins/${file}`)(mongo, fhirResources)
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

app.use(bodyParser.json({limit: '10Mb', type: acceptedJSONContentTypes}))
app.use(xmlParser())
app.use(cors({ exposedHeaders: 'Location' }))

// Public API endpoints
const startTime = moment()
app.get('/api/heartbeat', (req, res) => res.send({uptime: moment().diff(startTime)}))
app.get('/api/authenticate/:email', user.authenticate)
app.post('/api/session', session.create)

if (config.getConf('authentication:enablePublicUserCreation')) {
  logger.warn('Public user creation is enabled on /api/user')
  app.post('/api/user', user.create)
}

switch (config.getConf('authentication:type')) {
  case 'openhim-style':
    logger.info('Using OpenHIM style authentication')
    app.use(ohmAuthentication.authenticate)
    break
  case 'disabled':
    logger.warn('Authentication is disabled')
    app.use(noAuthentication.authenticate)
    break
  case 'jwt':
    logger.info('Using JWT authentication')
    const jwtAuthentication = require('./security/jwt-authentication')(mongo)
    app.use(jwtAuthentication.authenticate)
    break
  default:
    logger.warn(`Authenticate type of ${config.getConf('authentication:type')} not recognized, defaulting to openhim style authentication`)
    app.use(ohmAuthentication.authenticate)
}

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
app.put('/api/user/:email', user.update)
if (!config.getConf('authentication:enablePublicUserCreation')) {
  app.post('/api/user', user.create)
}

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

const incomingAcceptsContentTypeHandler = (req, res, next) => {
  // if there is a _format parameter, override accept header
  if (req.query._format) {
    if (([].concat(acceptedJSONContentTypes).concat(acceptedXMLContentTypes)).includes(req.query._format)) {
      res.set('content-type', req.query._format)
      delete req.query._format
    } else {
      return res.sendStatus(406) // not acceptable
    }
  } else {
    const accepts = req.accepts([].concat(acceptedJSONContentTypes).concat(acceptedXMLContentTypes))

    if (accepts) {
      res.set('content-type', accepts)
    } else {
      return res.sendStatus(406) // not acceptable
    }
  }

  next()
}

app.use(incomingAcceptsContentTypeHandler)

const contentTypeNegotiation = (req, res, next) => {
  // transform XML body into JSON for processing if content type is xml and rawBody exists
  if (req.rawBody && req.get('content-type') && acceptedXMLContentTypes.includes(req.get('content-type'))) {
    fhir.XmlToJson(req.rawBody).then((jsonObj) => {
      req.body = JSON.parse(jsonObj)
      next()
    })
    .catch((err) => {
      res.status(500).send(err)
    })
  } else {
    next()
  }
}

app.use(contentTypeNegotiation)

const outcomeHandler = (req, res, next) => {
  if (!res.locals.outcome) {
    return next(new Error('Interaction outcome not set'))
  }

  if (res.locals.outcome.location) {
    res.set('Location', res.locals.outcome.location)
  }
  if (res.locals.outcome.etag) {
    res.set('ETag', `W/"${res.locals.outcome.etag}"`)
  }
  if (res.locals.outcome.resource) {
    let tranformedData = res.locals.outcome.resource

    // transform content into XML as specified by content-type
    if (acceptedXMLContentTypes.includes(res.get('content-type'))) {
      tranformedData = fhir.JsonToXml(JSON.stringify(res.locals.outcome.resource))
    }

    res.status(res.locals.outcome.httpStatus).send(tranformedData)
  } else {
    res.sendStatus(res.locals.outcome.httpStatus)
  }
}

// FHIR root handler
app.get('/fhir/metadata', (req, res, next) => {
  fhirRoot.capabilities(res.locals.ctx, buildCoreCallbackHandler(req, res, next))
}, outcomeHandler)
app.post('/fhir', (req, res, next) => {
  fhirRoot.processRootBundle(res.locals.ctx, req.body, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir', (req, res, next) => {
  fhirRoot.searchAll(res.locals.ctx, buildCoreCallbackHandler(req, res, next))
})
app.options('/fhir', (req, res, next) => {
  fhirRoot.capabilities(res.locals.ctx, buildCoreCallbackHandler(req, res, next))
})

// FHIR Resource Interactions - handled by fhirCore which delegates to resource modules if needed
app.get('/fhir/:resourceType', (req, res, next) => {
  fhirCore.search(res.locals.ctx, req.params.resourceType, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/:resourceType/:id', (req, res, next) => {
  if (req.params.id === '_history') { return next() }
  fhirCore.read(res.locals.ctx, req.params.resourceType, req.params.id, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/:resourceType/_history', (req, res, next) => {
  fhirCore.history(res.locals.ctx, req.params.resourceType, null, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/:resourceType/:id/_history', (req, res, next) => {
  fhirCore.history(res.locals.ctx, req.params.resourceType, req.params.id, buildCoreCallbackHandler(req, res, next))
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

exports.app = app
exports.mongo = mongo
exports.start = start
exports.stop = stop
exports.workers = workers
