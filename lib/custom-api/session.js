/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const common = require('../fhir/common')
const config = require('../config')
const passwordHelper = require('./password-helper')

const fs = require('fs')
const jwt = require('jsonwebtoken')
const logger = require('../logger')

function isSessionCreationEnabled () {
  return config.getConf('authentication:type') === 'jwt'
}

function isBodyValid (body) {
  return (
    body != null &&
    typeof body.email === 'string' &&
    typeof body.password === 'string'
  )
}

function generateTokenForUser (user, callback) {
  const payload = {
    email: user.email,
    type: user.type
  }

  const jwtConf = config.getConf('authentication:jwt') || {}

  const options = {
    algorithm: jwtConf.algorithm || 'HS256',
    issuer: jwtConf.issuer || 'Hearth',
    subject: `user/${user._id}`,
    expiresIn: jwtConf.expiresIn || '1d',
    audience: jwtConf.setAudience || 'hearth:user'
  }

  let secretOrPrivateKey = null
  const newJwtOptionsEmpty = Object.keys(jwtConf).length === 0 && jwtConf.constructor === Object
  if (newJwtOptionsEmpty) {
    // use deprecated authentication.secret config
    secretOrPrivateKey = config.getConf('authentication:secret')
  } else if (jwtConf.algorithm.startsWith('HS')) {
    secretOrPrivateKey = jwtConf.secret
  } else if (jwtConf.algorithm.startsWith('RS') || jwtConf.algorithm.startsWith('ES') || jwtConf.algorithm.startsWith('PS')) {
    try {
      secretOrPrivateKey = fs.readFileSync(jwtConf.privKey).toString()
    } catch (err) {
      return callback(err)
    }
  } else {
    return callback(new Error('Unknown jwt algorithm supplied'))
  }

  jwt.sign(payload, secretOrPrivateKey, options, callback)
}

module.exports = exports = mongo => {
  function findUserByEmail (email, callback) {
    mongo.getDB((err, db) => {
      if (err) {
        return callback(err)
      }
      db.collection('user').findOne({email}, callback)
    })
  }

  return {
    create (req, res, next) {
      if (!isSessionCreationEnabled()) {
        logger.warn('Session creation is not enabled')
        return res
          .status(501)
          .send(
            common.buildOperationOutcome(
              'information',
              'not-supported',
              'Session creation is not enabled'
            )
          )
      }

      if (!isBodyValid(req.body)) {
        logger.debug('Invalid request body for session creation')
        return res
          .status(400)
          .send(
            common.buildOperationOutcome(
              'error',
              'required',
              'Missing email or password'
            )
          )
      }

      findUserByEmail(req.body.email, (err, user) => {
        if (err) {
          return next(err)
        }

        if (!user) {
          // User not found for provided email
          logger.debug(`User not found for email address ${req.body.email}`)
          return res
            .status(401)
            .send(
              common.buildOperationOutcome(
                'information',
                'login',
                'Unauthorized'
              )
            )
        }

        const hash = passwordHelper.generatePasswordHash(
          req.body.password,
          user.salt
        )

        if (hash !== user.hash) {
          // Provided password does not match
          logger.debug(`Invalid password for user ${req.body.email}`)
          return res
            .status(401)
            .send(
              common.buildOperationOutcome(
                'information',
                'login',
                'Unauthorized'
              )
            )
        }

        generateTokenForUser(user, (err, token) => {
          if (err) {
            return next(err)
          }
          logger.info(`Created session for user ${req.body.email}`)
          res.status(201).send({token})
        })
      })
    }
  }
}

exports.generateTokenForUser = generateTokenForUser
