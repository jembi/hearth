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

module.exports = () => {
  return {
    userTypeRestrictions: {
      'sysadmin': {
        allowedResourceTypes: [
          {
            resourceType: '*',
            interactions: '*',
            searchAllAllowed: true
          }
        ],

        // N/A as the sysadmin can anyway access all
        allowBreakTheGlass: false
      }
    },

    hooks: {
      /**
       * Before hook callback
       * @callback BeforeHookCallback
       * @param {Object} err
       * @param {Outcome} badRequest A FHIR OperationOutcome if it's a bad request
       */
      /**
       * Before hook. Provides operations that must be applied under certain conditions before the main effect of the interaction.
       * @typedef {Function} PreInteractionHandler
       * @param {RequestContext} ctx The transaction request context (see fhir core)
       * @param {Object} resource The resource as received from the client for a create or update interaction
       * @param {BeforeHookCallback} callback
       */
      before: [
        {
          resourceType: '*',
          interactions: '*',
          userType: '*',
          function: (interaction, ctx, resourceType, resource, callback) => {
            logger.debug(`Executing before hooks for [${interaction}] on resource ${resourceType}`)
            callback(null, null)
          }
        }
      ],

      /**
       * after hook callback
       * @callback AfterHookCallback
       * @param {Object} err
       * @param {Outcome} badRequest A FHIR OperationOutcome if it's a bad request
       * @param {Object} data Possibly altered input data for the interaction
       */
      /**
       * After hook. Provides operations that must be applied under certain conditions after the main effect of the interaction.
       * @typedef {Function} PostInteractionHandler
       * @param {RequestContext} ctx The transaction request context (see fhir core)
       * @param {Object} data The data that will be returned to the client.
       *       The hook _may_ alter this data for response.
       * @param {AfterHookCallback} callback
       */
      after: [
        {
          resourceType: '*',
          interactions: '*',
          userType: '*',
          function: (interaction, ctx, resourceType, data, callback) => {
            logger.debug(`Executing after hooks for [${interaction}] on resource ${resourceType}`)
            callback(null, null, data)
          }
        }
      ]
    }
  }
}
