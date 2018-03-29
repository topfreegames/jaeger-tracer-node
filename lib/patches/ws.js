const util = require('../util')
const tracer = require('../core/tracer')

module.exports = function (object) {
  function patch (object, events) {
    util.wrap(object, 'emit', original => {
      return function (eventName, ...args) {
        let handler = events[eventName]

        if (handler) {
          let span = tracer.startSpan(null, 'WebSocket ' + eventName, {
            'span.kind': 'server'
          })

          handler.call(this, span, ...args)

          try {
            var result = span.propagate(() =>
              original.apply(this, arguments)
            )
          } catch (err) {
            span.finish(err)
            throw err
          }

          span.finish()
          return result
        }

        return original.apply(this, arguments)
      }
    })
  }

  patch(object.prototype, {
    message: function (span, data, flags) {
      let request = this.upgradeReq

      span.addTags({
        'websocket.key': request.headers['sec-websocket-key'],
        'websocket.data': data
      })
    }
  })

  patch(object.Server.prototype, {
    connection: function (span, client) {
      let request = client.upgradeReq

      span.addTags({
        'websocket.key': request.headers['sec-websocket-key'],
        'websocket.host': request.headers['host'],
        'websocket.url': request.url
      })
    }
  })
}
