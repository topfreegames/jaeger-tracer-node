const patch = require('./lib/patch')
const tracer = require('./lib/core/tracer')
const util = require('util')
const promises = require('./lib/helpers/promises')

patch()

module.exports = {
  configure: tracer.configure,
  currentSpan: tracer.currentSpan,
  startSpan: tracer.startSpan,
  wrapPromise: promises.wrapPromise,

  /**
    * @deprecated since version 1.1.0
    */
  patch: util.deprecate(patch, 'patch() is deprecated. All patches are now applied on import.')
}
