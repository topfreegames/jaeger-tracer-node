const util = require('../util')
const tracer = require('../core/tracer')

module.exports = function (object) {
  util.wrap(object.prototype, 'sendCommand', original => {
    return function (command, stream) {
      let parent = tracer.currentSpan()
      let span = parent.startSpan('redis ' + command.name, {
        'db.instance': this.options.db,
        'db.statement': command.name + ' ' + command.args.join(' '),
        'db.type': 'redis',
        'span.kind': 'client'
      })

      return original.apply(this, arguments).then(
        value => {
          span.finish()
          return value
        },
        err => {
          span.finish(err)
          throw err
        }
      )
    }
  })
}
