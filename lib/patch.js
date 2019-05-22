const eventContext = require('tfg-event-context')
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

  util.wrap(process, 'nextTick', nextTick => {
    return function (callback, ...args) {
      let context = eventContext.getCurrentContext()

      if (context == null) {
        return nextTick.apply(this, arguments)
      }

      function computation() {
        eventContext.setCurrentContext(context)
        try {
          return callback.apply(this, arguments)
        } finally {
          eventContext.revertContext()
        }
      }

      return nextTick.call(this, computation, ...args)
    }
  })

  util.wrap(global, 'setImmediate', setImmediate => {
    return function (callback, ...args) {
      let context = eventContext.getCurrentContext()

      if (context == null) {
        return setImmediate.apply(this, arguments)
      }

      function computation() {
        eventContext.setCurrentContext(context)
        try {
          return callback.apply(this, arguments)
        } finally {
          eventContext.revertContext()
        }
      }

      let id = setImmediate.call(this, computation, ...args)
      let dispose = clearImmediate.bind(null, id)

      context.addDisposable(dispose)
      return id
    }
  })

  patched = true
}
