'use strict'

const _ = require('lodash')
const url = require('url')
const logger = require('winston')

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

  const processBundle = (ctx, bundle, isTransaction, callback) => {
    const responseBundle = {
      resourceType: 'Bundle',
      entry: []
    }

    if (isTransaction) {
      bundle = transaction.sortTransactionBundle(bundle)
      responseBundle.type = 'transaction-response'
    } else {
      responseBundle.type = 'batch-response'
    }

    const promises = []

    bundle.entry.forEach((entry) => {
      promises.push(new Promise((resolve, reject) => {
        const parsedUrl = url.parse(entry.request.url, true)

        let entryCtx = _.cloneDeep(ctx)
        entryCtx.method = entry.request.method
        entryCtx.url = entry.request.url
        entryCtx.query = parsedUrl.query

        const pathParts = parsedUrl.pathname.split('/')
        const resourceType = pathParts[0]
        const id = pathParts[1]
        const vid = pathParts[3]

        const outcomeHandler = (err, outcome) => {
          if (err) {
            return reject(err)
          }
          const resEntry = { response: {} }
          resEntry.response.status = outcome.httpStatus
          resEntry.response.location = outcome.location
          resEntry.resource = outcome.resource
          resEntry._originalIndex = entry._originalIndex
          responseBundle.entry.push(resEntry)
          resolve()
        }

        switch (entryCtx.method) {
          case 'DELETE':
            // fhirCore.delete(entryCtx, resourceType, id, outcomeHandler) // doesn't exist
            resolve()
            break
          case 'POST':
            fhirCore.create(entryCtx, resourceType, entry.resource, outcomeHandler)
            break
          case 'PUT':
            fhirCore.update(entryCtx, resourceType, id, entry.resource, outcomeHandler)
            break
          case 'GET':
            if (id) {
              if (vid) {
                fhirCore.vread(ctx, resourceType, id, vid, outcomeHandler)
              } else {
                fhirCore.read(ctx, resourceType, id, outcomeHandler)
              }
            } else {
              fhirCore.search(ctx, resourceType, outcomeHandler)
            }
            break
          default:
            return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Unknown request.method on bundle entry'))
        }
      }))
    })

    Promise.all(promises).then(() => {
      if (isTransaction) {
        // sort back to original index to match request
        responseBundle.entry.sort((a, b) => {
          return a._originalIndex - b._originalIndex
        })
        responseBundle.entry.forEach((entry) => {
          delete entry._originalIndex
        })
      }
      return callback(null, { httpStatus: 200, resource: responseBundle })
    }).catch((err) => {
      return callback(err)
    })
  }

  return {
    transaction: (ctx, bundle, callback) => {
      logger.info(`Processing a transaction with ${bundle.entry.length} entries`)
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
