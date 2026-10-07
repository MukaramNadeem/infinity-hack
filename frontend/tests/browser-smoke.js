// Real Chromium interaction checks. Requires the frontend and seeded backend running.
// Transcript responses are intercepted so this test never creates or resets saved work.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = await mkdtemp(join(tmpdir(), 'novaworks-browser-'));
const debugPort = 9223;
const browser = spawn(process.env.CHROME_BIN || '/usr/bin/chromium', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${directory}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' });
let socket, nextId = 0; const pending = new Map(), runtimeErrors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description); return result.result.value; };
async function waitFor(expression, label) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); } throw new Error('Timed out: ' + label); }
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill = (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
async function login(account) { await waitFor("!!document.querySelector('#login-form')", 'login form'); await click(`[data-demo="${account}"]`); await evaluate("document.querySelector('#login-form').requestSubmit()"); await waitFor("!!document.querySelector('.sidebar') && !document.querySelector('.loading')", 'signed in'); }
async function logout() { await click('[data-action="logout"]'); await waitFor("!!document.querySelector('#login-form')", 'signed out'); }
async function screenshot(name) { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(`/tmp/novaworks-${name}.png`, Buffer.from(data.data, 'base64')); }
let mode = 'validation', commitBody;
const draft = { projects: [{ name: 'Review project', clientName: 'Demo client', description: 'A plan needing an owner.', managerId: 'PM01', deadline: '2026-10-20', tasks: [{ title: 'Review task', description: 'Confirm the owner before saving.', assigneeId: null, deadline: '2026-10-12', estimatedHours: 2 }] }] };
try {
  let targets;
  for (let i = 0; i < 100; i++) { try { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(100); }
  if (!targets?.length) throw new Error('Chromium did not start.');
  socket = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', async ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const task = pending.get(message.id); if (!task) return; pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      try {
        const { requestId, request } = message.params;
        let responseCode = 422, payload = { error: { code: 'VALIDATION_FAILED', message: 'The draft has unresolved fields. Nothing was saved.', details: [{ path: 'projects[0].tasks[0].assigneeId', message: 'Assignee could not be determined from the transcript.' }] }, draft };
        if (request.url.endsWith('/commit')) { commitBody = JSON.parse(request.postData); responseCode = 201; payload = { result: { projectCount: 1, taskCount: 1, projects: [] } }; }
        else if (mode === 'failure') { responseCode = 502; payload = { error: { code: 'AI_FAILED', message: 'The AI service could not process this transcript. Nothing was saved.' } }; }
        await sleep(300);
        await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') });
      } catch (error) { runtimeErrors.push(error.message); }
    }
  });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5173' });
  await waitFor("!!document.querySelector('#login-form')", 'initial login'); await screenshot('login');
  await fill('#email', 'admin@novaworks.example'); await fill('#password', 'wrong'); await evaluate("document.querySelector('#login-form').requestSubmit()");
  await waitFor("document.querySelector('#notice')?.textContent.includes('incorrect')", 'invalid login error');
  await login('admin'); assert.equal(await evaluate("document.querySelectorAll('.project-card').length"), 3); await screenshot('projects');
  await fill('#project-search', 'UrbanCart'); assert.equal(await evaluate("document.querySelectorAll('.project-card').length"), 1);
  await click('.project-card'); await waitFor("document.querySelectorAll('.task-table tbody tr').length===4", 'project detail');
  await click('a[href="#team"]'); await waitFor("document.querySelectorAll('.team-card').length===10", 'team directory');
  await send('Page.reload'); await waitFor("document.querySelectorAll('.team-card').length===10", 'session restoration');
  await click('a[href="#create"]'); await waitFor("!!document.querySelector('#transcript')", 'transcript form');
  await click('[data-action="load-demo"]'); await waitFor("document.querySelector('#transcript').value.length>10000", 'demo transcript');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/transcript/*', requestStage: 'Request' }] });
  await evaluate("document.querySelector('#transcript-form').requestSubmit()");
  await waitFor("!!document.querySelector('.busy-note')", 'AI loading state');
  await waitFor("!!document.querySelector('#correction-form')", 'correction form');
  assert.equal(await evaluate("document.querySelector('[data-field=\"projects[0].tasks[0].assigneeId\"]').getAttribute('aria-invalid')"), 'true');
  await screenshot('correction');
  await fill('[data-field="projects[0].tasks[0].assigneeId"]', 'DEV01');
  await evaluate("document.querySelector('#correction-form').requestSubmit()");
  await waitFor("document.querySelector('#notice')?.textContent.includes('1 projects and 1 tasks created')", 'corrected save success');
  assert.equal(commitBody.draft.projects[0].tasks[0].assigneeId, 'DEV01');
  await click('a[href="#create"]'); await waitFor("!!document.querySelector('#transcript')", 'transcript again');
  mode = 'failure'; await fill('#transcript', 'A new meeting.'); await evaluate("document.querySelector('#transcript-form').requestSubmit()");
  await waitFor("document.querySelector('#notice')?.textContent.includes('Nothing was saved')", 'provider failure');
  assert.equal(await evaluate("document.querySelector('#transcript').value"), 'A new meeting.');
  await send('Fetch.disable');
  await logout(); await login('ayesha');
  assert.equal(await evaluate("document.querySelectorAll('.project-card').length"), 1);
  assert.equal(await evaluate("!!document.querySelector('a[href=\"#create\"]')"), false);
  await logout(); await login('ali'); assert.equal(await evaluate("document.querySelectorAll('.task-table tbody tr').length"), 3);
  assert.equal(await evaluate("document.querySelector('main').textContent.includes('Product and cart APIs')"), false);
  await logout(); await login('hamza'); assert.equal(await evaluate("document.querySelectorAll('.task-table tbody tr').length"), 2);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('a[href="#projects"]'); await waitFor("document.querySelectorAll('.project-card').length===2", 'mobile projects');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true); await screenshot('mobile');
  await evaluate("fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>location.hash='team')");
  await waitFor("!!document.querySelector('#login-form')", 'expired session');
  assert.deepEqual(runtimeErrors, []);
  console.log('BROWSER PASS: login/errors/logout, session restoration/expiry, role-scoped projects and tasks, search, team, transcript loading, 422 correction/commit, AI failure, mobile overflow. No saved work changed.');
  console.log('Screenshots: /tmp/novaworks-login.png, /tmp/novaworks-projects.png, /tmp/novaworks-correction.png, /tmp/novaworks-mobile.png');
} finally { socket?.close(); browser.kill('SIGTERM'); }
