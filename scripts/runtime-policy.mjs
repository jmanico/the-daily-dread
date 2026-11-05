// SEC-1/SEC-9: new runtime modules and imports require an explicit review here.
// This is a review guard, not a JavaScript capability sandbox.
export const runtimePolicy = new Map([
  ['demo/app.jsx', ['react', 'react-dom/client', './model.js', './live-feed.jsx', './navigation.js']],
  ['demo/live-feed.jsx', ['react', './live-feed.json', './live-model.js', './navigation.js']],
  ['demo/model.js', []],
  ['demo/live-model.js', []],
  ['demo/navigation.js', ['react']],
  ['demo/theme.js', ['./model.js']],
  ['scripts/demo-server.mjs', ['node:http', 'node:fs/promises']],
  ['scripts/serve-demo.mjs', ['./demo-server.mjs']],
]);
