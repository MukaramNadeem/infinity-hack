import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createServer } from '../server.js';
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; }
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
test('static server serves assets and never exposes private repository files', async () => {
  const server = createServer(), url = await listen(server);
  try {
    const page = await fetch(url); assert.equal(page.status, 200); assert.match(await page.text(), /NovaWorks/);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    for (const path of ['/.env', '/server.js', '/package.json', '/%2e%2e%2fbackend%2f.env']) assert.ok([403, 404].includes((await fetch(url + path)).status));
    assert.equal((await fetch(url + '/app.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal((await fetch(url + '/styles.css', { method: 'POST' })).status, 405);
    assert.equal((await fetch(url + '//example.com/api/auth/me')).status, 400);
  } finally { await close(server); }
});
test('API proxy preserves session cookies, origin, body and error responses', async () => {
  const upstream = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    assert.equal(req.url, '/api/transcript/commit'); assert.equal(req.headers.cookie, 'nw.sid=test-session');
    assert.equal(req.headers.origin, 'http://localhost:5173'); assert.deepEqual(JSON.parse(body), { draft: { projects: [] } });
    res.writeHead(422, { 'Content-Type': 'application/json', 'Set-Cookie': 'nw.sid=test-session; HttpOnly; SameSite=Lax' });
    res.end(JSON.stringify({ error: { message: 'Correct this draft.' }, draft: { projects: [] } }));
  });
  const target = await listen(upstream), server = createServer(target), url = await listen(server);
  try {
    const response = await fetch(url + '/api/transcript/commit', { method: 'POST', headers: { Cookie: 'nw.sid=test-session', Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: { projects: [] } }) });
    assert.equal(response.status, 422); assert.match(response.headers.get('set-cookie'), /HttpOnly/); assert.deepEqual((await response.json()).draft, { projects: [] });
  } finally { await close(server); await close(upstream); }
});
test('unavailable backend gives the UI a readable error', async () => {
  const server = createServer('http://127.0.0.1:1'), url = await listen(server);
  try { const response = await fetch(url + '/api/health'); assert.equal(response.status, 502); assert.equal((await response.json()).error.code, 'API_UNAVAILABLE'); }
  finally { await close(server); }
});
