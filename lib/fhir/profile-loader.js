/**
* Copyright (c) 2017-present, Jembi Health Systems NPC.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict'

const fs = require('fs')
const path = require('path')

const profiles = {}

module.exports = () => {
  return {
    loadProfiles: (paths) => {
      paths.forEach((profilePath) => {
        if (!profilePath.startsWith('/')) {
          profilePath = `${global.appRoot}/${profilePath}`
        }
        fs.readdirSync(path.resolve(profilePath)).filter((file) => file.endsWith('.json')).forEach((file) => {
          const profile = require(`${profilePath}/${file}`)
          profiles[profile.type] = profile
        })
      })
    },

    getProfiles: () => {
      return profiles
    }
  }
}
