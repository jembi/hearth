'use strict'

const path = require('path')
const stdio = require('stdio')
const nconf = require('nconf')

let ops = null
nconf.env()

if (nconf.get('NODE_ENV') !== 'test') {
  ops = stdio.getopt({
    conf: {
      key: 'c',
      args: 1,
      description: 'The backend configuration to use. See config/default.json for an example.'
    }
  })
}

if (ops && ops.conf) {
  nconf.file(ops.conf)
} else {
  const environment = nconf.get('NODE_ENV') || 'development'
  nconf.file('environment', path.resolve(`${global.appRoot}/config`, environment + '.json'))
  nconf.file('default', path.resolve(`${global.appRoot}/config`, 'default.json'))
}

function getConf (key) {
  return nconf.get(key)
}

function setConf (key, value) {
  nconf.set(key, value)
}

exports.getConf = getConf
exports.setConf = setConf
