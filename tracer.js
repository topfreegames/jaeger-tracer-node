var eventContext = require('tfg-event-context');
var jaeger = require('jaeger-client');
var Span = require('./span');

var factory = function(opts) {
  if(opts.disable) {
    return null;
  }

  var config = {
    serviceName: opts.serviceName,
    sampler: {
      type: 'probabilistic',
      param: opts.probability
    },
    reporter: {
      agentHost: opts.host,
      agentPort: opts.port
    }
  };

  var options = {
    tags: {
      'game.name': opts.game
    }
  };

  Object.assign(options.tags, opts.tags);
  return jaeger.initTracer(config, options);
};

module.exports.patch = function() {
  require('./patcher');
}

module.exports.currentSpan = function() {
  var ctx = eventContext.getCurrentContext();
  return ctx? ctx.getState().span : Span.mock(instance);
};

module.exports.startSpan = function(carrier, operationName, tags) {
  if(instance) {
    var parent = instance.extract('text_map', carrier);
    return new Span(instance, parent, operationName, tags);
  }
  return Span.mock()
};

module.exports.configure = function(opts) {
  try {
    instance.close();
  } catch(err) {}

  opts = opts || {};
  instance = factory(opts);
};

var instance = null;
