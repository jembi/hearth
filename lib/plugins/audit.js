'use strict'

const logger = require('winston')
const moment = require('moment')

const EVENT_OUTCOME = {
  SUCCESS: 0,
  MINOR_FAILURE: 4,
  SERIOUS_FAILURE: 8,
  MAJOR_FAILURE: 12
}

module.exports = () => {
  const getSuccessOrFailed = (data) => {
    if (data && data.resourceType === 'OperationOutcome' && data.issue) {
      return EVENT_OUTCOME.MINOR_FAILURE
    }
    return EVENT_OUTCOME.SUCCESS
  }

  const buildEventObj = (interaction, data) => {
    return {
      type: {
        coding: [
          {
            system: 'http://hl7.org/fhir/audit-event-type',
            code: 'rest',
            display: 'Restful Operation'
          }
        ]
      },
      subtype: [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/restful-interaction',
              code: interaction,
              display: interaction
            }
          ]
        }
      ],
      dateTime: moment.utc().format(),
      outcome: getSuccessOrFailed(data)
    }
  }

  const buildParticipantObj = (ctx) => {
    return {
      role: ctx.authenticatedUser.type,
      reference: ctx.authenticatedUser.resource,
      userId: ctx.authenticatedUser.resource ? ctx.authenticatedUser.resource.split('/')[1] : '',
      altId: ctx.authenticatedUser.email,
      requester: true
    }
  }

  const buildSourceObj = (ctx) => {
    return {
      site: 'Cloud',
      identifier: ctx.headers.referer,
      type: [
        {
          system: 'http://hl7.org/fhir/security-source-type',
          code: 3,
          display: 'Web Server'
        }
      ]
    }
  }

  const buildObjectObj = (ctx) => {
    return {
      query: ctx.query,
      reference: {
        reference: ctx.url.split('?')[0]
      }
    }
  }

  const buildAuditEvent = (interaction, ctx, data) => { // eslint-disable-line
    return {
      event: buildEventObj(interaction, data),
      participant: buildParticipantObj(ctx),
      source: buildSourceObj(ctx),
      object: buildObjectObj(ctx)
    }
  }

  return {
    userTypeRestrictions: {
      'patient': {
        allowedResourceTypes: [
          {
            resourceType: '*',
            interactions: '*',
            searchAllAllowed: true
          }
        ],

        allowBreakTheGlass: false
      },
      'guardian': {
        allowedResourceTypes: [
          {
            resourceType: '*',
            interactions: '*',
            searchAllAllowed: true
          }
        ],

        allowBreakTheGlass: false
      },
      'practitioner': {
        allowedResourceTypes: [
          {
            resourceType: '*',
            interactions: '*',
            searchAllAllowed: true
          }
        ],

        allowBreakTheGlass: false
      },
      'admin': {
        allowedResourceTypes: [
          {
            resourceType: '*',
            interactions: '*',
            searchAllAllowed: true
          }
        ],

        allowBreakTheGlass: false
      }
    },

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
            /* eslint-disable no-unused-vars */
            const auditEvent = buildAuditEvent(interaction, ctx, data)

            // TODO send auditEvent object to auditing service to be saved

            logger.debug(`Executing after hooks for [${interaction}] on resource ${resourceType}`)
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
    buildObjectObj: buildObjectObj
  }
}
