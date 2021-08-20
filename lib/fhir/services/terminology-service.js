 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const logger = require('../../logger')
const FhirCommon = require('../common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  return {
    lookup: (req, res, next) => {
      if (res.locals.operation !== '$lookup') {
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

        let cName = 'ValueSet'
        let c = db.collection(cName)
        let query = {
          'codeSystem.system': system,
          'codeSystem.concept': {
            $elemMatch: {
              code: code
            }
          }
        }
        let options = { 'codeSystem.concept.$': 1 }

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
