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
const config = require('../config')
const crypto = require('crypto')
const FhirCommon = require('../fhir/common')

// adapted from the OpenHIM
// https://github.com/jembi/openhim-core-js/blob/master/src/api/authentication.coffee

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  let hasRequestExpired = (authTS) => {
    let requestDate = new Date(Date.parse(authTS))

    let authWindowSeconds = config.getConf('authentication:authWindowSeconds')
    let to = new Date()
    to.setSeconds(to.getSeconds() + authWindowSeconds)
    let from = new Date()
    from.setSeconds(from.getSeconds() - authWindowSeconds)

    if (requestDate < from || requestDate > to) {
      return true
    }
    return false
  }

  let userHash = (user, authSalt, authTS) => {
    let hash = crypto.createHash('sha512')
    hash.update(user.hash)
    hash.update(authSalt)
    hash.update(authTS)
    return hash.digest('hex')
  }

  return {
    authenticate: (req, res, next) => {
      let email = req.headers['auth-username']
      let authTS = req.headers['auth-ts']
      let authSalt = req.headers['auth-salt']
      let authToken = req.headers['auth-token']

      if (!email || !authTS || !authSalt || !authToken) {
        logger.warn(`Denying request to '${email}'. Invalid/empty auth headers provided`)
        return res.status(401).send(fhirCommon.buildOperationOutcome('information', 'login', 'Unauthorized'))
      }

      if (hasRequestExpired(authTS)) {
        logger.warn(`Request for user '${email}' has expired. Denying access.`)
        return res.status(401).send(fhirCommon.buildOperationOutcome('information', 'login', 'Unauthorized'))
      }

      mongo.getDB((err, db) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }

        let c = db.collection('user')
        c.findOne({email: email}, (err, user) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          if (!user) {
            logger.warn(`Could not find user ${req.params.email}`)
            res.status(401).send(fhirCommon.buildOperationOutcome('information', 'login', 'Unauthorized'))
          } else if (user.locked) {
            logger.warn(`Access denied: User ${req.params.email} is locked`)
            res.status(401).send(fhirCommon.buildOperationOutcome('information', 'login', 'Unauthorized'))
          } else {
            if (authToken === userHash(user, authSalt, authTS)) {
              logger.info(`User '${email}' is authenticated`)
              delete user.hash
              delete user.salt
              res.locals.authenticatedUser = user
              next()
            } else {
              logger.warn(`User '${email}' is NOT authenticated`)
              res.status(401).send(fhirCommon.buildOperationOutcome('information', 'login', 'Unauthorized'))
            }
          }
        })
      })
    }
  }
}
