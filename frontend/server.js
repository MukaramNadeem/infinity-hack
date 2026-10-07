import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
export function createServer(backendUrl = 'http://127.0.0.1:4000') {
  const backend = new URL(backendUrl);
  if (!['http:', 'https:'].includes(backend.protocol)) throw new Error('BACKEND_URL must use http or https.');
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    let path;
    if (!req.url.startsWith('/') || req.url.startsWith('//')) { res.writeHead(400).end('Invalid URL'); return; }
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid URL'); return; }
    if (path.startsWith('/api/')) {
      const proxy = (backend.protocol === 'https:' ? https : http).request(new URL(req.url, backend), {
        method: req.method,
        headers: { ...req.headers, host: backend.host },
        timeout: 210000
      }, upstream => {
        res.writeHead(upstream.statusCode, upstream.headers);
        upstream.pipe(res);
      });
      proxy.on('timeout', () => proxy.destroy());
      proxy.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { code: 'API_UNAVAILABLE', message: 'Cannot reach the server. Check that the backend is running, then try again.' } }));
        else res.destroy();
      });
      req.on('aborted', () => proxy.destroy());
      req.pipe(proxy);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end('Forbidden'); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 5173);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer(process.env.BACKEND_URL);
  server.listen(port, host, () => console.log(`NovaWorks frontend: http://localhost:${port}`));
  server.on('error', error => { console.error('Frontend could not start:', error.code); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}
