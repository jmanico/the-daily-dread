import { createDemoServer, loadAssets } from './demo-server.mjs';
import { createPublicAdvisories } from '../demo/provider.js';
import { createPublicRefresh } from '../demo/refresh.js';

try {
  const assets=await loadAssets(new URL('../dist-demo/',import.meta.url));
  const source=createPublicAdvisories(),feed=createPublicRefresh(source);
  const server=createDemoServer(assets,feed);
  const stop=async()=>{source.close();server.close();server.closeAllConnections();await feed.stop();};
  server.on('error',async()=>{console.error('Demo server unavailable. Build first and check port 4173.');process.exitCode=1;await stop();});
  server.listen(4173,'127.0.0.1',()=>{console.log('Local live public advisory feed: http://127.0.0.1:4173 — Ctrl+C to stop');feed.start();});
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
} catch {
  console.error('Demo unavailable. Build first and check local configuration.');
  process.exitCode=1;
}
