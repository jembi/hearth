 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
const logger = require('winston')
const FhirCommon = require('../fhir/common')

const userTypeRestrictions = {}

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

  const isUserManagementRequestValid = (interaction, ctx, authorizer) => {
    switch (interaction) {
      case 'create':
        return true
      case 'read':
      case 'update':
        return ctx.authenticatedUser.email === ctx.url.split('/').pop() || authorizer.allowUserManagement
      case 'search':
        return authorizer.allowUserManagement === true
    }

    return false
  }

  return {
    addUserTypeRestrictions: (userTypeRestrictionsToAdd) => {
      Object.assign(userTypeRestrictions, userTypeRestrictionsToAdd)
    },

    /**
     * Authorization callback
     * @callback AuthorizationCallback
     * @param {Object} err
     * @param {Outcome} badRequest A FHIR OperationOutcome if it's a bad request
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
     * @param {String} interaction The type of interaction being performed (read, create, update, etc.)
     * @param {RequestContext} ctx The transaction request context (see fhir core)
     * @param {String} resourceType The resource type
     * @param {AuthorizationCallback} callback
     */
    authorize: (interaction, ctx, resourceType, callback) => {
      let authorizer = userTypeRestrictions[ctx.authenticatedUser.type]
      let authenticatedUser = ctx.authenticatedUser

      let sendForbidden = () => {
        logger.info(`${authenticatedUser.email} isn't authorized for '${interaction} ${ctx.url}'`)
        callback(null, fhirCommon.buildHTTPOutcome(403, 'information', 'forbidden', 'Forbidden'))
      }

      let done = (interactionType) => {
        logger.info(`[${authenticatedUser.email}] ${interaction} ${ctx.url}`)

        if (interaction === 'search') {
          callback(null, null, interactionType.searchAllAllowed)
        } else {
          callback()
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

      if (resourceType === 'user' && !isUserManagementRequestValid(interaction, ctx, authorizer)) {
        return sendForbidden()
      }

      for (let type of authorizer.allowedResourceTypes) {
        if (type.resourceType === '*' || type.resourceType === resourceType) {
          if (type.interactions === '*' || type.interactions.indexOf(interaction) > -1) {
            return done(type)
          }
        }
      }

      sendForbidden()
    }
  }
}
