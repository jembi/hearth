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
