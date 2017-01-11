'use strict'
const logger = require('winston')
const ObjectID = require('mongodb').ObjectID

const FhirCommon = require('./common')
const Authorization = require('../security/authorization')

module.exports = (mongo, modules) => {
  let fhirCommon = FhirCommon(mongo)
  let authorization = Authorization(mongo)

  let getModule = (resourceType) => {
    for (let m of modules) {
      if (m.name === resourceType) {
        return m
      }
    }
    return null
  }

  return {
    read: (req, res) => {
      authorization.authorize('read', req, res, (resourceType, postInteractionHandler) => {
        if (!ObjectID.isValid(req.params.id)) {
          return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
        }

        let fhirModule = getModule(resourceType)

        let processRead = () => {
          mongo.getDB((err, db) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            let c = db.collection(resourceType)
            c.findOne({ _id: ObjectID(req.params.id) }, { fields: { latest: 1 } }, (err, resource) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }

              if (!resource) {
                return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
              }

              let response = fhirCommon.formatResource(resource)
              postInteractionHandler(req, res, response, (data) => {
                let done = (data) => res.send(data)

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.read) {
                  fhirModule.postInteractionHandlers.read(req, res, data, done)
                } else {
                  done(data)
                }
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.read) {
          fhirModule.preInteractionHandlers.read(req, res, processRead)
        } else {
          processRead()
        }
      })
    },

    vread: (req, res) => {
      authorization.authorize('vread', req, res, (resourceType, postInteractionHandler) => {
        if (!ObjectID.isValid(req.params.id)) {
          return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
        }

        let fhirModule = getModule(resourceType)

        let processVRead = () => {
          mongo.getDB((err, db) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            let c = db.collection(resourceType)

            let projection = {
              fields: {
                latest: 1
              }
            }
            projection.fields[`history.${req.params.vid}`] = 1

            c.findOne({ _id: ObjectID(req.params.id) }, projection, (err, resource) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }

              if (!resource) {
                return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
              }

              let response = null
              if (resource.latest.meta.versionId === req.params.vid) {
                response = fhirCommon.formatResource(resource)
              } else {
                if (!resource.history || !resource.history[req.params.vid]) {
                  return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
                }
                response = fhirCommon.formatResourceFromHistory(resource, req.params.vid)
              }

              postInteractionHandler(req, res, response, (data) => {
                let done = (data) => res.send(data)

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.vread) {
                  fhirModule.postInteractionHandlers.vread(req, res, data, done)
                } else {
                  done(data)
                }
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.vread) {
          fhirModule.preInteractionHandlers.vread(req, res, processVRead)
        } else {
          processVRead()
        }
      })
    },

    search: (req, res) => {
      authorization.authorize('search', req, res, (resourceType, postInteractionHandler, searchFilters, searchAllAllowed) => {
        let fhirModule = getModule(resourceType)

        let processSearch = () => {
          mongo.getDB((err, db) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            let query = { $and: [] }
            if (searchFilters) {
              query['$and'].push(searchFilters)
            }

            let onDone = () => {
              if (query['$and'].length === 0) {
                // search all
                if (searchAllAllowed) {
                  query = {}
                } else {
                  let msg = `Not allowed to search for all on /${resourceType}. Try adding some parameters to your search.`
                  return res.status(403).send(fhirCommon.buildOperationOutcome('information', 'forbidden', msg))
                }
              } else {
                query = mongo.util.collapseAndQuery(query)
              }

              mongo.util.debugLog(resourceType, 'search', query)

              fhirCommon.getPagingParams(req, res, (_getpagesoffset, _count) => {
                let c = db.collection(resourceType)
                c.count(query, (err, total) => {
                  if (err) {
                    logger.error(err)
                    return res.status(500).send(fhirCommon.internalServerErrorOutcome())
                  }
                  c.find(query).project({ latest: 1 }).skip(_getpagesoffset).limit(_count).toArray((err, results) => {
                    if (err) {
                      logger.error(err)
                      return res.status(500).send(fhirCommon.internalServerErrorOutcome())
                    }

                    let response = fhirCommon.bundleResults('searchset', results, total, req.originalUrl)
                    if (_getpagesoffset + _count < total) {
                      fhirCommon.addBundleLinkNext(response, req.originalUrl, _getpagesoffset + _count, _count)
                    }
                    postInteractionHandler(req, res, response, (data) => {
                      let done = (data) => res.send(data)

                      if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.search) {
                        fhirModule.postInteractionHandlers.search(req, res, data, done)
                      } else {
                        done(data)
                      }
                    })
                  })
                })
              })
            }

            if (fhirModule && fhirModule.searchFilters) {
              fhirModule.searchFilters(req.query, (err, badRequest, moduleSearchFilters) => {
                if (err) {
                  logger.error(err)
                  return res.status(500).send(fhirCommon.internalServerErrorOutcome())
                }

                if (badRequest) {
                  return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', badRequest))
                }

                if (moduleSearchFilters) {
                  query['$and'].push(moduleSearchFilters)
                }

                onDone()
              })
            } else {
              onDone()
            }
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.search) {
          fhirModule.preInteractionHandlers.search(req, res, processSearch)
        } else {
          processSearch()
        }
      })
    },

    create: (req, res) => {
      authorization.authorize('create', req, res, (resourceType, postInteractionHandler) => {
        if (!req.body.resourceType || req.body.resourceType !== resourceType) {
          return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Invalid resource type'))
        }

        let fhirModule = getModule(resourceType)

        let processCreate = () => {
          mongo.getDB((err, db) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }
            let newDoc = req.body
            if (newDoc.id) {
              return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Specifying an id is not allowed on a create action'))
            }

            fhirCommon.setVersionId(newDoc, '1')

            let source = req.query.source ? req.query.source : 'hearth'

            let c = db.collection(resourceType)
            c.insertOne({ latest: newDoc, request: { method: 'POST' }, source: source }, (err, r) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }
              newDoc.id = r.insertedId.toHexString()
              postInteractionHandler(req, res, newDoc, () => {
                let done = () => res
                  .set('Location', `/fhir/${resourceType}/${r.insertedId}/_history/${newDoc.meta.versionId}`)
                  .sendStatus(201)

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.create) {
                  fhirModule.postInteractionHandlers.create(req, res, newDoc, done)
                } else {
                  done()
                }
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.create) {
          fhirModule.preInteractionHandlers.create(req, res, processCreate)
        } else {
          processCreate()
        }
      })
    },

    // TODO fhir specifies that a PUT should create the resource if not already present
    update: (req, res) => {
      authorization.authorize('update', req, res, (resourceType, postInteractionHandler) => {
        if (!ObjectID.isValid(req.params.id)) {
          return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
        }
        if (!req.body.resourceType || req.body.resourceType !== resourceType) {
          return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Invalid resource type'))
        }
        if (req.body.id !== req.params.id) {
          return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Resource id must match request parameter value'))
        }

        let fhirModule = getModule(resourceType)

        let processUpdate = () => {
          mongo.getDB((err, db) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            let c = db.collection(resourceType)
            c.findOne({ _id: ObjectID(req.params.id) }, { fields: { latest: 1, request: 1 } }, (err, resource) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }

              if (!resource) {
                return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
              }

              let newDoc = req.body
              delete newDoc.id // doc _id is the id

              fhirCommon.setVersionId(newDoc, `${parseInt(resource.latest.meta.versionId) + 1}`)

              let update = {
                $set: {
                  latest: newDoc,
                  request: {
                    method: 'PUT'
                  }
                }
              }
              update['$set'][`history.${resource.latest.meta.versionId}`] = {
                resource: resource.latest,
                request: resource.request
              }

              c.updateOne({ _id: ObjectID(req.params.id) }, update, (err) => {
                if (err) {
                  logger.error(err)
                  return res.status(500).send(fhirCommon.internalServerErrorOutcome())
                }
                postInteractionHandler(req, res, update, () => {
                  let done = () => res
                    .set('Location', `/fhir/${resourceType}/${req.params.id}/_history/${newDoc.meta.versionId}`)
                    .sendStatus(200)

                  if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.update) {
                    fhirModule.postInteractionHandlers.update(req, res, newDoc, done)
                  } else {
                    done()
                  }
                })
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.update) {
          fhirModule.preInteractionHandlers.update(req, res, processUpdate)
        } else {
          processUpdate()
        }
      })
    }
  }
}
