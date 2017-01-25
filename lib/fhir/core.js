'use strict'
const ObjectID = require('mongodb').ObjectID

const FhirCommon = require('./common')
const Authorization = require('../security/authorization')

/**
 * Handles common FHIR resource interactions
 */
module.exports = (mongo, modules) => {
  let fhirCommon = FhirCommon(mongo)
  let authorization = Authorization(mongo)

  return {
    /**
     * Request context
     * @typedef {Object} RequestContext
     * @param {Object} authenticatedUser The user making the request
     * @param {Function} authorizer The authorizer module matched for the user's role
     * @param {String} url The requested URL
     * @param {Object} [query] The URL query parameters
     * @param {Object} [headers] HTTP headers
     */
    /**
     * FHIR core interaction callback
     * @callback CoreCallback
     * @param {Object} err
     * @param {Outcome} outcome An appropriate result for the interaction
     */

    /**
     * Read a particular resource.
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {String} id The FHIR resource id
     * @param {CoreCallback} callback
     */
    read: (ctx, resourceType, id, callback) => {
      authorization.authorize('read', ctx, resourceType, (err, badRequest, postInteractionHandler) => {
        if (err) {
          return callback(err)
        }
        if (badRequest) {
          return callback(null, badRequest)
        }
        if (!ObjectID.isValid(id)) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }

        let fhirModule = modules[resourceType]

        let processRead = (err, badRequest) => {
          if (err) {
            return callback(err)
          }
          if (badRequest) {
            return callback(null, badRequest)
          }
          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
            }

            let c = db.collection(resourceType)
            c.findOne({ _id: ObjectID(id) }, { fields: { latest: 1 } }, (err, resource) => {
              if (err) {
                return callback(err)
              }

              if (!resource) {
                return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
              }

              let response = fhirCommon.formatResource(resource)
              postInteractionHandler(ctx, response, (err, badRequest, data) => {
                if (err) {
                  return callback(err)
                }
                if (badRequest) {
                  return callback(null, badRequest)
                }

                let done = (err, badRequest, data) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }
                  callback(null, { httpStatus: 200, resource: data })
                }

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.read) {
                  fhirModule.postInteractionHandlers.read(ctx, data, done)
                } else {
                  done(null, null, data)
                }
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.read) {
          fhirModule.preInteractionHandlers.read(ctx, null, processRead)
        } else {
          processRead()
        }
      })
    },

    /**
     * Read a particular version of a resource
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {String} id The FHIR resource id
     * @param {String} vid The version id
     * @param {CoreCallback} callback
     */
    vread: (ctx, resourceType, id, vid, callback) => {
      authorization.authorize('vread', ctx, resourceType, (err, badRequest, postInteractionHandler) => {
        if (err) {
          return callback(err)
        }
        if (badRequest) {
          return callback(null, badRequest)
        }
        if (!ObjectID.isValid(id)) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }

        let fhirModule = modules[resourceType]

        let processVRead = (err, badRequest) => {
          if (err) {
            return callback(err)
          }
          if (badRequest) {
            return callback(null, badRequest)
          }
          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
            }

            let c = db.collection(resourceType)

            let projection = {
              fields: {
                latest: 1
              }
            }
            projection.fields[`history.${vid}`] = 1

            c.findOne({ _id: ObjectID(id) }, projection, (err, resource) => {
              if (err) {
                return callback(err)
              }

              if (!resource) {
                return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
              }

              let response = null
              if (resource.latest.meta.versionId === vid) {
                response = fhirCommon.formatResource(resource)
              } else {
                if (!resource.history || !resource.history[vid]) {
                  return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
                }
                response = fhirCommon.formatResourceFromHistory(resource, vid)
              }

              postInteractionHandler(ctx, response, (err, badRequest, data) => {
                if (err) {
                  return callback(err)
                }
                if (badRequest) {
                  return callback(null, badRequest)
                }
                let done = (err, badRequest, data) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }
                  callback(null, { httpStatus: 200, resource: data })
                }

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.vread) {
                  fhirModule.postInteractionHandlers.vread(ctx, data, done)
                } else {
                  done(null, null, data)
                }
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.vread) {
          fhirModule.preInteractionHandlers.vread(ctx, null, processVRead)
        } else {
          processVRead()
        }
      })
    },

    /**
     * Search for a set of resources. The 'query' field must be specified in the RequestContext parameter.
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {CoreCallback} callback
     */
    search: (ctx, resourceType, callback) => {
      authorization.authorize('search', ctx, resourceType, (err, badRequest, postInteractionHandler, searchFilters, searchAllAllowed) => {
        if (err) {
          return callback(err)
        }
        if (badRequest) {
          return callback(null, badRequest)
        }

        let fhirModule = modules[resourceType]

        let processSearch = (err, badRequest) => {
          if (err) {
            return callback(err)
          }
          if (badRequest) {
            return callback(null, badRequest)
          }
          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
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
                  return callback(null, fhirCommon.buildHTTPOutcome(403, 'information', 'forbidden', msg))
                }
              } else {
                query = mongo.util.collapseWhenSingleClause(query)
              }

              mongo.util.debugLog(resourceType, 'search', query)

              fhirCommon.getPagingParams(ctx.query, (err, badRequest, _getpagesoffset, _count) => {
                if (err) {
                  return callback(err)
                }
                if (badRequest) {
                  return callback(null, badRequest)
                }

                let c = db.collection(resourceType)
                c.count(query, (err, total) => {
                  if (err) {
                    return callback(err)
                  }
                  c.find(query).project({ latest: 1 }).skip(_getpagesoffset).limit(_count).toArray((err, results) => {
                    if (err) {
                      return callback(err)
                    }

                    let response = fhirCommon.bundleResults('searchset', results, total, ctx.url)
                    if (_getpagesoffset + _count < total) {
                      fhirCommon.addBundleLinkNext(response, ctx.url, _getpagesoffset + _count, _count)
                    }
                    postInteractionHandler(ctx, response, (err, badRequest, data) => {
                      if (err) {
                        return callback(err)
                      }
                      if (badRequest) {
                        return callback(null, badRequest)
                      }
                      let done = (err, badRequest, data) => {
                        if (err) {
                          return callback(err)
                        }
                        if (badRequest) {
                          return callback(null, badRequest)
                        }
                        callback(null, { httpStatus: 200, resource: data })
                      }

                      if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.search) {
                        fhirModule.postInteractionHandlers.search(ctx, data, done)
                      } else {
                        done(null, null, data)
                      }
                    })
                  })
                })
              })
            }

            if (fhirModule && fhirModule.searchFilters) {
              fhirModule.searchFilters(ctx.query, (err, badRequest, moduleSearchFilters) => {
                if (err) {
                  return callback(err)
                }

                if (badRequest) {
                  return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
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
          fhirModule.preInteractionHandlers.search(ctx, null, processSearch)
        } else {
          processSearch()
        }
      })
    },

    /**
     * Create a new resource.
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {String} resource The resource body
     * @param {CoreCallback} callback
     */
    create: (ctx, resourceType, resource, callback) => {
      authorization.authorize('create', ctx, resourceType, (err, badRequest, postInteractionHandler) => {
        if (err) {
          return callback(err)
        }
        if (badRequest) {
          return callback(null, badRequest)
        }

        if (!resource.resourceType || resource.resourceType !== resourceType) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
        }

        let fhirModule = modules[resourceType]

        let processCreate = (err, badRequest) => {
          if (err) {
            return callback(err)
          }
          if (badRequest) {
            return callback(null, badRequest)
          }
          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
            }
            let newDoc = resource
            if (newDoc.id) {
              return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Specifying an id is not allowed on a create action'))
            }

            fhirCommon.setVersionId(newDoc, '1')

            let source = (ctx.query && ctx.query.source) ? ctx.query.source : 'hearth'

            let c = db.collection(resourceType)
            c.insertOne({ latest: newDoc, request: { method: 'POST' }, source: source }, (err, r) => {
              if (err) {
                return callback(err)
              }
              newDoc.id = r.insertedId.toHexString()
              postInteractionHandler(ctx, newDoc, (err, badRequest) => {
                if (err) {
                  return callback(err)
                }
                if (badRequest) {
                  return callback(null, badRequest)
                }
                let done = (err, badRequest) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }
                  const location = `/fhir/${resourceType}/${r.insertedId}/_history/${newDoc.meta.versionId}`
                  callback(null, { httpStatus: 201, location: location })
                }

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.create) {
                  fhirModule.postInteractionHandlers.create(ctx, newDoc, done)
                } else {
                  done()
                }
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.create) {
          fhirModule.preInteractionHandlers.create(ctx, resource, processCreate)
        } else {
          processCreate()
        }
      })
    },

    // TODO fhir specifies that a PUT should create the resource if not already present
    /**
     * Update a resource.
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {Number} id The id of the resource to update
     * @param {String} resource The resource body
     * @param {CoreCallback} callback
     */
    update: (ctx, resourceType, id, resource, callback) => {
      authorization.authorize('update', ctx, resourceType, (err, badRequest, postInteractionHandler) => {
        if (err) {
          return callback(err)
        }
        if (badRequest) {
          return callback(null, badRequest)
        }
        if (!ObjectID.isValid(id)) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }
        if (!resource.resourceType || resource.resourceType !== resourceType) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
        }
        if (resource.id !== id) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Resource id must match request parameter value'))
        }

        let fhirModule = modules[resourceType]

        let processUpdate = (err, badRequest) => {
          if (err) {
            return callback(err)
          }
          if (badRequest) {
            return callback(null, badRequest)
          }
          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
            }

            let c = db.collection(resourceType)
            c.findOne({ _id: ObjectID(id) }, { fields: { latest: 1, request: 1 } }, (err, existing) => {
              if (err) {
                return callback(err)
              }

              if (!existing) {
                return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
              }

              let newDoc = resource
              delete newDoc.id // doc _id is the id

              fhirCommon.setVersionId(newDoc, `${parseInt(existing.latest.meta.versionId) + 1}`)

              let update = {
                $set: {
                  latest: newDoc,
                  request: {
                    method: 'PUT'
                  }
                }
              }
              update['$set'][`history.${existing.latest.meta.versionId}`] = {
                resource: existing.latest,
                request: existing.request
              }

              c.updateOne({ _id: ObjectID(id) }, update, (err) => {
                if (err) {
                  return callback(err)
                }
                postInteractionHandler(ctx, update, (err, badRequest) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }

                  let done = (err, badRequest) => {
                    if (err) {
                      return callback(err)
                    }
                    if (badRequest) {
                      return callback(null, badRequest)
                    }
                    const location = `/fhir/${resourceType}/${id}/_history/${newDoc.meta.versionId}`
                    callback(null, { httpStatus: 200, location: location })
                  }

                  if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.update) {
                    fhirModule.postInteractionHandlers.update(ctx, newDoc, done)
                  } else {
                    done()
                  }
                })
              })
            })
          })
        }

        if (fhirModule && fhirModule.preInteractionHandlers && fhirModule.preInteractionHandlers.update) {
          fhirModule.preInteractionHandlers.update(ctx, resource, processUpdate)
        } else {
          processUpdate()
        }
      })
    }
  }
}
