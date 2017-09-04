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
const FhirCommon = require('../fhir/common')

const userTypeRestrictions = {}

module.exports = (mongo) => {
  let fhirCommon = FhirCommon(mongo)

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
