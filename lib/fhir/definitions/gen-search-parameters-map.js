#!/usr/bin/env node

'use strict'

const fs = require('fs')

const fhirSearchParams = {
  dstu2: require('./dstu2/search-parameters.json'),
  stu3: require('./stu3/search-parameters.json')
}

const ifExistsAddToArray = (prop, value) => {
  if (prop) {
    if (Array.isArray(prop)) {
      prop.push(value)
      return prop
    } else {
      const propArr = [prop]
      propArr.push(value)
      return propArr
    }
  } else {
    return value
  }
}

Object.keys(fhirSearchParams).forEach((fhirVersion) => {
  const searchParamMap = {}

  fhirSearchParams[fhirVersion].entry.forEach((searchParam) => {
    if (searchParam.resource.xpath) {
      let pathStr
      pathStr = searchParam.resource.xpath
      pathStr = pathStr.replace(/f:/g, '')
      pathStr = pathStr.replace(/\//g, '.')
      pathStr = pathStr.replace(/\.@(.*?)=/g, '=') // remove "@value=" conditions
      pathStr = pathStr.replace(/@/g, '')

      pathStr.split('|').forEach((path) => {
        path = path.trim()

        if (Array.isArray(searchParam.resource.base)) {
          searchParam.resource.base.forEach((resourceType) => {
            if (!searchParamMap[resourceType]) { searchParamMap[resourceType] = {} }
            if (!path.startsWith(`${resourceType}.`)) { return }

            searchParamMap[resourceType][searchParam.resource.code] = ifExistsAddToArray(searchParamMap[resourceType][searchParam.resource.code], {
              path: path.replace(`${resourceType}.`, ''),
              type: searchParam.resource.type
            })
          })
        } else {
          if (!searchParamMap[searchParam.resource.base]) { searchParamMap[searchParam.resource.base] = {} }
          if (!path.startsWith(`${searchParam.resource.base}.`)) { return }

          searchParamMap[searchParam.resource.base][searchParam.resource.code] = ifExistsAddToArray(searchParamMap[searchParam.resource.base][searchParam.resource.code], {
            path: path.replace(`${searchParam.resource.base}.`, ''),
            type: searchParam.resource.type
          })
        }
      })
    } else {
      console.log(`[${fhirVersion}] Parameter ${searchParam.resource.code} for base(s) ${searchParam.resource.base} has no xpath expression`)
    }
  })
  fs.writeFileSync(`${fhirVersion}/search-parameters-map.json`, JSON.stringify(searchParamMap, null, 2))
})
