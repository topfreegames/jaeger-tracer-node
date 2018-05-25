const util = require('../util')
const tracer = require('../core/tracer')

module.exports = function (object) {
  util.wrap(object.prototype, 'routes', original => {
    return function () {
      let dispatch = original.apply(this, arguments)
      if (dispatch.constructor.name === 'GeneratorFunction') {
        return function* () {
          const result = yield* dispatch.apply(this, arguments)
          let span = tracer.currentSpan()
          span.setOperationName(`HTTP ${this.request.method} ${this._matchedRoute}`)
          return result
        }
      }

      return (ctx, next) => {
        let result = dispatch(ctx, next)
        let span = tracer.currentSpan()

        span.setOperationName(`HTTP ${ctx.request.method} ${ctx._matchedRoute}`)
        return result
      }
    }
  })
}
