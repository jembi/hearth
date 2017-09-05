 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
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
