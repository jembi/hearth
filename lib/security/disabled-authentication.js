 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

module.exports = () => {
  return {
    authenticate: (req, res, next) => {
      res.locals.authenticatedUser = {
        email: 'sysadmin@jembi.org',
        type: 'sysadmin'
      }
      next()
    }
  }
}
