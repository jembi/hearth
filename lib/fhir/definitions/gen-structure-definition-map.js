#!/usr/bin/env node

'use strict'

const fs = require('fs')

const profiles = {
  dstu2: {
    resources: require('./dstu2/profiles-resources'),
    types: require('./dstu2/profiles-types')
  },
  stu3: {
    resources: require('./stu3/profiles-resources'),
    types: require('./stu3/profiles-types')
  }
}

Object.keys(profiles).forEach((fhirVersion) => {
  const structureDefMap = {}

  Object.keys(profiles[fhirVersion]).forEach((profileType) => {
    profiles[fhirVersion][profileType].entry
      .filter((entry) => entry.resource.resourceType === 'StructureDefinition')
      .map((entry) => entry.resource)
      .forEach((def) => {
        structureDefMap[def.id] = {
          kind: def.kind,
          elements: {}
        }

        def.snapshot.element.forEach((element) => {
          if (def.id === element.path) {
            return
          }
          const path = element.path.replace(`${def.id}.`, '')
          structureDefMap[def.id].elements[path] = {
            min: element.min,
            max: element.max,
            types: element.type ? Array.from(new Set(element.type.map((type) => type.code))) : []
          }
        })
      })
  })

  fs.writeFileSync(`${fhirVersion}/structure-definition-map.json`, JSON.stringify(structureDefMap, null, 2))
})
