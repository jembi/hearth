/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const config = require('../../config')
const common = require('../../fhir/common')
const jwt = require('jsonwebtoken')
const logger = require('winston')

const TOKEN_PATTERN = /^ *(?:[Bb][Ee][Aa][Rr][Ee][Rr]) +([A-Za-z0-9\-._~+/]+=*) *$/

function sendUnauthorisedResponse (res) {
  return res
    .status(401)
    .set('WWW-Authenticate', 'Bearer realm="Hearth"')
    .send(common.buildOperationOutcome('information', 'login', 'Unauthorized'))
}

module.exports = exports = () => {
  return {
    authenticate (req, res, next) {
      const header = req.headers.authorization || ''
      const match = TOKEN_PATTERN.exec(header)

      if (!match) {
        logger.debug('Missing or invalid \'Authorization\' header')
        return sendUnauthorisedResponse(res)
      }

      jwt.verify(match[1], config.getConf('authentication:secret'), (err, decoded) => {
        if (err) {
          logger.debug('Token could not be verified')
          return sendUnauthorisedResponse(res)
        }
        res.locals.authenticatedUser = decoded
        next()
      })
    }
  }
}
