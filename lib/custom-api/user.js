'use strict'
const logger = require('winston')
const crypto = require('crypto')
const uuid = require('uuid')

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

const handleErrorAndBadRequest = (err, badRequest, callback) => {
  if (err) {
    logger.error(err)
    return callback(err)
  }
  if (badRequest) {
    return callback(null, badRequest)
  }
}

module.exports = (mongo) => {
  let authorization = Authorization(mongo)
  let fhirCommon = FhirCommon(mongo)
  const hooks = Hooks()

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
          return handleErrorAndBadRequest(err, badRequest, callback)
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
                  return handleErrorAndBadRequest(err, badRequest, callback)
                }

                logger.warn(`Could not find user ${req.params.email}`)
                res.status(404).send(operationOutcome)
              })
            } else if (user.locked) {
              const operationOutcome = fhirCommon.buildOperationOutcome('information', 'security', 'Locked')
              hooks.executeAfterHooks('authenticate', {}, res.locals.ctx, 'user', operationOutcome, (err, badRequest, data) => {
                if (err || badRequest) {
                  return handleErrorAndBadRequest(err, badRequest, callback)
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
                  return handleErrorAndBadRequest(err, badRequest, callback)
                }

                res.send(result)
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
