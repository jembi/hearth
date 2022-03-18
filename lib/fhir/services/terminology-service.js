/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const logger = require('winston')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  const fhirCommon = FhirCommon(mongo)

  return {
    lookup: (req, res, next) => {
      if (res.locals.operation !== '$lookup') {
        return next()
      }

      if (!req.query.system || !req.query.code) {
        return res.status(400).send(fhirCommon.buildOperationOutcome('error', 'invalid', 'Must specify \'system\' and \'code\' parameters'))
      }

      const system = req.query.system
      const code = req.query.code

      mongo.getDB((err, db) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }

        const cName = 'ValueSet'
        const c = db.collection(cName)
        const query = {
          'codeSystem.system': system,
          'codeSystem.concept': {
            $elemMatch: {
              code: code
            }
          }
        }
        const options = { 'codeSystem.concept.$': 1 }

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
                  name: 'code',
                  valueString: result.codeSystem.concept[0].code
                },
                {
                  name: 'display',
                  valueString: result.codeSystem.concept[0].display
                }
              ]
            })
          }
        })
      })
    }
  }
}
