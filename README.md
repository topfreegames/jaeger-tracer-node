# Jaeger Tracer for NodeJS
[![js-standard-style](https://cdn.rawgit.com/standard/standard/master/badge.svg)](http://standardjs.com)

## Basic Usage
This module automaticaly does most of the work by patching external libraries, such as _http_, _ioredis_, _mongodb_, and _sequelize_. The only thing that has to be done is call the `patch` method at the start of the code and configure the tracer.

```javascript
const jaeger = require('jaeger-tracer-node')

jaeger.patch()

// Other imports

jaeger.configure({
  disable: false,
  probability: 0.001,
  serviceName: 'my-service',
  tags: {
    'my-tag': 'my-value'
  }
})

// Main loop
```

## Advanced Usage
In case there is need for manually creating spans, two aproaches exist for referencing the parent.

Notice that the spans need to be propagated in order for the patched libraries to know which is the current span.
Also, if your custom code sends requests to other servers, the span can be injected into a carrier for transmission.

### Using a span carrier
This carrier can be something similar to an HTTP header or `null`.

```javascript
let span = jaeger.startSpan(carrier, 'my-span', {
  'my-tag': 'my-value'
})

span.propagate(() => {
  mySynchronousFunction(request)
})
span.finish()
```

### Using the current span
The current span will never be `null`, so no check is needed. However, if it is not set, the new span will lack a parent.

```javascript
let parent = jaeger.currentSpan()
let span = parent.startSpan('my-span')

span.inject(myCarrier)

myFunctionWithCallback(myCarrier, err => {
  span.finish(err)
})
```
