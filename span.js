var eventContext = require('tfg-event-context');
var logger = require('pomelo-logger').getLogger('pomelo-rpc', __filename);

var countParents = function(context) {
  var count = 0;
  while(context.parent) {
    count += 1;
    context = context.parent;
  }
  return count;
};

var Span = function(tracer, parent, operationName, tags) {
  this._tracer = tracer;
  this._span = tracer.startSpan(operationName, {
    childOf: parent,
    tags: tags,
  });
};

Span.prototype.startSpan = function(operationName, tags) {
  return new Span(this._tracer, this._span, operationName, tags);
};

Span.prototype.propagate = function(cb) {
  var self = this;
  var ctx = eventContext.createContext();
  var state = ctx.getState();

  var cur = eventContext.getCurrentContext();
  if(cur && cur.getState().span === this) {
    return cb();
  }

  return ctx.run(function() {
    state.span = self;
    self.setTag('contexts', countParents(ctx) + 1);
    return cb();
  });
};

Span.prototype.inject = function(carrier) {
  this._tracer.inject(this._span, 'text_map', carrier);
};

Span.prototype.setOperationName = function(operationName) {
  this._span.setOperationName(operationName);
}

Span.prototype.setTag = function(tag, value) {
  this._span.setTag(tag, value);
};

Span.prototype.addTags = function(tags) {
  this._span.addTags(tags);
};

Span.prototype.finish = function(err) {
  if(err instanceof Error) {
    this._span.setTag('error', true);
    this._span.log({
      'event': 'error',
      'message': err.message,
      'stack': err.stack,
      'error.kind': err.name
    });
  }
  this._span.finish();
};

Span.prototype.isValid = function() {
  return true;
}

Span.mock = function(tracer) {
  return {
    startSpan: function(operationName, tags) {
      if(tracer) {
        return new Span(tracer, null, operationName, tags);
      }
      return Span.mock();
    },
    propagate: function(cb) {
      cb();
    },
    inject: function(carrier) {},
    setOperationName: function(operationName) {},
    setTag: function(tag, value) {},
    addTags: function(tags) {},
    finish: function(err) {},
    isValid: function() {
      return false;
    }
  };
}

module.exports = Span;
