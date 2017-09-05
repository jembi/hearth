 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const tap = require('tap')

const walk = require('../lib/path-walker')

tap.test('should walk the path and return an array of all values', (t) => {
  const result = walk('name.given', {
    name: [
      {
        family: [ 'Family1' ],
        given: [ 'Given1', 'Given2' ]
      },
      {
        family: [ 'Family2' ],
        given: [ 'Given3' ]
      }
    ]
  })

  t.equals(result[0], 'Given1')
  t.equals(result[1], 'Given2')
  t.equals(result[2], 'Given3')
  t.equals(result.length, 3)
  t.end()
})

tap.test('should walk the path and return an array of all values', (t) => {
  const result = walk('name.family', {
    name: [
      {
        family: [ 'Family1' ],
        given: [ 'Given1', 'Given2' ]
      },
      {
        family: [ 'Family2' ],
        given: [ 'Given3' ]
      }
    ]
  })

  t.equals(result[0], 'Family1')
  t.equals(result[1], 'Family2')
  t.equals(result.length, 2)
  t.end()
})

tap.test('should walk the path over multiple levels', (t) => {
  const result = walk('x.y.z', {
    x: [
      {
        y: {
          z: 'z1'
        }
      },
      {
        y: {
          z: [ 'z2', 'z3' ]
        }
      }
    ]
  })

  t.equals(result[0], 'z1')
  t.equals(result[1], 'z2')
  t.equals(result[2], 'z3')
  t.equals(result.length, 3)
  t.end()
})
