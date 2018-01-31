 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const logger = require('winston')
const Fhir = require('fhir');

module.exports = () => {
  var fhir = new Fhir(Fhir.STU3);

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
          interactions: [ 'create', 'update' ],
          userType: '*',
          function: (interaction, ctx, resourceType, resource, callback) => {
            if ( ctx.headers['content-type'] && ( ctx.headers['content-type'].substring(0,20) === 'application/fhir+xml' 
                    || ctx.headers['content-type'].substring(0,20) === 'application/xml+fhir' 
                    || ctx.headers['content-type'].substring(0,15) === 'application/xml' ) ) {
              // Clean out a BOM that might cause an error with SAX.
              // https://www.screenaware.com/en/blog/xml2js-sax-js-non-whitespace-before-first-tag
              // Sometimes getting a whitespace error, but it doesn't seem to cause any problems
              // and this didn't fix it.
              //var cleaned = resource.replace("\ufeff", "");
              //var cleaned = resource.toString('utf8').replace("\ufeff", "");
              fhir.XmlToObject(resource).then( function( result ) { 
                callback(null, null, result);
              }).catch( function(err) {
                callback(err);
              });
            } else {
              callback(null, null);
            }
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
          /*
      after: [
        {
          resourceType: '*',
          interactions: [ 'read', 'vread', 'search' ],
          userType: '*',
          function: (interaction, req, ctx, resourceType, data, callback) => {
            logger.debug(`Executing convert after hooks for [${interaction}] on resource ${resourceType}`)
            if ( !req.accpets('json') && req.accepts('xml') || (ctx.query._format && 
                        (ctx.query._format === 'application/xml+fhir' ||
                        ctx.query._format === 'application/xml' ) ) ) {
              var result = fhir.ObjectToXml(data);
              callback(null, null, result)
            } else {
              callback(null, null, data)
            }
          }
        }
      ]
      */
    }
  }
}
