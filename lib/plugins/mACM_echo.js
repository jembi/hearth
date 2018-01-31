 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const logger = require('winston')
const moment = require('moment')

const EVENT_OUTCOME = {
  SUCCESS: '0',
  MINOR_FAILURE: '4',
  SERIOUS_FAILURE: '8',
  MAJOR_FAILURE: '12'
}

const excludedResourceTypeInteractions = [
  {
    type: 'AuditEvent',
    interactions: '*'
  },
  {
    type: 'user',
    interactions: 'authenticate' // AuditEvent expects an authenticated request which will fail here - Audit wont be logged
  }
]

module.exports = (mongo, fhirResources) => {
  const fhirCore = require('../fhir/core.js')(mongo, fhirResources)

  const buildCommunication = (interaction, ctx, data) => {
    const toCopy = [ 'category', 'subject', 'context', 'payload', 'recipient' ]
    let comm = {
      resourceType: 'Communication',
      basedOn: { reference: 'CommunicationRequest/'+data['id'] },
      status: 'completed',
      reasonCode: data['reasonCode']
    }
    for( const i in toCopy ) {
      if ( data[toCopy[i]] ) {
        comm[toCopy[i]] = data[toCopy[i]];
      }
    }
    return comm
  }

  const createCommunication = (interaction, ctx, resourceType, communicationResource) => {
    fhirCore.create(ctx, 'Communication', communicationResource, null, (err, result) => {
      if (err) {
        return logger.debug(`create Communication error: ${err}`)
      }

      logger.debug(`Communication created for [${interaction}] on resource ${resourceType}`)
    })
  }

  const updateRequest = (interaction, ctx, resourceType, requestResource) => {
    fhirCore.update(ctx, 'CommunicationRequest', requestResource['id'], requestResource, (err, result) => {
      if (err) {
        return logger.debug(`update CommunicationRequest error: ${err}`)
      }

      logger.debug(`CommunicationRequest updated for [${interaction}] on resource ${resourceType}`)
    })
  }


  return {
    hooks: {
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
          resourceType: 'CommunicationRequest',
          interactions: [ 'create' ],
          userType: '*',
          function: (interaction, ctx, resourceType, data, callback) => {

            const entryCtx = JSON.parse(JSON.stringify(ctx))
            const communicationResource = buildCommunication(interaction, entryCtx, data)

            entryCtx.url = '/fhir/Communication'
            entryCtx.query = {}

            createCommunication(interaction, entryCtx, resourceType, communicationResource)

            data['status'] = 'completed';
            entryCtx.url = '/fhir/CommunicationRequest'
            updateRequest('update', entryCtx, resourceType, data);

            callback(null, null, data)
          }
        }
      ]
    },

    // exported functions
    buildCommunication: buildCommunication
  }
}
