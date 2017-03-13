'use strict'
const FhirCommon = require('./common')
const Authorization = require('../security/authorization')

/**
 * Handles common FHIR resource interactions
 */
module.exports = (mongo, modules) => {
  const fhirCommon = FhirCommon(mongo)
  const authorization = Authorization(mongo)

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
        if (!fhirCommon.util.validateID(id)) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }

        const fhirModule = modules[resourceType]

        const processRead = (err, badRequest) => {
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

            const c = db.collection(resourceType)
            c.findOne({ id: id }, (err, resource) => {
              if (err) {
                return callback(err)
              }

              if (!resource) {
                return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
              }

              postInteractionHandler(ctx, resource, (err, badRequest, data) => {
                if (err) {
                  return callback(err)
                }
                if (badRequest) {
                  return callback(null, badRequest)
                }

                const done = (err, badRequest, data) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }
                  const response = fhirCommon.formatResource(data)
                  callback(null, { httpStatus: 200, resource: response })
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
        if (!fhirCommon.util.validateID(id) || !fhirCommon.util.validateID(vid)) {
          return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
        }

        const fhirModule = modules[resourceType]

        const processVRead = (err, badRequest) => {
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

            const c = db.collection(resourceType)

            c.findOne({ id: id, 'meta.versionId': vid }, (err, resource) => {
              if (err) {
                return callback(err)
              }

              const postFind = (resource) => {
                postInteractionHandler(ctx, resource, (err, badRequest, data) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }
                  const done = (err, badRequest, data) => {
                    if (err) {
                      return callback(err)
                    }
                    if (badRequest) {
                      return callback(null, badRequest)
                    }

                    const response = fhirCommon.formatResource(data)
                    callback(null, { httpStatus: 200, resource: response })
                  }

                  if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.vread) {
                    fhirModule.postInteractionHandlers.vread(ctx, data, done)
                  } else {
                    done(null, null, data)
                  }
                })
              }

              if (!resource) {
                const cHistory = db.collection(`${resourceType}_history`)
                cHistory.findOne({ id: id, 'meta.versionId': vid }, (err, resource) => {
                  if (err) {
                    return callback(err)
                  }
                  if (!resource) {
                    return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
                  }
                  postFind(resource)
                })
              } else {
                postFind(resource)
              }
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

        const fhirModule = modules[resourceType]

        const processSearch = (err, badRequest) => {
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
            let projection = {}
            if (searchFilters) {
              query['$and'].push(searchFilters)
            }

            const onDone = () => {
              if (query['$and'].length === 0) {
                // search all
                if (searchAllAllowed) {
                  query = {}
                } else {
                  const msg = `Not allowed to search for all on /${resourceType}. Try adding some parameters to your search.`
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

                const c = db.collection(resourceType)
                c.count(query, projection, (err, total) => {
                  if (err) {
                    return callback(err)
                  }
                  c.find(query, projection).skip(_getpagesoffset).limit(_count).toArray((err, results) => {
                    if (err) {
                      return callback(err)
                    }

                    postInteractionHandler(ctx, results, (err, badRequest, data) => {
                      if (err) {
                        return callback(err)
                      }
                      if (badRequest) {
                        return callback(null, badRequest)
                      }

                      const done = (err, badRequest, data) => {
                        if (err) {
                          return callback(err)
                        }
                        if (badRequest) {
                          return callback(null, badRequest)
                        }

                        if (ctx.operation === '$ihe-pix') {
                          return callback(null, { httpStatus: 200, resource: data })
                        }

                        const response = fhirCommon.bundleResults('searchset', results, total, ctx.url)
                        if (_getpagesoffset + _count < total) {
                          fhirCommon.addBundleLinkNext(response, ctx.url, _getpagesoffset + _count, _count)
                        }

                        callback(null, { httpStatus: 200, resource: response })
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
              fhirModule.searchFilters(ctx, (err, badRequest, moduleSearchFilters, moduleSearchProjections) => {
                if (err) {
                  return callback(err)
                }

                if (badRequest) {
                  return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', badRequest))
                }

                if (moduleSearchFilters) {
                  query['$and'].push(moduleSearchFilters)
                }

                if (moduleSearchProjections) {
                  projection = moduleSearchProjections
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
     * @param {String} [id] The optional id to use during the create
     * @param {CoreCallback} callback
     */
    create: (ctx, resourceType, resource, id, callback) => {
      if (typeof id === 'function') {
        callback = id
        id = undefined
      }

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
        if (resource.id) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Specifying an id is not allowed on a create action'))
        }

        const fhirModule = modules[resourceType]

        const processCreate = (err, badRequest) => {
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

            fhirCommon.touchResource(resource)

            if (id) {
              resource.id = id
            } else {
              resource.id = fhirCommon.util.generateID()
            }
            resource.meta.versionId = fhirCommon.util.generateID()

            // metadata required for history
            resource._request.method = 'POST'

            const c = db.collection(resourceType)
            c.insertOne(resource, (err, r) => {
              if (err) {
                return callback(err)
              }
              postInteractionHandler(ctx, resource, (err, badRequest) => {
                if (err) {
                  return callback(err)
                }
                if (badRequest) {
                  return callback(null, badRequest)
                }
                const done = (err, badRequest) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }
                  const location = `/fhir/${resourceType}/${resource.id}/_history/${resource.meta.versionId}`
                  callback(null, { httpStatus: 201, location: location, id: resource.id })
                }

                if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.create) {
                  fhirModule.postInteractionHandlers.create(ctx, resource, done)
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
        if (!resource.resourceType || resource.resourceType !== resourceType) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
        }
        if (resource.id !== id) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Resource id must match request parameter value'))
        }

        const fhirModule = modules[resourceType]

        const processUpdate = (err, badRequest) => {
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

            fhirCommon.touchResource(resource)

            // metadata required for history
            resource._request.method = 'PUT'

            resource.meta.versionId = fhirCommon.util.generateID()

            const options = {
              upsert: false, // TODO OHIE-168
              returnOriginal: true
            }

            const c = db.collection(resourceType)
            c.findOneAndReplace({ id: id }, resource, options, (err, result) => {
              if (err) {
                return callback(err)
              }

              if (!result.value) {
                return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
              }

              delete result.value._id

              const cHistory = db.collection(`${resourceType}_history`)
              cHistory.insert(result.value, (err) => {
                if (err) {
                  return callback(err)
                }
                postInteractionHandler(ctx, resource, (err, badRequest) => {
                  if (err) {
                    return callback(err)
                  }
                  if (badRequest) {
                    return callback(null, badRequest)
                  }

                  const done = (err, badRequest) => {
                    if (err) {
                      return callback(err)
                    }
                    if (badRequest) {
                      return callback(null, badRequest)
                    }
                    const location = `/fhir/${resourceType}/${id}/_history/${resource.meta.versionId}`
                    callback(null, { httpStatus: 200, location: location, id: id })
                  }

                  if (fhirModule && fhirModule.postInteractionHandlers && fhirModule.postInteractionHandlers.update) {
                    fhirModule.postInteractionHandlers.update(ctx, resource, done)
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
