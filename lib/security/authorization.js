'use strict'
const logger = require('winston')
const FhirCommon = require('../fhir/common')

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  // default handler for when an authorizer doesn't supply one
  const defaultPostInteractionHandler = (ctx, data, callback) => callback(null, null, data)

  // determine if pre interaction handler is a function or array
  // if function, execute immediately, if array execute each handler in the array
  let chainPreInteractionHandlers = (handler, ctx, done) => {
    if (typeof handler === 'function') {
      // single handler
      handler(ctx, done)
    } else {
      // array of auth handlers
      // execute each handler in turn, and end on err or if auth fails
      let next = (i) => (err, authorized, badRequest) => {
        if (err || !authorized || badRequest || (i + 1 >= handler.length)) {
          return done(err, badRequest, authorized)
        }
        handler[i + 1](ctx, next(i + 1))
      }
      handler[0](ctx, next(0))
    }
  }

  return {
    /**
     * Load the appropriate authorizer module for the current user type (Express middleware)
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
     * Pre-interaction handler callback
     * @callback PreInteractionHandlerCallback
     * @param {Object} err
     * @param {Outcome} badRequest A FHIR OperationOutcome if it's a bad request
     * @param {Boolean} authorized True if authorized, false otherwise
     */
    /**
     * Pre-interaction handler. Provides role-specific operations that will be applied when authorizing an interaction.
     * @typedef {Function} PreInteractionHandler
     * @param {RequestContext} ctx The transaction request context (see fhir core)
     * @param {Object} resource The resource as received from the client for a create or update interaction
     * @param {PreInteractionHandlerCallback} callback
     */
    /**
     * Post-interaction handler callback
     * @callback PostInteractionHandlerCallback
     * @param {Object} err
     * @param {Outcome} badRequest A FHIR OperationOutcome if it's a bad request
     * @param {Object} data Possibly altered data
     */
    /**
     * Post-interaction handler. Provides role-specific operations that must be applied.
     * @typedef {Function} PostInteractionHandler
     * @param {RequestContext} ctx The transaction request context (see fhir core)
     * @param {Object} data The data that will be returned to the client.
     *       The authorizer module _may_ alter this data for response.
     * @param {PostInteractionHandlerCallback} callback
     */
    /**
     * Authorization callback
     * @callback AuthorizationCallback
     * @param {Object} err
     * @param {Outcome} badRequest A FHIR OperationOutcome if it's a bad request
     * @param {PostInteractionHandler} postInteractionHandler A handler provided by the authorizer for the endpoint
     *       These handlers provide role-specific operations that must be applied before concluding the interaction
     * @param {Object} [searchFilters] (only for 'search' interactions) MongoDB filters that must be applied for the role
     * @param {boolean} [searchAllAllowed] (only for 'search' interactions, if there are no searchFilters) Indicates that the authenticated user is authorized to 'search all'
     *      e.g. if they are calling a resource endpoint without any parameters
     *      This only applies if there are no authorizer searchFilters present, since in this case the search, even without parameters,
     *      implicitly implies that the user is not allowed to 'search all'.
     */
    /**
     * Authorize the request for a specific interaction.
     *
     * If a user is not authorized, a bad request outcome will be returned in the callback with a forbidden status (403).
     *
     * All preinteraction handlers specified by an authorizer module will be triggered
     * (see PreInteractionHandler typedef above for details about how to implement these)
     *
     * @param {String} interaction The type of interaction being performed (read, create, update, etc.)
     * @param {RequestContext} ctx The transaction request context (see fhir core)
     * @param {String} resourceType The resource type
     * @param {AuthorizationCallback} callback
     */
    authorize: (interaction, ctx, resourceType, callback) => {
      let authorizer = ctx.authorizer
      let authenticatedUser = ctx.authenticatedUser

      let sendForbidden = () => {
        logger.info(`${authenticatedUser.email} isn't authorized for '${interaction} ${ctx.url}'`)
        callback(null, fhirCommon.buildHTTPOutcome(403, 'information', 'forbidden', 'Forbidden'))
      }

      let done = (interactionType) => {
        logger.info(`[${authenticatedUser.email}] ${interaction} ${ctx.url}`)

        let postInteractionHandler = defaultPostInteractionHandler
        if (interactionType.postInteractionHandlers && (interaction in interactionType.postInteractionHandlers)) {
          postInteractionHandler = interactionType.postInteractionHandlers[interaction]
        }

        if (interaction === 'search') {
          if (interactionType.searchFilters) {
            interactionType.searchFilters(ctx.authenticatedUser, (err, searchFilters) => {
              if (err) {
                return callback(err)
              }
              callback(null, null, postInteractionHandler, searchFilters)
            })
          } else {
            callback(null, null, postInteractionHandler, null, interactionType.searchAllAllowed)
          }
        } else {
          callback(null, null, postInteractionHandler)
        }
      }

      if (!authorizer || !authorizer.allowedResourceTypes) {
        return sendForbidden()
      }

      if (ctx.headers.category && ctx.headers.category.indexOf(fhirCommon.breakTheGlassCategory) > -1) {
        if (authorizer.allowBreakTheGlass) {
          logger.info(`${authenticatedUser.email} is breaking the glass for '${interaction} ${ctx.url}'`)
          authenticatedUser.isBreakingTheGlass = true
        } else {
          logger.warn(`${authenticatedUser.email} used break the glass header for '${interaction} ${ctx.url}'. Header will be ignored.`)
          // treat as normal
        }
      }

      for (let type of authorizer.allowedResourceTypes) {
        if (type.resourceType === resourceType) {
          if (type.interactions === '*' || type.interactions.indexOf(interaction) > -1) {
            if (type.preInteractionHandlers && (interaction in type.preInteractionHandlers)) {
              return chainPreInteractionHandlers(type.preInteractionHandlers[interaction], ctx, (err, badRequest, isAuthorized) => {
                if (err) {
                  return callback(err)
                }

                if (badRequest) {
                  return callback(null, badRequest)
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
