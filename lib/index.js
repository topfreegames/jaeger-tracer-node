const patch = require('./patch')
const tracer = require('./core/tracer')

module.exports = {
  configure: tracer.configure,
  currentSpan: tracer.currentSpan,
  startSpan: tracer.startSpan,
  patch: patch
}
