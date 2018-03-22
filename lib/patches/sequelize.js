const util = require('../util')
const tracer = require('../core/tracer')

module.exports = function (object) {
  util.wrap(object.Sequelize.prototype, 'query', original => {
    return function (sql, options) {
      var parent = tracer.currentSpan()
      var span = parent.startSpan('SQL ' + options.type, {
        'db.instance': this.config.database,
        'db.statement': sql,
        'db.type': 'sql',
        'db.user': this.config.username,
        'span.kind': 'client'
      })

      return original.apply(this, arguments).then(
        result => {
          span.finish()
          return result
        },
        err => {
          span.finish(err)
          throw err
        }
      )
    }
  })
}
