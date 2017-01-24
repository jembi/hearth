'use strict'

const FhirCommon = require('./common')
// const Transaction = require('./transaction')

module.exports = (mongo, modules) => {
  const fhirCommon = FhirCommon(mongo)
  // const transaction = Transaction(mongo)

  const processTransaction = (bundle, res) => {
    const sortedBundle = [] // transaction.sortTransactionBundle(bundle)
    sortedBundle.forEach((entry) => {
      const resourceType = entry.resource.resourceType
      switch (entry.request.method) {
        case 'DELETE':
          module[resourceType].delete()
          break
        case 'POST':
          module[resourceType].create()
          break
        case 'PUT':
          module[resourceType].update()
          break
        case 'GET':
          module[resourceType].read()
          break
        default:
          return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Unknown request.method on bundle entry'))
      }
    })
  }

  const processBatch = () => {

  }

  return {
    transaction: (req, res) => {
      const bundle = req.body
      if (bundle.type === 'transaction') {
        processTransaction(bundle)
      } else if (bundle.type === 'batch') {
        processBatch(bundle)
      } else {
        return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Bundle.type must either be transaction or batch'))
      }
    },
    searchAll: (req, res) => {
      throw new Error('Not yet supported')
    },
    conformance: (req, res) => {
      throw new Error('Not yet supported')
    }
  }
}
