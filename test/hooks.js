 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'
process.env.NODE_ENV = 'test'

const tap = require('tap')

const Hooks = require('../lib/fhir/hooks')()

const correctMatchFunc = () => {}
const incorrectMatchFunc = () => {}

tap.test('Hooks module', { autoend: true }, (t) => {
  t.test('.findMatchingPluginHooksFunctions', { autoend: true }, (t) => {
    t.test('should filter by single interaction', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: 'create',
            userType: '*',
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: 'update',
            userType: '*',
            resourceType: '*',
            function: incorrectMatchFunc
          },
          {
            interactions: 'create',
            userType: '*',
            resourceType: '*',
            function: correctMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Patient')

      // then
      t.equals(hooks.length, 2, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })

    t.test('should filter by single userType', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: '*',
            userType: 'test',
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: 'test',
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: 'not-me',
            resourceType: '*',
            function: incorrectMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Patient')

      // then
      t.equals(hooks.length, 2, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })

    t.test('should filter by single resourceType', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: '*',
            userType: '*',
            resourceType: 'Patient',
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: '*',
            resourceType: 'Observation',
            function: incorrectMatchFunc
          },
          {
            interactions: '*',
            userType: '*',
            resourceType: 'Observation',
            function: incorrectMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Patient')

      // then
      t.equals(hooks.length, 1, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })

    t.test('should filter by multiple interaction', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: 'create',
            userType: '*',
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: 'update',
            userType: '*',
            resourceType: '*',
            function: incorrectMatchFunc
          },
          {
            interactions: [ 'create', 'update', 'delete' ],
            userType: '*',
            resourceType: '*',
            function: correctMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Patient')

      // then
      t.equals(hooks.length, 2, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })

    t.test('should filter by multiple userType', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: '*',
            userType: [ 'another', 'test' ],
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: 'test',
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: 'not-me',
            resourceType: '*',
            function: incorrectMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Patient')

      // then
      t.equals(hooks.length, 2, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })

    t.test('should filter by multiple resourceType', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: '*',
            userType: '*',
            resourceType: [ 'Patient', 'Observation' ],
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: '*',
            resourceType: 'Observation',
            function: incorrectMatchFunc
          },
          {
            interactions: '*',
            userType: '*',
            resourceType: 'Observation',
            function: incorrectMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Patient')

      // then
      t.equals(hooks.length, 1, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })

    t.test('should filter on match alls i.e. *', (t) => {
      // given
      Hooks.addHooks({
        before: [
          {
            interactions: '*',
            userType: 'test',
            resourceType: '*',
            function: correctMatchFunc
          },
          {
            interactions: 'create',
            userType: '*',
            resourceType: 'Observation',
            function: correctMatchFunc
          },
          {
            interactions: '*',
            userType: '*',
            resourceType: 'Observation',
            function: correctMatchFunc
          }
        ]
      })

      // when
      const hooks = Hooks.private.findMatchingPluginHooksFunctions('before', 'create', 'test', 'Observation')

      // then
      t.equals(hooks.length, 3, 'should return correct number of hooks')
      hooks.forEach((hook) => {
        t.equals(hook, correctMatchFunc, 'should return correct functions')
      })

      Hooks.clearHooks()
      t.end()
    })
  })
})
