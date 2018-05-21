const util = require('../util')
const tracer = require('../core/tracer')

module.exports = function (object) {
  util.wrap(object.RedisClient.prototype, 'internal_send_command', original => {
    return function (command) {
      let parent = tracer.currentSpan()
      let span = parent.startSpan('redis ' + command.command, {
        'db.instance': this.options.db,
        'db.statement': command.command + ' ' + command.args.join(' '),
        'db.type': 'redis',
        'span.kind': 'client'
      })

      if (command.callback) {
        const callback = command.callback
        command.callback = function (err, value) {
          span.finish(err)
          return callback.apply(this, arguments)
        }
        return original.apply(this, arguments)
      }

      try {
        var result = original.apply(this, arguments)
      } catch (err) {
        span.finish(err)
        throw err
      }

      span.finish()
      return result
    }
  })
}
