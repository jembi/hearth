 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
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
