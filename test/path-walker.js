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
