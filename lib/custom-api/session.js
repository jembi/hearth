/**
 * Copyright (c) 2017-present, Jembi Health Systems NPC. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict'

const common = require('../fhir/common')
const config = require('../config')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const logger = require('winston')

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

function generatePasswordHash (password, salt) {
  const hash = crypto.createHash('sha512')
  hash.update(salt)
  hash.update(password)
  return hash.digest('hex')
}

function generateTokenForUser (user, callback) {
  const payload = {
    email: user.email,
    type: user.type
  }
  const options = {
    issuer: 'Hearth',
    subject: `user/${user._id}`,
    expiresIn: '1d'
  }
  jwt.sign(payload, config.getConf('authentication:secret'), options, callback)
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

        const hash = generatePasswordHash(req.body.password, user.salt)

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