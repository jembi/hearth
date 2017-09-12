 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

function walkPath (pathArr, object) {
  const path = pathArr[0]
  const newPathArr = pathArr.slice(1)

  if (!object[path]) {
    return []
  }
  if (pathArr.length === 1) {
    return object[path]
  }

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
  const result = walkPath(pathArr, object)
  if (!result) {
    return []
  }
  if (!Array.isArray(result)) {
    return [result]
  }
  return result
}
