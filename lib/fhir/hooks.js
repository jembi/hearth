 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const hooks = {
  before: [],
  after: []
}

module.exports = () => {
  // determine if hooks is a function or array
  // if function, execute immediately, if array execute each hook sequentially
  const chainAndExecuteHookFunctions = (hooks, ...args) => {
    const done = args.pop()
    if (typeof hooks === 'function') {
      // single handler
      hooks(...args, done)
    } else if (Array.isArray(hooks) && hooks.length > 0) {
      // execute each handler in turn, and end on err
      let next = (i) => (err, badRequest, data) => {
        if (err || badRequest || (i + 1 >= hooks.length)) {
          return done(err, badRequest, data)
        }
        hooks[i + 1](...args, next(i + 1))
      }
      hooks[0](...args, next(0))
    } else {
      done()
    }
  }

  const findMatchingPluginHooksFunctions = (hookType, interaction, userType, resourceType) => {
    return hooks[hookType].filter((hook) => {
      return (hook.interactions === '*' || hook.interactions === interaction || (Array.isArray(hook.interactions) && hook.interactions.includes(interaction))) &&
        (hook.userType === '*' || hook.userType === userType || (Array.isArray(hook.userType) && hook.userType.includes(userType))) &&
        (hook.resourceType === '*' || hook.resourceType === resourceType || (Array.isArray(hook.resourceType) && hook.resourceType.includes(resourceType)))
    }).map((hook) => {
      return hook.function
    })
  }

  const executeMatchingHookFunctions = (hookType, interaction, ctx, resourceType, data, callback) => {
    const hooks = findMatchingPluginHooksFunctions(hookType, interaction, ctx.authenticatedUser.type, resourceType)
    chainAndExecuteHookFunctions(hooks, interaction, ctx, resourceType, data, callback)
  }

  const exposedPrivateFuncsForTesting = {}
  if (process.env.NODE_ENV === 'test') {
    exposedPrivateFuncsForTesting.findMatchingPluginHooksFunctions = findMatchingPluginHooksFunctions
  }

  return {
    private: exposedPrivateFuncsForTesting,

    addHooks: (hooksToAdd) => {
      if (hooksToAdd.before) {
        hooks.before.push(...hooksToAdd.before)
      }
      if (hooksToAdd.after) {
        hooks.after.push(...hooksToAdd.after)
      }
    },

    clearHooks: () => {
      hooks.before = []
      hooks.after = []
    },

    executeBeforeHooks: (interaction, fhirModule, ctx, resourceType, resource, callback) => {
      if (typeof resource === 'function') {
        callback = resource
        resource = null
      }

      // execute default module hook
      if (fhirModule && fhirModule.before && fhirModule.before[interaction]) {
        fhirModule.before[interaction](ctx, resource, (err, badRequest) => {
          if (err || badRequest) {
            return callback(err, badRequest)
          }

          executeMatchingHookFunctions('before', interaction, ctx, resourceType, resource, callback)
        })
      } else {
        executeMatchingHookFunctions('before', interaction, ctx, resourceType, resource, callback)
      }
    },

    executeAfterHooks: (interaction, fhirModule, ctx, resourceType, results, callback) => {
      if (typeof results === 'function') {
        callback = results
        results = null
      }

      // execute default module hook
      if (fhirModule && fhirModule.after && fhirModule.after[interaction]) {
        fhirModule.after[interaction](ctx, results, (err, badRequest, results) => {
          if (err || badRequest) {
            return callback(err, badRequest)
          }

          executeMatchingHookFunctions('after', interaction, ctx, resourceType, results, callback)
        })
      } else {
        executeMatchingHookFunctions('after', interaction, ctx, resourceType, results, callback)
      }
    }
  }
}
