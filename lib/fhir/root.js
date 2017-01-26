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

        const buildOutcomeHandler = (allowFailure) => {
          return (err, outcome) => {
            if (err) {
              return reject(err)
            }
            if (!allowFailure && outcome.httpStatus !== 200 && outcome.httpStatus !== 201) {
              const err = new Error('A transaction step returned a non-200/201 status')
              err.outcome = outcome
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
        }

        switch (entryCtx.method) {
          case 'DELETE':
            // fhirCore.delete(entryCtx, resourceType, id, buildOutcomeHandler(false)) // TODO doesn't exist
            resolve()
            break
          case 'POST':
            fhirCore.create(entryCtx, resourceType, entry.resource, buildOutcomeHandler(false))
            break
          case 'PUT':
            fhirCore.update(entryCtx, resourceType, id, entry.resource, buildOutcomeHandler(false))
            break
          case 'GET':
            // GETs don't count for transaction failure
            if (id) {
              if (vid) {
                fhirCore.vread(ctx, resourceType, id, vid, buildOutcomeHandler(true))
              } else {
                fhirCore.read(ctx, resourceType, id, buildOutcomeHandler(true))
              }
            } else {
              fhirCore.search(ctx, resourceType, buildOutcomeHandler(true))
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
      // TODO trigger rollback
      if (err.outcome && err.outcome.httpStatus) {
        if (err.outcome.httpStatus >= 400 && err.outcome.httpStatus < 500) {
          return callback(null, { httpStatus: 400, resource: err.outcome })
        } else {
          return callback(null, { httpStatus: 500, resource: err.outcome })
        }
      }
      return callback(null, { httpStatus: 500, resource: fhirCommon.internalServerErrorOutcome() })
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
