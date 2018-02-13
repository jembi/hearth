#!/usr/bin/env node

'use strict'

const fs = require('fs')

const fhirSearchParams = {
  dstu2: require('./dstu2/search-parameters.json'),
  stu3: require('./stu3/search-parameters.json')
}

Object.keys(fhirSearchParams).forEach((fhirVersion) => {
  const searchParamMap = {}

  fhirSearchParams[fhirVersion].entry.forEach((searchParam) => {
    let path
    if (searchParam.resource.xpath) {
      path = searchParam.resource.xpath
      path = path.replace(/f:/g, '')
      path = path.replace(/\//g, '.')
      path = path.replace(/@/g, '')
    }
    const paramDetails = {
      param: searchParam.resource.code,
      path: path,
      type: searchParam.resource.type
    }
    if (Array.isArray(searchParam.resource.base)) {
      searchParam.resource.base.forEach((resourceType) => {
        if (!searchParamMap[resourceType]) { searchParamMap[resourceType] = [] }
        searchParamMap[resourceType].push(paramDetails)
      })
    } else {
      if (!searchParamMap[searchParam.resource.base]) { searchParamMap[searchParam.resource.base] = [] }
      searchParamMap[searchParam.resource.base].push(paramDetails)
    }
  })

  fs.writeFileSync(`${fhirVersion}/search-parameters-map.json`, JSON.stringify(searchParamMap, null, 2))
})
