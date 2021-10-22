const eventContext = require('tfg-event-context')
const jaeger = require('jaeger-client')
const opentracing = require('opentracing')

const Span = require('./span')

let instance = null

function factory (opts) {
  if (opts.disable) {
    return null
  }

  let config = {
    serviceName: opts.serviceName,
    sampler: {
      type: 'probabilistic',
      param: opts.probability
    },
    reporter: {
      agentHost: opts.host,
      agentPort: opts.port
    }
  }

  let options = {
    tags: opts.tags,
    traceId128bit: opts.traceId128bit || false
  }

  return jaeger.initTracer(config, options)
}

function startSpan (carrier, operationName, tags) {
  if (instance) {
    let parent = instance.extract(opentracing.FORMAT_HTTP_HEADERS, carrier)
    return new Span(instance, parent, operationName, tags)
  }
  return new Span.Mock()
}

function currentSpan () {
  let ctx = eventContext.getCurrentContext()

  if (ctx) {
    return ctx.getState().span
  }
  return new Span.Mock(instance)
}

function configure (opts) {
  if (instance) {
    instance.close()
  }

  opts = opts || {}
  instance = factory(opts)
}

module.exports = {
  startSpan,
  currentSpan,
  configure
}
