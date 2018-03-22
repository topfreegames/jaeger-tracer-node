const eventContext = require('tfg-event-context')
const opentracing = require('opentracing')

class Span {
  constructor (tracer, parent, operationName, tags) {
    this._tracer = tracer
    this._span = tracer.startSpan(operationName, {
      childOf: parent,
      tags: tags
    })
  }

  startSpan (operationName, tags) {
    return new Span(this._tracer, this._span, operationName, tags)
  }

  propagate (cb) {
    let ctx = eventContext.createContext()
    let state = ctx.getState()

    if (state.span === this) {
      return cb()
    }

    state.span = this
    return ctx.run(cb)
  }

  inject (carrier) {
    this._tracer.inject(this._span, opentracing.FORMAT_HTTP_HEADERS, carrier)
  }

  setOperationName (operationName) {
    this._span.setOperationName(operationName)
  }

  setTag (tag, value) {
    this._span.setTag(tag, value)
  }

  addTags (tags) {
    this._span.addTags(tags)
  }

  finish (err) {
    if (err) {
      this._span.setTag('error', true)
      this._span.log({
        'event': 'error',
        'message': err.message,
        'stack': err.stack,
        'error.kind': err.name
      })
    }
    this._span.finish()
  }

  isValid () {
    return true
  }
}

Span.Mock = class SpanMock {
  constructor (tracer) {
    this._tracer = tracer
  }

  startSpan (operationName, tags) {
    if (this._tracer) {
      return new Span(this._tracer, null, operationName, tags)
    }
    return new Span.Mock()
  }

  propagate (cb) {
    cb()
  }

  inject () {
  }

  setOperationName () {
  }

  setTag () {
  }

  addTags () {
  }

  finish () {
  }

  isValid () {
    return false
  }
}

module.exports = Span
