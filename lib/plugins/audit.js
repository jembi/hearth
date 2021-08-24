 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

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

module.exports = (mongo, fhirResources, logger) => {
  const fhirCore = require('../fhir/core.js')(mongo, fhirResources)

  const getSuccessOrFailed = (data) => {
    if (data && data.resourceType === 'OperationOutcome' && data.issue) {
      return EVENT_OUTCOME.MINOR_FAILURE
    }
    return EVENT_OUTCOME.SUCCESS
  }

  const buildEventObj = (interaction, data) => {
    return {
      type: {
        system: 'http://hl7.org/fhir/audit-event-type',
        code: 'rest',
        display: 'Restful Operation'
      },
      subtype: [
        {
          system: 'http://hl7.org/fhir/restful-interaction',
          code: interaction,
          display: interaction
        }
      ],
      dateTime: moment.utc().format(),
      outcome: getSuccessOrFailed(data)
    }
  }

  const buildParticipantObj = (ctx) => {
    return {
      role: [
        {
          coding: [
            {
              system: 'hearth:user-roles',
              code: ctx.authenticatedUser.type
            }
          ]
        }
      ],
      reference: { reference: ctx.authenticatedUser.resource },
      userId: {
        system: 'hearth:resource-reference',
        value: ctx.authenticatedUser.resource ? ctx.authenticatedUser.resource.split('/')[1] : ''
      },
      altId: ctx.authenticatedUser.email,
      requester: true
    }
  }

  const buildSourceObj = (ctx) => {
    return {
      site: 'Cloud',
      identifier: {
        value: ctx.headers.referer
      },
      type: [
        {
          system: 'http://hl7.org/fhir/security-source-type',
          code: 3,
          display: 'Web Server'
        }
      ]
    }
  }

  const buildObjectObj = (ctx, reference) => {
    return {
      query: ctx.url, // use the querystring for easy query of parameters
      reference: {
        reference: reference
      }
    }
  }

  const buildObjectArray = (ctx, data) => {
    if (!data) {
      return
    }

    const objectArray = []

    // loop through bundle entries to get resource ids
    if (data.resourceType === 'Bundle') {
      data.entry.forEach((entry) => {
        objectArray.push(buildObjectObj(ctx, `${entry.resource.resourceType}/${entry.resource.id}`))
      })
    } else {
      objectArray.push(buildObjectObj(ctx, `${data.resourceType}/${data.id}`))
    }

    return objectArray
  }

  const buildAuditEvent = (interaction, ctx, data) => {
    return {
      resourceType: 'AuditEvent',
      event: buildEventObj(interaction, data),
      participant: [ buildParticipantObj(ctx) ],
      source: buildSourceObj(ctx),
      object: buildObjectArray(ctx, data)
    }
  }

  const createAuditEvent = (interaction, ctx, resourceType, auditEventResource) => {
    fhirCore.create(ctx, 'AuditEvent', auditEventResource, null, (err, result) => {
      if (err) {
        return logger.debug(`create AuditEvent error: ${err}`)
      }

      logger.debug(`AuditEvent created for [${interaction}] on resource ${resourceType}`)
    })
  }

  const isAuditExcluded = (interaction, resourceType) => {
    const excludedResourceMatch = excludedResourceTypeInteractions.find((obj) => {
      return obj.type === resourceType
    })

    if (excludedResourceMatch && (excludedResourceMatch.interactions === '*' || excludedResourceMatch.interactions.includes(interaction))) {
      return true
    }

    return false
  }

  return {
    hooks: {
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
            const auditExcluded = isAuditExcluded(interaction, resourceType)
            if (auditExcluded) {
              return callback(null, null, data)
            }

            const entryCtx = JSON.parse(JSON.stringify(ctx))
            const auditEventResource = buildAuditEvent(interaction, entryCtx, data)

            entryCtx.url = '/fhir/AuditEvent'
            entryCtx.query = {}

            createAuditEvent(interaction, entryCtx, resourceType, auditEventResource)

            callback(null, null, data)
          }
        }
      ]
    },

    // exported functions
    getSuccessOrFailed: getSuccessOrFailed,
    buildAuditEvent: buildAuditEvent,
    buildEventObj: buildEventObj,
    buildParticipantObj: buildParticipantObj,
    buildSourceObj: buildSourceObj,
    buildObjectObj: buildObjectObj,
    buildObjectArray: buildObjectArray
  }
}
