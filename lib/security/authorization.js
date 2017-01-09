'use strict'
const logger = require('winston')
const FhirCommon = require('../fhir/common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  // default handler for when an authorizer doesn't supply one
  const defaultPostInteractionHandler = (req, res, data, callback) => callback(data)

  // determine if pre interaction handler is a function or array
  // if function, execute immediately, if array execute each handler in the array
  let chainPreInteractionHandlers = (handler, req, res, done) => {
    if (typeof handler === 'function') {
      // single handler
      handler(req, res.locals.authenticatedUser, done)
    } else {
      // array of auth handlers
      // execute each handler in turn, and end on err or if auth fails
      let next = (i) => (err, authorized, badRequest) => {
        if (err || !authorized || badRequest || (i + 1 >= handler.length)) {
          return done(err, authorized, badRequest)
        }
        handler[i + 1](req, res.locals.authenticatedUser, next(i + 1))
      }
      handler[0](req, res.locals.authenticatedUser, next(0))
    }
  }

  return {
    /**
     * Load the appropriate authorizer module for the current user type
     */
    loadAuthorizer: (req, res, next) => {
      if (!res.locals.authenticatedUser || !res.locals.authenticatedUser.type) {
        logger.error('Invalid authentication state')
        return res.status(500).send(fhirCommon.internalServerErrorOutcome())
      }

      switch (res.locals.authenticatedUser.type) {
        case 'sysadmin':
          res.locals.authorizer = require('./authorizers/sysadmin')(mongo)
          break
        default:
          logger.error(`User type '${res.locals.authenticatedUser.type}' set to unsupported value`)
          return res.status(500).send(fhirCommon.internalServerErrorOutcome())
      }

      next()
    },

    /**
     * Authorize the request for a specific interaction
     *
     * The request will be matched against the loaded authorizer module.
     *
     * If the endpoint is authorized, the 'callback' will be called with the following parameters:
     *
     * * resourceType: the endpoint resource type, for reference
     *
     * * postInteractionHandler: a handler provided by the authorizer for the endpoint
     *       These handlers provide role-specific operations that must be applied
     *       The authorized endpoint must call this handler with (req, res, data, callback) before responding to the client
     *       The data parameter can contain the data that will be returned to the client.
     *       The authorizer module will call this callback with the (possible altered) data as a parameter (data)
     *       The authorizer may also handle the Express response on its own
     *       (e.g. if it determines that the current request is unauthorized based on what's contained in 'data')
     *       In this event, no callback will be made
     *
     * * searchFilter: (only for 'search' interactions) MongoDB filters that must be applied for the role
     *
     * * searchAllAllowed: (only for 'search' interactions, if there are no searchFilters) Indicates that the authenticated user is authorized to 'search all'
     *      e.g. if they are calling a resource endpoint without any parameters
     *      This only applies if there are no authorizer searchFilters present, since in this case the search, even without parameters,
     *      implicitly implies that the user is not allowed to 'search all'.
     *
     * @param {String}   interaction The type of interaction being performed (read, create, update, etc.)
     * @param {Object}   req Express request handle
     * @param {Object}   res Express response handle
     * @param {String}   nonFhirResource (optional) If the endpoint isn't a FHIR endpoint, the type needs to be specified here
     * @param {Function} callback (resourceType, postInteractionHandler, searchFilters, searchAllAllowed)
     */
    authorize: (interaction, req, res, nonFhirResource, callback) => {
      let resourceType = null
      if (typeof nonFhirResource === 'function') {
        resourceType = req.params.resourceType
        callback = nonFhirResource
      } else if (typeof nonFhirResource === 'string') {
        resourceType = nonFhirResource
      } else {
        resourceType = req.params.resourceType
      }

      let authorizer = res.locals.authorizer
      let authenticatedUser = res.locals.authenticatedUser

      if (req.headers.category && req.headers.category.indexOf(fhirCommon.breakTheGlassCategory) > -1) {
        logger.info(`${authenticatedUser.email} is breaking the glass for '${interaction} ${req.url}'`)
        authenticatedUser.isBreakingTheGlass = true
      }

      let sendForbidden = () => {
        logger.info(`${authenticatedUser.email} isn't authorized for '${interaction} ${req.url}'`)
        res.status(403).send(fhirCommon.buildOperationOutcome('information', 'forbidden', 'Forbidden'))
      }

      let done = (interactionType) => {
        logger.info(`[${authenticatedUser.email}] ${interaction} ${req.url}`)

        let postInteractionHandler = defaultPostInteractionHandler
        if (interactionType.postInteractionHandlers && (interaction in interactionType.postInteractionHandlers)) {
          postInteractionHandler = interactionType.postInteractionHandlers[interaction]
        }

        if (interaction === 'search') {
          if (interactionType.searchFilters) {
            interactionType.searchFilters(res.locals.authenticatedUser, (err, searchFilters) => {
              if (err) {
                logger.error(err)
                return res.status(500).send(fhirCommon.internalServerErrorOutcome())
              }
              callback(resourceType, postInteractionHandler, searchFilters)
            })
          } else {
            callback(resourceType, postInteractionHandler, null, interactionType.searchAllAllowed)
          }
        } else {
          callback(resourceType, postInteractionHandler)
        }
      }

      if (!authorizer || !authorizer.allowedResourceTypes) {
        return sendForbidden()
      }

      for (let type of authorizer.allowedResourceTypes) {
        if (type.resourceType === resourceType) {
          if (type.interactions === '*' || type.interactions.indexOf(interaction) > -1) {
            if (type.preInteractionHandlers && (interaction in type.preInteractionHandlers)) {
              return chainPreInteractionHandlers(type.preInteractionHandlers[interaction], req, res, (err, isAuthorized, badRequest) => {
                if (err) {
                  logger.error(err)
                  return res.status(500).send(fhirCommon.internalServerErrorOutcome())
                }

                if (badRequest) {
                  return res.status(badRequest.statusCode).send(fhirCommon.buildOperationOutcome('error', 'invalid', badRequest.body))
                }

                if (isAuthorized) {
                  done(type)
                } else {
                  sendForbidden()
                }
              })
            } else {
              return done(type)
            }
          }
        }
      }

      sendForbidden()
    }
  }
}
