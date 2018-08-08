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

function sendServerErrorResponse (res, serverError) {
  return res
    .status(500)
    .send(common.buildOperationOutcome('error', 'login', serverError))
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

      const authConf = config.getConf('authentication')

      let secretOrPublicKey = null
      if (!authConf.jwt) { // keep backwards compatibility of config
        secretOrPublicKey = authConf.secret
      } else if (authConf.jwt.algorithm.startsWith('HS')) {
        secretOrPublicKey = authConf.jwt.secret
      } else if (authConf.jwt.algorithm.startsWith('RS') || authConf.jwt.algorithm.startsWith('ES') || authConf.jwt.algorithm.startsWith('PS')) {
        secretOrPublicKey = authConf.jwt.pubKey
      } else {
        return sendServerErrorResponse(res, 'Unknown jwt algorithm supplied')
      }

      const opts = {}
      if (authConf.jwt) {
        if (authConf.jwt.algorithm) {
          opts.algorithms = [authConf.jwt.algorithm]
        }
        if (authConf.jwt.issuer) {
          opts.issuer = authConf.jwt.issuer
        }
        if (authConf.jwt.validateAudience) {
          opts.audience = new RegExp(authConf.jwt.validateAudience)
        }
      }

      jwt.verify(match[1], secretOrPublicKey, opts, (err, decoded) => {
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
