 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const logger = require('winston')
const crypto = require('crypto')
const uuid = require('uuid')

const FhirCommon = require('../fhir/common')
const Authorization = require('../security/authorization')
const config = require('../config')

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

        let query = { $and: [] }

        if (req.query.resource) {
          query.$and.push({ resource: req.query.resource })
        }

        if (query.$and.length === 0) {
          return res.status(400).send(fhirCommon.buildOperationOutcome('information', 'bad-request', 'Invalid search parameters'))
        }

        mongo.getDB((err, db) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }

          let c = db.collection('user')
          c.findOne(query, { password: 0, hash: 0, salt: 0 }, (err, user) => {
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

    create: (req, res) => {
      const performCreate = () => {
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
      }

      if (config.getConf('authentication:enablePublicUserCreation')) {
        performCreate()
      } else {
        authorization.authorize('create', res.locals.ctx, 'user', (err, badRequest) => {
          if (err) {
            logger.error(err)
            return res.status(500).send(fhirCommon.internalServerErrorOutcome())
          }
          if (badRequest) {
            return res.status(badRequest.httpStatus).send(badRequest.resource)
          }
          performCreate()
        })
      }
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
