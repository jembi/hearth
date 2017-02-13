'use strict'

const path = require('path')
const stdio = require('stdio')
const nconf = require('nconf')

let ops = null

if (process.env.NODE_ENV !== 'test') {
  ops = stdio.getopt({
    conf: {
      key: 'c',
      args: 1,
      description: 'The backend configuration to use. See config/default.json for an example.'
    }
  })
}

let confFile = null

let load = () => {
  let environment = nconf.get('NODE:ENV') || 'development'
  if (ops && ops.conf) {
    confFile = path.resolve(`${global.appRoot}/config`, ops.conf)
  } else if (environment) {
    confFile = path.resolve(`${global.appRoot}/config`, environment + '.json')
  } else {
    confFile = path.resolve(`${global.appRoot}/config`, 'default.json')
  }
  nconf.env()
  nconf.file(confFile)
}

let getConf = function (key) {
  return nconf.get(key)
}

exports.getConfName = () => confFile
exports.getConf = getConf
exports.load = load
