'use strict'

const async = require('async')
const url = require('url')
const logger = require('winston')
const Uuid = require('uuid/v1')

const FhirCommon = require('./common')
const FhirCore = require('./core')
const Transaction = require('./transaction')

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
        const err = new Error(`Bad request processsing ${entry.request.url}`)
        err.resource = outcome.resource
        if (err.resource && err.resource.issue) {
          err.resource.issue.push({ severity: 'error', code: 'invalid', details: { text: `Bad request processsing ${entry.request.url}` } })
        }
        err.httpStatus = outcome.httpStatus

        return callback(err)
      }
      if (isTransaction && outcome.httpStatus >= 500) {
        const err = new Error(`Server error processsing ${entry.request.url}`)
        err.resource = outcome.resource
        if (err.resource && err.resource.issue) {
          err.resource.issue.push({ severity: 'error', code: 'invalid', details: { text: `Server error processsing ${entry.request.url}` } })
        }
        err.httpStatus = outcome.httpStatus
        return callback(err)
      }

      // add revert metadata on success
      if (method === 'POST') {
        if (outcome.httpStatus === 201) {
          revert.creates.push({
            resourceType: resourceType,
            id: outcome.id
          })
        }
      }
      if (method === 'PUT') {
        if (outcome.httpStatus === 200 || outcome.httpStatus === 201) {
          revert.updates.push({
            resourceType: resourceType,
            id: outcome.id
          })
        }
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
      if (sourceEntry.request.method === 'POST') {
        const id = Uuid()
        sourceEntry.id = id
        bundle.entry.forEach((targetEntry) => {
          if (sourceEntry.resource && sourceEntry.resource.resourceType) {
            fhirCommon.util.resolveReferences(targetEntry, sourceEntry.fullUrl, `${sourceEntry.resource.resourceType}/${id}`)
          }
        })
      }
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
        // fhirCore.delete(entryCtx, resourceType, id, buildOutcomeHandler('DELETE', resourceType)) // TODO doesn't exist
        logger.error('Transaction deletes aren\'t supported.')
        buildOutcomeHandler('DELETE', resourceType)(null, fhirCommon.buildHTTPOutcome(405, 'error', 'not-supported', 'Transaction deletes aren\'t supported'))
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
    revert.creates.forEach((create) => {
      promises.push(new Promise((resolve, reject) => {
        transaction.revertCreate(create.resourceType, create.id, (err, success) => {
          if (err) { return reject(err) }
          if (!success) { logger.warn(`Transaction revert failed: couldn\'t revert creation of ${create.resourceType}/${create.id}`) }
          resolve()
        })
      }))
    })

    revert.updates.forEach((update) => {
      promises.push(new Promise((resolve, reject) => {
        transaction.revertUpdate(update.resourceType, update.id, (err, success) => {
          if (err) { return reject(err) }
          if (!success) { logger.warn(`Transaction revert failed: couldn\'t revert update of ${update.resourceType}/${update.id}`) }
          resolve()
        })
      }))
    })

    return promises
  }

  const processBundle = (ctx, bundle, isTransaction, callback) => {
    // make sure the bundle is sorted in the order that it should be executed
    bundle = transaction.sortTransactionBundle(bundle)

    // resolve references up front
    resolveReferences(bundle)

    // store operations that potencially need to be reverted
    const revert = {
      creates: [],
      updates: []
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
          logger.warn(`Reverting transaction ${bundle.id} as there were errors`)
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

  return {
    /**
     * Handles processing of transaction and batch bundles
     *
     * @param {RequestContext} ctx
     * @param {Object} bundle The FHIR bundle to process
     * @param {CoreCallback} callback
     */
    transaction: (ctx, bundle, callback) => {
      logger.info(`Processing transaction ${bundle.id} with ${bundle.entry.length} entries`)
      if (bundle.type === 'transaction') {
        processBundle(ctx, bundle, true, callback)
      } else if (bundle.type === 'batch') {
        processBundle(ctx, bundle, false, callback)
      } else {
        return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Bundle.type must either be transaction or batch'))
      }
    },
    searchAll: (ctx) => {
      throw new Error('Not yet supported')
    },
    conformance: (ctx) => {
      throw new Error('Not yet supported')
    }
  }
}
