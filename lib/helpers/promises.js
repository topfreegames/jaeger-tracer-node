const tracer = require('../core/tracer')

// If you don't use the promise wrapper, all spans below it will be below to
// the parent span. If you use it, a new span will be created and all spans
// inside it will be below it.
function wrapPromise (fn, name) {
  return (...args) => {
    let parent = tracer.currentSpan()
    let span = parent.startSpan(name, {})
    const promise = span.propagate(() => fn(...args))

    if (!promise.then) {
      throw new Error('Expected function to return a Promise!')
    }
    const resolve = (ret) => {
      span.finish()
      return ret
    }
    const reject = (ret) => {
      span.finish(ret)
      throw ret
    }
    return promise.then(resolve, reject)
  }
}

module.exports = {
  wrapPromise
}
