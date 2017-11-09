 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const logger = require('winston')

const FhirCommon = require('./common')
const Authorization = require('../security/authorization')
const Hooks = require('./hooks')
const matchingConfig = require('../../config/matching')

const handleErrorAndBadRequest = (err, badRequest, callback) => {
  if (err) {
    logger.error(err)
    return callback(err)
  }
  if (badRequest) {
    return callback(null, badRequest)
  }
}

/**
 * Handles common FHIR resource interactions
 */
module.exports = (mongo, modules) => {
  const fhirCommon = FhirCommon(mongo)
  const authorization = Authorization(mongo)
  const hooks = Hooks()

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
      authorization.authorize('read', ctx, resourceType, (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        const fhirModule = modules[resourceType]
        hooks.executeBeforeHooks('read', fhirModule, ctx, resourceType, (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }
          if (!fhirCommon.util.validateID(id)) {
            return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
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
                const c = db.collection(`${resourceType}_history`)
                c.findOne({ id: id }, (err, resource) => {
                  if (err) {
                    return callback(err)
                  }

                  if (!resource) {
                    return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
                  }

                  callback(null, fhirCommon.buildHTTPOutcome(410, 'information', 'gone', 'Gone'))
                })
              } else {
                hooks.executeAfterHooks('read', fhirModule, ctx, resourceType, resource, (err, badRequest, data) => {
                  if (err || badRequest) {
                    return handleErrorAndBadRequest(err, badRequest, callback)
                  }

                  const response = fhirCommon.formatResource(data)
                  callback(null, { httpStatus: 200, resource: response })
                })
              }
            })
          })
        })
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
      authorization.authorize('vread', ctx, resourceType, (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        const fhirModule = modules[resourceType]
        hooks.executeBeforeHooks('vread', fhirModule, ctx, resourceType, (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }
          if (!fhirCommon.util.validateID(id) || !fhirCommon.util.validateID(vid)) {
            return callback(null, fhirCommon.buildHTTPOutcome(404, 'information', 'not-found', 'Not found'))
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
                hooks.executeAfterHooks('vread', fhirModule, ctx, resourceType, resource, (err, badRequest, data) => {
                  if (err || badRequest) {
                    return handleErrorAndBadRequest(err, badRequest, callback)
                  }

                  const response = fhirCommon.formatResource(data)
                  callback(null, { httpStatus: 200, resource: response })
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
        })
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
      authorization.authorize('search', ctx, resourceType, (err, badRequest, searchAllAllowed) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        const fhirModule = modules[resourceType]
        hooks.executeBeforeHooks('search', fhirModule, ctx, resourceType, (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }

          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
            }

            let query = {}
            let projection = {}

            const onDone = () => {
              if (!mongo.util.hasQueryOperators(query)) {
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
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, callback)
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

                    fhirCommon.mapSearchNameToPath(ctx.query._include, (err, data) => {
                      if (err) {
                        logger.info(err)
                      }

                      fhirCommon.includeResources(data, results)
                        .then((res) => {
                          if (res && Array.isArray(res)) {
                            res.forEach((item) => {
                              if (!fhirCommon.containsObject(item, results)) {
                                results.push(item)
                              }
                            })
                          }

                          const response = fhirCommon.bundleResults('searchset', results, total, ctx.url)
                          if (_getpagesoffset + _count < total) {
                            fhirCommon.addBundleLinkNext(response, ctx.url, _getpagesoffset + _count, _count)
                          }

                          hooks.executeAfterHooks('search', fhirModule, ctx, resourceType, response, (err, badRequest, results) => {
                            if (err || badRequest) {
                              return handleErrorAndBadRequest(err, badRequest, callback)
                            }

                            // format the updated entry array for the response
                            if (results && results.entry) {
                              results.entry.forEach((resource) => {
                                fhirCommon.formatResource(resource.resource)
                              })
                            }

                            if (ctx.operation === '$ihe-pix') {
                              return callback(null, { httpStatus: ctx.responseStatus, resource: results })
                            }

                            callback(null, { httpStatus: 200, resource: results })
                          })
                        })
                        .catch((err) => {
                          logger.error(err)
                          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid reference in _include parameter', err.message))
                        })
                    })
                  })
                })
              })
            }

            if (fhirModule && fhirModule.searchFilters) {
              fhirModule.searchFilters(ctx, (err, badRequest, moduleSearchFilters, moduleSearchProjections) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, callback)
                }

                if (moduleSearchFilters) {
                  query = moduleSearchFilters
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
        })
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

      authorization.authorize('create', ctx, resourceType, (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        const fhirModule = modules[resourceType]
        hooks.executeBeforeHooks('create', fhirModule, ctx, resourceType, resource, (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }

          if (!resource.resourceType || resource.resourceType !== resourceType) {
            return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
          }
          if (resource.id) {
            return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Specifying an id is not allowed on a create action'))
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
              hooks.executeAfterHooks('create', fhirModule, ctx, resourceType, resource, (err, badRequest) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, callback)
                }

                const location = `/fhir/${resourceType}/${resource.id}/_history/${resource.meta.versionId}`
                callback(null, { httpStatus: 201, location: location, id: resource.id })
              })
            })
          })
        })
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
      authorization.authorize('update', ctx, resourceType, (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        const fhirModule = modules[resourceType]
        hooks.executeBeforeHooks('update', fhirModule, ctx, resourceType, resource, (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }
          if (!resource.resourceType || resource.resourceType !== resourceType) {
            return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
          }
          if (resource.id !== id) {
            return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Resource id must match request parameter value'))
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
                hooks.executeAfterHooks('update', fhirModule, ctx, resourceType, resource, (err, badRequest) => {
                  if (err || badRequest) {
                    return handleErrorAndBadRequest(err, badRequest, callback)
                  }

                  const location = `/fhir/${resourceType}/${id}/_history/${resource.meta.versionId}`
                  callback(null, { httpStatus: 200, location: location, id: id })
                })
              })
            })
          })
        })
      })
    },

    /**
     * Soft delete a resource.
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {String} id The FHIR resource id
     * @param {CoreCallback} callback
     */
    delete: (ctx, resourceType, id, callback) => {
      authorization.authorize('delete', ctx, resourceType, (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        const fhirModule = modules[resourceType]
        hooks.executeBeforeHooks('delete', fhirModule, ctx, resourceType, (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }

          mongo.getDB((err, db) => {
            if (err) {
              return callback(err)
            }

            const c = db.collection(resourceType)
            c.findOneAndDelete({ id: id }, (err, result) => {
              if (err) {
                return callback(err)
              }

              if (!result.value) {
                return callback(null, { httpStatus: 204, id: id })
              }

              const historyDoc = result.value
              delete historyDoc._id

              const cHistory = db.collection(`${resourceType}_history`)
              cHistory.insert(historyDoc, (err) => {
                if (err) {
                  return callback(err)
                }
                hooks.executeAfterHooks('delete', fhirModule, ctx, resourceType, historyDoc, (err, badRequest) => {
                  if (err || badRequest) {
                    return handleErrorAndBadRequest(err, badRequest, callback)
                  }

                  callback(null, { httpStatus: 204, id: id })
                })
              })
            })
          })
        })
      })
    },

    /**
     * Performs a match on a resourceType.
     *
     * @param {RequestContext} ctx
     * @param {String} resourceType The type of FHIR resource
     * @param {String} parameters The parameters query resource
     * @param {CoreCallback} callback
     */
    match: (ctx, resourceType, parameters, callback) => {
      authorization.authorize('match', ctx, resourceType, (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, callback)
        }

        if (parameters.resourceType !== 'Parameters') {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Expected Parameters resource type'))
        }

        let resource, onlyCertainMatches
        let count = matchingConfig.matchSettings.defaultCount

        parameters.parameter.forEach((parameter) => {
          switch (parameter.name) {
            case 'resource':
              resource = parameter.resource
              break
            case 'count':
              count = parameter.valueInteger
              break
            case 'onlyCertainMatches':
              onlyCertainMatches = parameter.valueBoolean
              break
            default:
              return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', `Unexpected query parameter: ${parameter.name}`))
          }
        })

        if (!resource) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'No resource parameter in parameters resource'))
        }

        if (!resource.resourceType || resource.resourceType !== resourceType) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Invalid resource type'))
        }

        if (Object.keys(matchingConfig.resourceConfig).indexOf(resourceType) === -1) {
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Match operation not supported on resource type'))
        }

        const matchModule = modules['Matching']

        matchModule.match(resourceType, resource, count, (err, badRequest, results, certainMatchFlag) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, callback)
          }

          if (onlyCertainMatches && !certainMatchFlag) {
            return callback(null, fhirCommon.buildHTTPOutcome(404, 'info', 'not-found', 'No certain matches found'))
          }

          if (onlyCertainMatches && results.length > 1) {
            return callback(null, fhirCommon.buildHTTPOutcome(409, 'info', 'conflict', 'More than one certain match found'))
          }

          const response = fhirCommon.bundleResults('searchset', results, results.length, ctx.url)

          response.entry.forEach((resource) => {
            fhirCommon.formatResource(resource.resource)
          })

          callback(null, { httpStatus: 200, resource: response })
        })
      })
    }
  }
}
