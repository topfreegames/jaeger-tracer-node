const eventContext = require('tfg-event-context')
const util = require('../util')

module.exports = function (object) {
  let methods = [
    'then', 'done', 'catch',
    'caught', 'error', 'finally',
    'lastly', 'asCallback', 'nodeify'
  ]

  let patch = original => {
    return function (...args) {
      let context = eventContext.getCurrentContext()

      if (context == null) {
        return original.apply(this, arguments)
      }

      args = args.map(arg => {
        if (typeof arg !== 'function') {
          return arg
        }
        return function () {
          eventContext.setCurrentContext(context)
          try {
            return arg.apply(this, arguments)
          } finally {
            eventContext.revertContext()
          }
        }
      })

      return original.apply(this, args)
    }
  }

  methods.forEach(method => {
    util.wrap(object.prototype, method, patch)
  })

  util.wrap(object, 'coroutine', original => {
    return function (generator, options) {
      function * computation () {
        let context = eventContext.getCurrentContext()

        if (context == null) {
          return yield * generator.apply(this, arguments)
        }

        let iterator = generator.apply(this, arguments)

        let result = null
        let param = null
        let error = null

        while (true) {
          eventContext.setCurrentContext(context)
          try {
            if (error) {
              result = iterator.throw(error)
            } else {
              result = iterator.next(param)
            }
          } finally {
            eventContext.revertContext()
          }
          if (result.done) {
            return result.value
          }
          try {
            param = yield result.value
            error = null
          } catch (err) {
            param = null
            error = err
          }
        }
      }

      return original.call(this, computation, options)
    }
  })
}
