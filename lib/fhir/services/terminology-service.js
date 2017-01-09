'use strict'
const logger = require('winston')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let collectionNameForSystem = (system) => {
    let res = 'concept_'
    for (let a of system) {
      if (/[a-zA-Z0-9]/.test(a)) {
        res += a
      } else {
        res += '_'
      }
    }
    return res
  }
  return {
    collectionNameForSystem: collectionNameForSystem,

    lookup: (req, res, next) => {
      if (req.params.operation !== '$lookup') {
        return next()
      }

      if (!req.query.system || !req.query.code) {
        return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Must specify \'system\' and \'code\' parameters'))
      }

      let system = req.query.system
      let code = req.query.code

      mongo.getDB((err, db) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }

        let cName = collectionNameForSystem(system)
        let c = db.collection(cName)
        let query = {code: code}
        let options = {fields: {code: 1, display: 1}}

        mongo.util.debugLog(cName, 'findOne', query, options)

        c.findOne(query, options, (err, result) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          if (!result) {
            res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
          } else {
            res.send({
              resourceType: 'Parameters',
              parameter: [
                {
                  name: 'name',
                  valueString: system
                },
                {
                  name: 'display',
                  valueString: result.display
                },
                {
                  name: 'abstract',
                  valueString: 'false'
                }
              ]
            })
          }
        })
      })
    }
  }
}
