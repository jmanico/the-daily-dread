import { createDemoServer, loadAssets } from './demo-server.mjs';

try {
  const server = createDemoServer(await loadAssets(new URL('../dist-demo/', import.meta.url)));
  server.on('error', () => { console.error('Demo server unavailable. Build first and check port 4173.'); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('Local demo with public advisory snapshot: http://127.0.0.1:4173 — Ctrl+C to stop'));
  const stop = () => { server.close(); server.closeAllConnections(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch {
  console.error('Demo assets unavailable. Run npm run build first.');
  process.exitCode = 1;
}
