var eventContext = require('tfg-event-context');
var Module = require('module');
var tracer = require('./tracer');
var url = require('url');

var wrap = function(object, method, patch) {
  var original = object[method];
  object[method] = patch(original);
};

var patches = {
  bluebird: function(object) {
    var methods = ['then', 'done', 'catch', 'caught', 'error', 'finally', 'lastly', 'asCallback', 'nodeify'];

    var patch = function(original) {
      return function() {
        var context = eventContext.getCurrentContext();

        if(context == null) {
          return original.apply(this, arguments);
        }

        var args = Array.prototype.slice.call(arguments).map(function(arg) {
          if(typeof arg !== 'function') {
            return arg;
          }
          return function() {
            eventContext.setCurrentContext(context);
            try {
              return arg.apply(this, arguments);
            }
            finally {
              eventContext.revertContext();
            }
          };
        });

        return original.apply(this, args);
      };
    };

    methods.forEach(function(method) {
      wrap(object.prototype, method, patch);
    });

    wrap(object, 'coroutine', function(original) {
      return function(generatorFunction, options) {

        var computation = function*() {
          var context = eventContext.getCurrentContext();

          if(context == null) {
            return yield* generatorFunction.apply(this, arguments);
          }

          var generator = generatorFunction.apply(this, arguments);

          var result = null;
          var param = null;
          var error = null;

          while(true) {
            eventContext.setCurrentContext(context);
            try {
              if(error) {
                result = generator.throw(error);
              }
              else {
                result = generator.next(param);
              }
            }
            finally {
              eventContext.revertContext();
            }
            if(result.done) {
              return result.value;
            }
            try {
              param = yield result.value;
              error = null;
            }
            catch(err) {
              error = err;
            }
          }
        };

        return original.call(this, computation, options);
      };
    });
  },

  http: function(object) {
    wrap(object, 'request', function(original) {
      return function(options, cb) {
        var parent = tracer.currentSpan();
        var span = parent.startSpan();

        options.headers = options.headers || {};
        span.inject(options.headers);

        var request = original.call(this, options, function(response) {
          span.setTag('http.status_code', response.statusCode);

          response.on('end', function() {
            span.finish();
          });

          if(cb) {
            return cb.call(this, response);
          }
        });

        request.on('error', function(err) {
          span.finish(err);
        });

        var host = request.getHeader('host');
        var parsedURL = url.parse(request.path);

        span.setOperationName(`HTTP ${request.method} ${host}`);
        span.addTags({
          'http.host': host,
          'http.method': request.method,
          'http.pathname': parsedURL.pathname,
          'span.kind': 'client'
        });

        if(parsedURL.query) {
          span.setTag('http.query', parsedURL.query);
        }

        return request;
      };
    });

    wrap(object, 'createServer', function(original) {
      return function(requestListener) {
        var wrapped = function(request, response) {
          var parsedURL = url.parse(request.url);
          var span = tracer.startSpan(request.headers, 'HTTP ' + request.method, {
            'http.host': request.headers.host,
            'http.method': request.method,
            'http.pathname': parsedURL.pathname,
            'span.kind': 'server'
          });

          if(parsedURL.query) {
            span.setTag('http.query', parsedURL.query);
          }

          response.on('finish', function() {
            span.setTag('http.status_code', response.statusCode);
            span.finish();
          });

          return span.propagate(function() {
            return requestListener.call(this, request, response);
          });
        };
        return original.call(this, wrapped);
      };
    });
  },

  sequelize: function(object) {
    wrap(object.Sequelize.prototype, 'query', function(original) {
      return function(sql, options) {
        var parent = tracer.currentSpan();
        var span = parent.startSpan('SQL ' + options.type, {
          'db.instance': this.config.database,
          'db.statement': sql,
          'db.type': 'sql',
          'db.user': this.config.username,
          'span.kind': 'client'
        });

        return original.call(this, sql, options)
          .then(
            function(result) {
              span.finish();
              return result;
            },
            function(err) {
              span.finish(err);
              throw err;
            }
          );
      };
    });
  },

  ioredis: function(object) {
    wrap(object.prototype, 'sendCommand', function(original) {
      return function(command, stream) {
        var parent = tracer.currentSpan();
        var span = parent.startSpan('redis ' + command.name, {
          'db.instance': this.options.db,
          'db.statement': command.name + ' ' + command.args.join(' '),
          'db.type': 'redis',
          'span.kind': 'client'
        });

        return original.apply(this, arguments)
          .then(
            function(value) {
              span.finish();
              return value;
            },
            function(err) {
              span.finish(err);
              throw err;
            }
          );
      };
    });
  },

  mongodb: function(object) {
    var patches = {
      Collection: function(object, method, options) {
        wrap(object, method, function(original) {
          return function() {
            if(options.promise === false) {
              return original.apply(this, arguments);
            }

            var argsToString = Array.prototype.slice.call(arguments).map(JSON.stringify).join(',');

            var parent = tracer.currentSpan();
            var span = parent.startSpan('MongoDB ' + method, {
              'db.instance': this.s.dbName,
              'db.statement': `${this.namespace}.${method}(${argsToString})`,
              'db.type': 'mongodb',
              'span.kind': 'client'
            });

            var last = arguments.length - 1;
            var callback = arguments[last];

            if(typeof callback === 'function') {
              arguments[last] = function(err, value) {
                span.finish(err);
                return callback.call(this, err, value);
              }

              return original.apply(this, arguments);
            }

            return original.apply(this, arguments)
              .then(
                function(value) {
                  span.finish();
                  return value;
                },
                function(err) {
                  span.finish(err);
                  throw err;
                }
              );
          };
        });
      }
    };

    object.instrument(null, function(err, modules) {
      if(err) {
        console.warn('Could not instrument MongoDB for Jaeger');
        return;
      }

      modules.forEach(function(module) {
        var patch = patches[module.name];

        if(patch === undefined) {
          return;
        }

        module.instrumentations.forEach(function(instrumentation) {
          var target = instrumentation.options.static?
              module.obj : module.obj.prototype;

          instrumentation.methods.forEach(function(method) {
            patch(target, method, instrumentation.options);
          });
        });
      });
    });
  }
};

wrap(Module, '_load', function(load) {
  return function(file) {
    var object = load.apply(this, arguments);
    var patch = patches[file];

    if(patch && !object.__patched) {
      patch(object);
      object.__patched = true;
    }

    return object;
  };
});

wrap(process, 'nextTick', function(nextTick) {
  return function(callback) {
    var context = eventContext.getCurrentContext();

    if(context == null) {
      return nextTick.apply(this, arguments);
    }

    var computation = function() {
      eventContext.setCurrentContext(context);
      try {
        return callback.apply(this, arguments);
      }
      finally {
        eventContext.revertContext();
      }
    };

    var args = Array.prototype.slice.call(arguments, 1);
    args = [computation].concat(args);

    return nextTick.apply(this, args);
  };
});

wrap(global, 'setImmediate', function(setImmediate) {
  return function(callback) {
    var context = eventContext.getCurrentContext();

    if(context == null) {
      return setImmediate.apply(this, arguments);
    }

    var computation = function() {
      eventContext.setCurrentContext(context);
      try {
        return callback.apply(this, arguments);
      }
      finally {
        eventContext.revertContext();
      }
    };

    var args = Array.prototype.slice.call(arguments, 1);
    args = [computation].concat(args);

    var id = setImmediate.apply(this, args);
    var dispose = clearImmediate.bind(null, id);
    context.addDisposable(dispose);
    return id;
  };
});
