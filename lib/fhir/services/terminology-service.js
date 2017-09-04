/*
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

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
