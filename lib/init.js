 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const path = require('path')
global.appRoot = path.join(path.resolve(__dirname), '..')

// Load configuration
const config = require('./config')

const logger = require('winston')
logger.remove(logger.transports.Console)
logger.add(logger.transports.Console, {
  colorize: true,
  timestamp: true,
  level: config.getConf('logger:level')
})
