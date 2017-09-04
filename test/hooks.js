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
