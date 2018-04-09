 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
require('./init')

const logger = require('winston')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const moment = require('moment')
const xmlbuilder = require('xmlbuilder')
const libxmljs = require("libxmljs")
const fs = require('fs')
const path = require('path')
const URL = require('url')
const Fhir = require('fhir')

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

process.title = 'Hearth'

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

// Load plugins
fs.readdirSync(path.resolve(`${global.appRoot}/lib/plugins`)).filter(function(file) { return path.extname(file) === '.js' } ).forEach((file) => {
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

//Instantiate CSD core with available resource modules
const csdCore = require('./csd/core')(mongo, fhirResources)

// Setup express
let app = express()

app.use(bodyParser.json({limit: '10Mb', type: ['application/fhir+json', 'application/json+fhir', 'application/json']}))
app.use(bodyParser.text({limit: '10Mb', type: ['application/fhir+xml', 'application/xml+fhir', 'application/xml']}))
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

app.get('/api/supplyUpdates', (req, res, next) => {
  fhirRoot.pullUpdates( res.locals.ctx, buildCoreCallbackHandler( req, res, next) )
})

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

// FHIR Resource Interactions - handled by fhirCore which delegates to resource modules if needed
app.get('/fhir/:resourceType', (req, res, next) => {
  fhirCore.search(res.locals.ctx, req.params.resourceType, buildCoreCallbackHandler(req, res, next))
})
app.get('/fhir/:resourceType/:id', (req, res, next) => {
  if ( req.params.id == '_history' ) {
    fhirCore.history(res.locals.ctx, req.params.resourceType, buildCoreCallbackHandler(req, res, next))
  } else {
    fhirCore.read(res.locals.ctx, req.params.resourceType, req.params.id, buildCoreCallbackHandler(req, res, next))
  }
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
app.post('/csd', (req, res, next) => {
  var xmlDoc = libxmljs.parseXml(req.body);
  var lastModified = xmlDoc.get("//csd:getModificationsRequest/csd:lastModified", {
                                soap: "http://www.w3.org/2001/12/soap-encoding",
                                csd: "urn:ihe:iti:csd:2013"
                              })

  if(typeof lastModified != 'undefined')
  res.locals.ctx.query._since = lastModified.text()

  const promises = []
  const csd = xmlbuilder.begin().ele("CSD").att("xmlns","urn:ihe:iti:csd:2013").att("xmlns:csd","urn:ihe:iti:csd:2013")

  promises.push(new Promise((resolve, reject) => {
    fhirCore.history(res.locals.ctx, 'Practitioner', (err,outcome)=>{
      csdCore.translatePractitionerToCSD(outcome,res.locals.ctx,(providerDirectory)=>{
        csd.importDocument(providerDirectory)
        resolve()
      })
    })
  }))

  promises.push(new Promise((resolve, reject) => {
    fhirCore.history(res.locals.ctx, 'Location', (err,outcome)=>{
      csdCore.translateLocationToCSD(outcome,res.locals.ctx,(facilityDirectory,organizationDirectory)=>{
        csd.importDocument(facilityDirectory)
        csd.importDocument(organizationDirectory)
        resolve()
      })
    })
  }))

  promises.push(new Promise((resolve, reject) => {
    fhirCore.history(res.locals.ctx, 'HealthcareService', (err,outcome)=>{
      csdCore.translateServiceToCSD(outcome,res.locals.ctx,(serviceDirectory)=>{
        csd.importDocument(serviceDirectory)
        resolve()
      })
    })
  }))

  Promise.all(promises).then(()=>{
    res.send(csd.end({ pretty: true}))
  }).catch((reason)=>{
      logger.error(reason)
    })
})
app.get('/csd/:resourceType', (req, res, next) => {
  const promises = []
  const csd = xmlbuilder.begin().ele("CSD").att("xmlns","urn:ihe:iti:csd:2013").att("xmlns:csd","urn:ihe:iti:csd:2013")

  if(req.params.resourceType == "Practitioner"){
    const organizationDirectory = xmlbuilder.begin().ele("csd:organizationDirectory")
    const facilityDirectory = xmlbuilder.begin().ele("csd:facilityDirectory")
    const serviceDirectory = xmlbuilder.begin().ele("csd:serviceDirectory")
    csd.importDocument(organizationDirectory)
    csd.importDocument(facilityDirectory)
    csd.importDocument(serviceDirectory)
    promises.push(new Promise((resolve, reject) => {
      fhirCore.history(res.locals.ctx, 'Practitioner', (err,outcome)=>{
        csdCore.translatePractitionerToCSD(outcome,res.locals.ctx,(providerDirectory)=>{
          csd.importDocument(providerDirectory)
          resolve()
        })
      })
    }))
  }
  else if(req.params.resourceType == "Location"){
    const serviceDirectory = xmlbuilder.begin().ele("csd:serviceDirectory")
    const providerDirectory = xmlbuilder.begin().ele("csd:providerDirectory")
    csd.importDocument(serviceDirectory)
    csd.importDocument(providerDirectory)
    promises.push(new Promise((resolve, reject) => {
      fhirCore.history(res.locals.ctx, 'Location', (err,outcome)=>{
        csdCore.translateLocationToCSD(outcome,res.locals.ctx,(facilityDirectory,organizationDirectory)=>{
          csd.importDocument(facilityDirectory)
          csd.importDocument(organizationDirectory)
          resolve()
        })
      })
    }))
  }
  else if(req.params.resourceType == "HealthcareService"){
    const providerDirectory = xmlbuilder.begin().ele("csd:providerDirectory")
    const organizationDirectory = xmlbuilder.begin().ele("csd:organizationDirectory")
    const facilityDirectory = xmlbuilder.begin().ele("csd:facilityDirectory")
    csd.importDocument(providerDirectory)
    csd.importDocument(organizationDirectory)
    csd.importDocument(facilityDirectory)
    promises.push(new Promise((resolve, reject) => {
      fhirCore.history(res.locals.ctx, 'HealthcareService', (err,outcome)=>{
        csdCore.translateServiceToCSD(outcome,res.locals.ctx,(serviceDirectory)=>{
          csd.importDocument(serviceDirectory)
          resolve()
        })
      })
    }))
  }
  else {
    const serviceDirectory = xmlbuilder.begin().ele("csd:serviceDirectory")
    const providerDirectory = xmlbuilder.begin().ele("csd:providerDirectory")
    const organizationDirectory = xmlbuilder.begin().ele("csd:organizationDirectory")
    const facilityDirectory = xmlbuilder.begin().ele("csd:facilityDirectory")
    csd.importDocument(providerDirectory)
    csd.importDocument(organizationDirectory)
    csd.importDocument(facilityDirectory)
    csd.importDocument(serviceDirectory)
  }

  Promise.all(promises).then(()=>{
    res.send(csd.end({ pretty: true}))
  })
})
app.put('/fhir/:resourceType/:id', (req, res, next) => {
  fhirCore.update(res.locals.ctx, req.params.resourceType, req.params.id, req.body, buildCoreCallbackHandler(req, res, next))
})
app.delete('/fhir/:resourceType/:id', (req, res, next) => {
  fhirCore.delete(res.locals.ctx, req.params.resourceType, req.params.id, buildCoreCallbackHandler(req, res, next))
})

const returnContentTypeHandler = (req, res, next) => {
  if (res.locals.outcome && res.locals.outcome.resource) {
    const accepts = req.accepts(['application/fhir+json', 'application/json+fhir', 'application/json', 'json', 
            'application/fhir+xml', 'application/xml+fhir', 'application/xml', 'xml'])
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
    var output = res.locals.outcome.resource;
    if ( ( !req.accepts('json') && !req.accepts('application/fhir+json') && !req.accepts('application/json+fhir') && 
                ( req.accepts('xml') || req.accepts('application/fhir+xml') || req.accepts('application/xml+fhir') ) ) || 
            ( req.query._format && 
              ( req.query._format == "application/fhir+xml" 
                || req.query._format == "application/xml+fhir" 
                || req.query._format == "application/xml" 
                || req.query._format == 'xml' ) ) ) {
      var fhir = new Fhir(Fhir.STU3);
      output = fhir.ObjectToXml( output );
    } 
    res.status(res.locals.outcome.httpStatus).send(output)
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

exports.app = app
exports.mongo = mongo
exports.start = start
exports.stop = stop
exports.workers = workers
