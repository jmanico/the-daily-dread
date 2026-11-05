// SEC-1/SEC-9: new runtime modules and imports require an explicit review here.
// This is a review guard, not a JavaScript capability sandbox.
export const runtimePolicy = new Map([
  ['src/adapters/outbound/retrieve.js', ['node:http', './connect-destination.js', './destination-policy.js', './retrieval-budget.js', './read-body.js']],
  ['src/adapters/outbound/read-body.js', ['node:stream', 'node:stream/promises', 'node:zlib']],
  ['src/adapters/outbound/retrieval-budget.js', ['./destination-policy.js']],
  ['src/adapters/outbound/address-policy.js', ['node:net']],
  ['src/adapters/outbound/destination-policy.js', ['node:net', './address-policy.js']],
  ['src/adapters/outbound/resolve-destination.js', ['node:dns/promises', 'node:net']],
  ['src/adapters/outbound/connect-destination.js', ['node:net', 'node:tls', './address-policy.js', './destination-policy.js', './resolve-destination.js']],
  ['demo/app.jsx', ['react', 'react-dom/client', './model.js', './live-feed.jsx', './navigation.js']],
  ['demo/live-feed.jsx', ['react', './live-feed.json', './live-model.js', './navigation.js']],
  ['demo/model.js', []],
  ['demo/live-model.js', []],
  ['demo/navigation.js', ['react']],
  ['demo/theme.js', ['./model.js']],
  ['scripts/demo-server.mjs', ['node:http', 'node:fs/promises']],
  ['scripts/serve-demo.mjs', ['./demo-server.mjs']],
]);
