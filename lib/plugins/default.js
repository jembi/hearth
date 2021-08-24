 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

module.exports = (_mongo, _fhirResources, logger) => {
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
        allowBreakTheGlass: false,
        allowUserManagement: true
      },
      'service': {
        allowedResourceTypes: [
          {
            resourceType: '*',
            interactions: '*',
            searchAllAllowed: true
          }
        ],
        allowBreakTheGlass: false,
        allowUserManagement: true
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
