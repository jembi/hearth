'use strict'

function walkPath (pathArr, object) {
  console.log('Walking - ' + pathArr + ' ' + JSON.stringify(object))
  if (pathArr.length === 1) {
    return object[pathArr[0]]
  }

  const path = pathArr[0]
  const newPathArr = pathArr.slice(1)
  if (Array.isArray(object[path])) {
    let values = []
    object[path].forEach((element) => {
      const result = walkPath(newPathArr, element)
      values = values.concat(result)
    })
    return values
  } else {
    return walkPath(newPathArr, object[path])
  }
}

module.exports = function (path, object) {
  const pathArr = path.split('.')
  return walkPath(pathArr, object)
}
