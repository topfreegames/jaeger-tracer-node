const util = require('../util')
const tracer = require('../core/tracer')
const url = require('url')

module.exports = function (object) {
  util.wrap(object, 'request', original => {
    return function (options, cb) {
      let parent = tracer.currentSpan()
      let span = parent.startSpan()

      options.headers = options.headers || {}
      span.inject(options.headers)

      let request = original.call(this, options, function (response) {
        span.setTag('http.status_code', response.statusCode)

        response.on('end', () => {
          span.finish()
        })

        if (cb) {
          return cb.apply(this, arguments)
        }
      })

      request.on('error', err => {
        span.finish(err)
      })

      let host = request.getHeader('host')
      let parsedURL = url.parse(request.path)

      span.setOperationName(`HTTP ${request.method} ${host}`)
      span.addTags({
        'http.host': host,
        'http.method': request.method,
        'http.pathname': parsedURL.pathname,
        'span.kind': 'client'
      })

      if (parsedURL.query) {
        span.setTag('http.query', parsedURL.query)
      }

      return request
    }
  })

  util.wrap(object, 'createServer', original => {
    return function (requestListener) {
      let wrapped = function (request, response) {
        let parsedURL = url.parse(request.url)
        let span = tracer.startSpan(request.headers, 'HTTP ' + request.method, {
          'http.host': request.headers.host,
          'http.method': request.method,
          'http.pathname': parsedURL.pathname,
          'span.kind': 'server'
        })

        if (parsedURL.query) {
          span.setTag('http.query', parsedURL.query)
        }

        response.on('finish', () => {
          span.setTag('http.status_code', response.statusCode)
          span.finish()
        })

        return span.propagate(() =>
          requestListener.call(this, request, response)
        )
      }
      return original.call(this, wrapped)
    }
  })
}
