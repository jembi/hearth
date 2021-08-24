 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const logger = require('../logger')
const passwordHelper = require('./password-helper')

const FhirCommon = require('../fhir/common')
const Authorization = require('../security/authorization')
const Hooks = require('../fhir/hooks')
const config = require('../config')

const defaultUser = {
  email: 'sysadmin@jembi.org',
  // default password: sysadmin
  hash: '4956a991e772edd0576e62eae92f9c94fc693a2d0ee07f8f46ccce9c343d0836304f4de2ea64a41932fe0a6adc83d853a964fb785930fb4293fef8ee37448ac8',
  salt: '08f3a235-8660-49e9-93c3-5d4655b98c83',
  type: 'sysadmin'
}

const handleErrorAndBadRequest = (err, badRequest, res) => {
  if (err) {
    logger.error(err)
    return res.status(err.statusCode).send(err.message)
  }
  if (badRequest) {
    res.status(400).send(badRequest)
  }
}

module.exports = (mongo) => {
  let authorization = Authorization(mongo)
  let fhirCommon = FhirCommon(mongo)
  const hooks = Hooks()

  let setPasswordHashForUser = (user) => {
    if (user.password) {
      let saltHash = passwordHelper.generateSaltedHash(user.password)
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

      // define local context for auditing
      res.locals.ctx = {
        authenticatedUser: {
          resource: '',
          email: req.params.email
        },
        headers: req.headers,
        query: req.query,
        url: req.originalUrl
      }

      hooks.executeBeforeHooks('authenticate', {}, res.locals.ctx, 'user', (err, badRequest) => {
        if (err || badRequest) {
          return handleErrorAndBadRequest(err, badRequest, res)
        }

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
              const operationOutcome = fhirCommon.buildOperationOutcome('information', 'not-found', 'Not found')
              hooks.executeAfterHooks('authenticate', {}, res.locals.ctx, 'user', operationOutcome, (err, badRequest, data) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, res)
                }

                logger.warn(`Could not find user ${req.params.email}`)
                res.status(404).send(operationOutcome)
              })
            } else if (user.locked) {
              const operationOutcome = fhirCommon.buildOperationOutcome('information', 'security', 'Locked')
              hooks.executeAfterHooks('authenticate', {}, res.locals.ctx, 'user', operationOutcome, (err, badRequest, data) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, res)
                }

                logger.warn(`Request for locked user ${req.params.email}`)
                res.status(423).send(operationOutcome)
              })
            } else {
              const result = {
                salt: user.salt,
                ts: new Date()
              }

              hooks.executeAfterHooks('authenticate', {}, res.locals.ctx, 'user', result, (err, badRequest, data) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, res)
                }

                res.send(data)
              })
            }
          })
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

        hooks.executeBeforeHooks('read', {}, res.locals.ctx, 'user', (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, res)
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

              hooks.executeAfterHooks('read', {}, res.locals.ctx, 'user', user, (err, badRequest, data) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, res)
                }

                res.send(data)
              })
            })
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

        hooks.executeBeforeHooks('search', {}, res.locals.ctx, 'user', (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, res)
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

              hooks.executeAfterHooks('search', {}, res.locals.ctx, 'user', user, (err, badRequest, data) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, res)
                }

                res.send(data)
              })
            })
          })
        })
      })
    },

    create: (req, res) => {
      const performCreate = () => {
        hooks.executeBeforeHooks('create', {}, res.locals.ctx, 'user', (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, res)
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

                hooks.executeAfterHooks('read', {}, res.locals.ctx, 'user', req.body, (err, badRequest, data) => {
                  if (err || badRequest) {
                    return handleErrorAndBadRequest(err, badRequest, res)
                  }

                  logger.info(`Created user '${data.email}'`)
                  res.sendStatus(201)
                })
              })
            })
          })
        })
      }

      if (config.getConf('authentication:enablePublicUserCreation')) {
        // define local context for un-authenticated request
        res.locals.ctx = {
          authenticatedUser: {
            resource: '',
            email: req.params.email
          },
          headers: req.headers,
          query: req.query,
          url: req.originalUrl
        }

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

        hooks.executeBeforeHooks('authenticate', {}, res.locals.ctx, 'user', (err, badRequest) => {
          if (err || badRequest) {
            return handleErrorAndBadRequest(err, badRequest, res)
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

                hooks.executeAfterHooks('update', {}, res.locals.ctx, 'user', req.body, (err, badRequest, data) => {
                  if (err || badRequest) {
                    return handleErrorAndBadRequest(err, badRequest, res)
                  }

                  logger.info(`Updated user '${data.email}'`)
                  res.sendStatus(200)
                })
              })
            })
          })
        })
      })
    }
  }
}
