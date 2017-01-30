'use strict'

const _ = require('lodash')
const url = require('url')
const logger = require('winston')
const ObjectId = require('mongodb').ObjectId

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
    // make sure the bundle is sorted in the order that it should be executed
    bundle = transaction.sortTransactionBundle(bundle)

    // resolve references up front
    bundle.entry.forEach((sourceEntry) => {
      if (sourceEntry.request.method === 'POST') {
        const id = new ObjectId()
        sourceEntry._id = id
        bundle.entry.forEach((targetEntry) => {
          fhirCommon.util.resolveReferences(targetEntry, sourceEntry.fullUrl, `${sourceEntry.request.url.split('/')[0]}/${id}`)
        })
      }
    })

    const responseBundle = {
      resourceType: 'Bundle',
      entry: []
    }
    if (isTransaction) {
      responseBundle.type = 'transaction-response'
    } else {
      responseBundle.type = 'batch-response'
    }

    // store operations that potencially need to be reverted
    const revert = {
      creates: [],
      updates: []
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

        const buildOutcomeHandler = (method, resourceType) => {
          return (err, outcome) => {
            if (err) {
              return reject(err)
            }

            const resEntry = { response: {} }

            if (method === 'POST') {
              resEntry._revertOnFail = true
              if (outcome.httpStatus === 201) {
                revert.creates.push({
                  resourceType: resourceType,
                  id: outcome._id
                })
              }
            }

            if (method === 'PUT') {
              resEntry._revertOnFail = true
              if (outcome.httpStatus === 200 || outcome.httpStatus === 201) {
                revert.updates.push({
                  resourceType: resourceType,
                  id: outcome._id
                })
              }
            }

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
            // fhirCore.delete(entryCtx, resourceType, id, buildOutcomeHandler('DELETE', resourceType)) // TODO doesn't exist
            logger.error(`Transaction ${bundle.id} deletes aren\'t supported.`)
            buildOutcomeHandler('DELETE', resourceType)(null, fhirCommon.buildHTTPOutcome(405, 'error', 'not-supported', 'Transaction deletes aren\'t supported'))
            break
          case 'POST':
            fhirCore.create(entryCtx, resourceType, entry.resource, entry._id, buildOutcomeHandler('POST', resourceType))
            break
          case 'PUT':
            fhirCore.update(entryCtx, resourceType, id, entry.resource, buildOutcomeHandler('PUT', resourceType))
            break
          case 'GET':
            if (id) {
              if (vid) {
                fhirCore.vread(ctx, resourceType, id, vid, buildOutcomeHandler('GET', resourceType))
              } else {
                fhirCore.read(ctx, resourceType, id, buildOutcomeHandler('GET', resourceType))
              }
            } else {
              fhirCore.search(ctx, resourceType, buildOutcomeHandler('GET', resourceType))
            }
            break
          default:
            return callback(null, fhirCommon.buildHTTPOutcome(400, 'error', 'invalid', 'Unknown request.method on bundle entry'))
        }
      }))
    })

    Promise.all(promises).then(() => {
      let requestError = false
      let serverError = false
      const promises = []

      if (isTransaction) {
        // Check responses for errors
        responseBundle.entry.forEach((entry) => {
          if (entry._revertOnFail && entry.response.status !== 200 && entry.response.status !== 201) {
            if (entry.response.status >= 400 && entry.response.status < 500) {
              requestError = true
            } else {
              serverError = true
            }
          }
        })

        if (requestError || serverError) {
          // revert the transaction
          logger.warn(`Reverting transaction ${bundle.id} as there were errors`)
          revert.creates.forEach((create) => {
            promises.push(new Promise((resolve, reject) => {
              transaction.revertCreate(create.resourceType, create.id, (err, success) => {
                if (err) { return reject(err) }
                if (!success) { logger.warn(`Transaction ${bundle.id} revert failed: couldn\'t revert creation of ${create.resourceType}/${create.id}`) }
                resolve()
              })
            }))
          })

          revert.updates.forEach((update) => {
            promises.push(new Promise((resolve, reject) => {
              transaction.revertUpdate(update.resourceType, update.id, (err, success) => {
                if (err) { return reject(err) }
                if (!success) { logger.warn(`Transaction ${bundle.id} revert failed: couldn\'t revert update of ${update.resourceType}/${update.id}`) }
                resolve()
              })
            }))
          })
        }
      }

      // sort back to original index to match request
      responseBundle.entry.sort((a, b) => {
        return a._originalIndex - b._originalIndex
      })

      // remove processing metadata from entries
      responseBundle.entry.forEach((entry) => {
        delete entry._originalIndex
        delete entry._revertOnFail
      })

      Promise.all(promises).then(() => {
        if (serverError) {
          return callback(null, { httpStatus: 500, resource: responseBundle })
        } else if (requestError) {
          return callback(null, { httpStatus: 400, resource: responseBundle })
        } else {
          return callback(null, { httpStatus: 200, resource: responseBundle })
        }
      }).catch((err) => {
        logger.error(err)
        return callback(null, { httpStatus: 500, resource: fhirCommon.internalServerErrorOutcome() })
      })
    }).catch((err) => {
      logger.error(err)
      return callback(null, { httpStatus: 500, resource: fhirCommon.internalServerErrorOutcome() })
    })
  }

  return {
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
