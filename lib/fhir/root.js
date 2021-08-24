 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const async = require('async')
const url = require('url')
const logger = require('../logger')

const FhirCommon = require('./common')
const FhirCore = require('./core')
const Transaction = require('./transaction')
const capabilities = require('../../config/capability-statement.json')

/**
 * Handles FHIR interactions on the root path
 */
module.exports = (mongo, modules, callback) => {
  const fhirCommon = FhirCommon(mongo)
  const fhirCore = FhirCore(mongo, modules)
  const transaction = Transaction(mongo)

  const buildOutcomeHandler = (entry, method, resourceType, revert, isTransaction, callback) => {
    return (err, outcome) => {
      if (err) {
        callback(err)
      }
      if (method !== 'GET' && isTransaction && outcome.httpStatus >= 400 && outcome.httpStatus < 500) {
        const err = new Error(`Bad request processing ${entry.request.url}`)
        err.resource = outcome.resource
        if (err.resource && err.resource.issue) {
          err.resource.issue.push({ severity: 'error', code: 'invalid', details: { text: `Bad request processing ${entry.request.url}` } })
        }
        err.httpStatus = outcome.httpStatus

        return callback(err)
      }
      if (isTransaction && outcome.httpStatus >= 500) {
        const err = new Error(`Server error processing ${entry.request.url}`)
        err.resource = outcome.resource
        if (err.resource && err.resource.issue) {
          err.resource.issue.push({ severity: 'error', code: 'invalid', details: { text: `Server error processing ${entry.request.url}` } })
        }
        err.httpStatus = outcome.httpStatus
        return callback(err)
      }

      const pushReverts = (revertType, successStatusArray) => {
        if (successStatusArray.indexOf(outcome.httpStatus) > -1) {
          revert[revertType].push({
            resourceType: resourceType,
            id: outcome.id
          })
        }
      }

      // add revert metadata on success
      switch (method) {
        case 'POST':
          pushReverts('creates', [201])
          break
        case 'PUT':
          pushReverts('updates', [200, 201])
          break
        case 'DELETE':
          pushReverts('deletes', [204])
          break
      }

      const resEntry = { response: {} }
      resEntry.response.status = `${outcome.httpStatus}`
      resEntry.response.location = outcome.location
      resEntry.resource = outcome.resource
      resEntry._originalIndex = entry._originalIndex
      callback(null, resEntry)
    }
  }

  const resolveReferences = (bundle) => {
    bundle.entry.forEach((sourceEntry) => {
      let id
      if (sourceEntry.request.method === 'POST') {
        id = fhirCommon.util.generateID()
        sourceEntry.id = id
      } else if (sourceEntry.request.method === 'PUT') {
        id = sourceEntry.resource.id
      } else {
        return
      }

      bundle.entry.forEach((targetEntry) => {
        if (sourceEntry.resource && sourceEntry.resource.resourceType) {
          fhirCommon.util.resolveReferences(targetEntry, sourceEntry.fullUrl, `${sourceEntry.resource.resourceType}/${id}`)
        }
      })
    })
  }

  const processEntry = (baseCtx, entry, revert, isTransaction, callback) => {
    const parsedUrl = url.parse(entry.request.url, true)

    const entryCtx = {
      authenticatedUser: baseCtx.authenticatedUser,
      authorizer: baseCtx.authorizer,
      headers: baseCtx.headers,
      url: entry.request.url,
      query: parsedUrl.query
    }

    const pathParts = parsedUrl.pathname.split('/')
    const resourceType = pathParts[0]
    const id = pathParts[1]
    const vid = pathParts[3]

    // execute correct entry operation
    switch (entry.request.method) {
      case 'DELETE':
        fhirCore.delete(entryCtx, resourceType, id, buildOutcomeHandler(entry, 'DELETE', resourceType, revert, isTransaction, callback))
        break
      case 'POST':
        fhirCore.create(entryCtx, resourceType, entry.resource, entry.id, buildOutcomeHandler(entry, 'POST', resourceType, revert, isTransaction, callback))
        break
      case 'PUT':
        fhirCore.update(entryCtx, resourceType, id, entry.resource, buildOutcomeHandler(entry, 'PUT', resourceType, revert, isTransaction, callback))
        break
      case 'GET':
        if (id) {
          if (vid) {
            fhirCore.vread(entryCtx, resourceType, id, vid, buildOutcomeHandler(entry, 'GET', resourceType, revert, isTransaction, callback))
          } else {
            fhirCore.read(entryCtx, resourceType, id, buildOutcomeHandler(entry, 'GET', resourceType, revert, isTransaction, callback))
          }
        } else {
          fhirCore.search(entryCtx, resourceType, buildOutcomeHandler(entry, 'GET', resourceType, revert, isTransaction, callback))
        }
        break
      default:
        return callback(new Error('Unknown request.method on bundle entry'))
    }
  }

  const revertTransaction = (revert) => {
    const promises = []

    const revertOperations = (operationString, revertFunctionString) => {
      revert[operationString].forEach((operation) => {
        promises.push(new Promise((resolve, reject) => {
          transaction[revertFunctionString](operation.resourceType, operation.id, (err, success) => {
            if (err) { return reject(err) }
            if (!success) { logger.warn(`Transaction revert failed: couldn't revert ${operationString} of ${operation.resourceType}/${operation.id}`) }
            resolve()
          })
        }))
      })
    }

    // Revert all operations in transaction that need reverting
    Object.keys(revert).forEach((operation) => {
      revertOperations(operation, `revert${operation[0].toUpperCase()}${operation.slice(1, operation.length - 1)}`)
    })

    return promises
  }

  const processBundle = (ctx, bundle, isTransaction, callback) => {
    // make sure the bundle is sorted in the order that it should be executed
    bundle = transaction.sortTransactionBundle(bundle)

    // resolve references up front
    resolveReferences(bundle)

    // store operations that potentially need to be reverted
    const revert = {
      creates: [],
      updates: [],
      deletes: []
    }

    // create functions to process each entry
    const entryFunctions = []
    bundle.entry.forEach((entry) => {
      entryFunctions.push((callback) => {
        processEntry(ctx, entry, revert, isTransaction, callback)
      })
    })

    // process entry functions in order
    async.series(entryFunctions, (err, resEntries) => {
      if (err) {
        let promises = []
        if (isTransaction) {
          // revert the transaction
          logger.warn(`Reverting transaction ${bundle.id || ''} as there were errors: ${err}`)
          promises = revertTransaction(revert)
        }

        return Promise.all(promises).then(() => {
          if (err.httpStatus) {
            return callback(null, { httpStatus: err.httpStatus, resource: err.resource })
          } else {
            return callback(err)
          }
        }, () => {
          return callback(err)
        })
      }

      const responseBundle = {
        resourceType: 'Bundle',
        entry: resEntries
      }
      if (isTransaction) {
        responseBundle.type = 'transaction-response'
      } else {
        responseBundle.type = 'batch-response'
      }

      // sort back to original index to match request
      responseBundle.entry.sort((a, b) => {
        return a._originalIndex - b._originalIndex
      })

      // remove processing metadata from entries
      responseBundle.entry.forEach((entry) => {
        delete entry._originalIndex
      })

      return callback(null, { httpStatus: 200, resource: responseBundle })
    })
  }

  const addDefaultRequestFieldToEntries = (bundle) => {
    bundle.entry.forEach((entry) => {
      if (!entry.request) {
        entry.request = {}
        entry.request.method = entry.resource.id ? 'PUT' : 'POST'
        entry.request.url = entry.resource.id ? `${entry.resource.resourceType}/${entry.resource.id}` : entry.resource.resourceType
      }
    })
  }

  return {
    /**
     * Handles processing of transaction, batch and document bundles on the root URL
     *
     * @param {RequestContext} ctx
     * @param {Object} bundle The FHIR bundle to process
     * @param {CoreCallback} callback
     */
    processRootBundle: (ctx, bundle, callback) => {
      logger.info(`Processing transaction ${bundle.id} with ${bundle.entry.length} entries`)
      switch (bundle.type) {
        case 'transaction':
          processBundle(ctx, bundle, true, callback)
          break
        case 'batch':
          processBundle(ctx, bundle, false, callback)
          break
        case 'document':
          addDefaultRequestFieldToEntries(bundle)
          processBundle(ctx, bundle, true, callback)
          break
        default:
          return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Bundle.type must either be transaction, batch or document'))
      }
    },
    searchAll: (ctx) => {
      throw new Error('Not yet supported')
    },
    capabilities: (ctx, callback) => {
      logger.debug(`Fetching capabilities statement`)
      callback(null, { httpStatus: 200, resource: capabilities })
    }
  }
}
