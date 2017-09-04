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
const _ = require('lodash')

module.exports = (mongo) => {
  return {
    preInteractionHandlers: {
      paramEmailMustBeUserEmail: (req, authenticatedUser, callback) => {
        callback(null, authenticatedUser.email === req.params.email)
      },

      userBodyMustBeSelf: (req, authenticatedUser, callback) => {
        // must be self, may not alter resource or email
        callback(null, authenticatedUser.email === req.params.email && !req.body.resource && !req.body.email)
      },

      // when searching, a "traceable" parameter must be used.
      // This is a parameter that can be used to link queried resources to a practitioner
      // or at a minimum to an organization (which is linkable to practitioners)
      mustUsePractitionerLinkableSearchParam: (req, authenticatedUser, callback) => {
        const traceableParams = ['patient', 'practitioner', 'practitioner.organization', 'encounter']
        callback(null, _.intersection(_.keys(req.query), traceableParams).length > 0)
      }
    },

    searchFilters: {
      filterIdByUserResource: (authenticatedUser, callback) => {
        const id = authenticatedUser.resource.split('/')[1]
        callback(null, { id: id })
      }
    }
  }
}
