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
const crypto = require('crypto')
const uuid = require('uuid')

const FhirCommon = require('../fhir/common')
const Authorization = require('../security/authorization')

const defaultUser = {
  email: 'sysadmin@jembi.org',
  // default password: sysadmin
  hash: '4956a991e772edd0576e62eae92f9c94fc693a2d0ee07f8f46ccce9c343d0836304f4de2ea64a41932fe0a6adc83d853a964fb785930fb4293fef8ee37448ac8',
  salt: '08f3a235-8660-49e9-93c3-5d4655b98c83',
  type: 'sysadmin'
}

module.exports = (mongo) => {
  let authorization = Authorization(mongo)
  let fhirCommon = FhirCommon(mongo)

  let generateSaltedHash = (password) => {
    let salt = uuid.v4()
    let hash = crypto.createHash('sha512')
    hash.update(salt)
    hash.update(password)
    return {
      hash: hash.digest('hex'),
      salt: salt
    }
  }

  let setPasswordHashForUser = (user) => {
    if (user.password) {
      let saltHash = generateSaltedHash(user.password)
      user.hash = saltHash.hash
      user.salt = saltHash.salt
      delete user.password
    }
  }

  return {
    loadDefaultSysadmin: (callback) => {
      logger.debug('Checking if default sysadmin exists')

      mongo.getDB((err, db) => {
        if (err) {
          return callback(err)
        }

        let c = db.collection('user')
        c.findOne({email: defaultUser.email}, (err, user) => {
          if (err) {
            return callback(err)
          }

          if (!user) {
            c.insertOne(defaultUser, (err) => {
              if (err) {
                return callback(err)
              }
              logger.info(`Created default sysadmin user '${defaultUser.email}'`)
              callback()
            })
          } else {
            logger.debug('Default sysadmin exists')
            callback()
          }
        })
      })
    },

    authenticate: (req, res) => {
      logger.info(`Authenticate ${req.params.email}`)

      mongo.getDB((err, db) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }

        let c = db.collection('user')
        c.findOne({email: req.params.email}, {fields: {salt: 1, locked: 1}}, (err, user) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          if (!user) {
            logger.warn(`Could not find user ${req.params.email}`)
            res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
          } else if (user.locked) {
            logger.warn(`Request for locked user ${req.params.email}`)
            res.status(423).send(fhirCommon.buildOperationOutcome('information', 'security', 'Locked'))
          } else {
            res.send({
              salt: user.salt,
              ts: new Date()
            })
          }
        })
      })
    },

    read: (req, res) => {
      authorization.authorize('read', res.locals.ctx, 'user', (err, badRequest) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }
        if (badRequest) {
          return res.status(badRequest.httpStatus).send(badRequest.resource)
        }
        mongo.getDB((err, db) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          let c = db.collection('user')
          c.findOne({email: req.params.email}, {fields: {email: 1, type: 1, resource: 1}}, (err, user) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            if (!user) {
              return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
            }

            res.send(user)
          })
        })
      })
    },

    search: (req, res) => {
      authorization.authorize('search', res.locals.ctx, 'user', (err, badRequest) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }
        if (badRequest) {
          return res.status(badRequest.httpStatus).send(badRequest.resource)
        }
        return res.status(500).send(fhirCommon.buildOperationOutcome('information', 'not-supported', 'Not supported'))
      })
    },

    create: (req, res) => {
      authorization.authorize('create', res.locals.ctx, 'user', (err, badRequest) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }
        if (badRequest) {
          return res.status(badRequest.httpStatus).send(badRequest.resource)
        }
        mongo.getDB((err, db) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          let c = db.collection('user')
          c.findOne({email: req.body.email}, {fields: {email: 1}}, (err, user) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            if (user) {
              return res.status(409).send(`User with username '${req.body.email}' already exists`)
            }

            setPasswordHashForUser(req.body)
            c.insertOne(req.body, (err) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }

              logger.info(`Created user '${req.body.email}'`)
              res.sendStatus(201)
            })
          })
        })
      })
    },

    update: (req, res) => {
      authorization.authorize('update', res.locals.ctx, 'user', (err, badRequest) => {
        if (err) {
          logger.error(err)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
        }
        if (badRequest) {
          return res.status(badRequest.httpStatus).send(badRequest.resource)
        }
        mongo.getDB((err, db) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          let c = db.collection('user')
          c.findOne({email: req.params.email}, {fields: {email: 1}}, (err, user) => {
            if (err) {
              logger.error(err)
              return res.status(500).send(fhirCommon.internalServerErrorOutcome())
            }

            if (!user) {
              return res.status(404).send(fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found'))
            }

            setPasswordHashForUser(req.body)
            c.updateOne({_id: user._id}, {$set: req.body}, (err) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }

              logger.info(`Updated user '${req.params.email}'`)
              res.sendStatus(200)
            })
          })
        })
      })
    }
  }
}
