const util = require('../util')
const tracer = require('../core/tracer')

module.exports = function (object) {
  util.wrap(object.prototype, 'routes', original => {
    return function () {
      let dispatch = original.apply(this, arguments)

      return (ctx, next) => {
        let result = dispatch(ctx, next)
        let span = tracer.currentSpan()

        span.setOperationName(`HTTP ${ctx.request.method} ${ctx._matchedRoute}`)
        return result
      }
    }
  })
}
