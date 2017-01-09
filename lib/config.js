'use strict'

const fs = require('fs')
const path = require('path')
const stdio = require('stdio')

let conf = {}
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
  if (ops && ops.conf) {
    confFile = ops.conf
  } else if (process.env.NODE_ENV === 'development') {
    confFile = path.resolve(`${global.appRoot}/config`, 'development.json')
  } else if (process.env.NODE_ENV === 'test') {
    confFile = path.resolve(`${global.appRoot}/config`, 'test.json')
  } else {
    confFile = path.resolve(`${global.appRoot}/config`, 'default.json')
  }

  conf = JSON.parse(fs.readFileSync(confFile))
}

exports.getConf = () => conf
exports.getConfName = () => confFile
exports.load = load
