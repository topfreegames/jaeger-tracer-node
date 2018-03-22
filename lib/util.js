
function wrap (object, method, patch) {
  let original = object[method]
  object[method] = patch(original)
}

module.exports = {
  wrap
}
