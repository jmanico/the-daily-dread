import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

export const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
export const assetNames = ['index.html', 'app.js', 'theme.js', 'app.css', 'logo.svg', 'NOTICES.txt', ...['Atkinson', 'SourceSerif', 'PlexMono'].flatMap(face => ['Regular', 'Bold', 'Italic', 'BoldItalic'].map(style => `fonts/${face}-${style}.woff2`))];

/** Load only this fixed public asset set; never resolve request paths on disk.
 * @param {URL} directory
 */
export async function loadAssets(directory) {
  /** @type {Map<string,Buffer>} */
  const assets = new Map();
  for (const name of assetNames) {
    const data = await readFile(new URL(name, directory));
    if (data.length > 2 * 1024 * 1024) throw new Error('Demo asset exceeds budget');
    assets.set(name === 'index.html' ? '/' : `/${name}`, data);
  }
  return assets;
}

/** @param {Map<string,Buffer>} assets */
export function createDemoServer(assets) {
  const server = createServer({ maxHeaderSize: 16384, headersTimeout: 10000, requestTimeout: 30000, keepAliveTimeout: 5000 }, (req, res) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const address = server.address();
    const expected = address && typeof address === 'object' ? `127.0.0.1:${address.port}` : '';
    let status = 200;
    const rawPath = req.url || '';
    if (!expected || req.headers.host !== expected || req.headers.origin && req.headers.origin !== `http://${expected}` || req.headers['sec-fetch-site'] === 'cross-site') status = 400;
    else if (!['GET', 'HEAD'].includes(req.method || '')) status = 405;
    else if (!assets.has(rawPath)) status = 404;
    if (status !== 200) {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) });
      res.end(req.method === 'HEAD' ? undefined : 'Demo request unavailable');
      return;
    }
    const content = assets.get(rawPath);
    const type = rawPath === '/' ? 'text/html; charset=utf-8' : rawPath.endsWith('.js') ? 'text/javascript; charset=utf-8' : rawPath.endsWith('.css') ? 'text/css; charset=utf-8' : rawPath.endsWith('.svg') ? 'image/svg+xml' : rawPath.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': content?.length ?? 0 });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 32;
  server.setTimeout(30000, socket => socket.destroy());
  return server;
}
