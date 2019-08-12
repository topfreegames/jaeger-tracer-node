const patches = require('./patches')
const util = require('./util')

const Module = require('module')

let patched = false

module.exports = function () {
  if (patched) {
    return
  }

  util.wrap(Module, '_load', original => {
    return function (file) {
      let object = original.apply(this, arguments)
      let patch = patches[file]

      if (object && object.__patched) {
        return object
      }

      if (patch) {
        patch(object)
        object.__patched = true
      }

      return object
    }
  })

  patched = true
}
