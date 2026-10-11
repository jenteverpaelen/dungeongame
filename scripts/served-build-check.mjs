// Served-build smoke check (verify stage `served-build`): the BUILT client (dist/client) served by the real game server
// with its real security headers, opened in headless Chrome, must reach the game screen with zero page errors.
// Vite dev serves no CSP, so only this catches a header that breaks the shipped client (2026-10-11: a strict CSP without
// 'unsafe-eval' stopped Pixi and the served page stayed blank).
//
//   DATA_DIR=<isolated dir> node scripts/served-build-check.mjs        (after `npm run build`)
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, label) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await wait(150); }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message ?? last}` : ''}`);
}
async function cdp(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map(), handlers = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.reject(new Error(m.error.message)) : p?.resolve(m.result); }
    else for (const h of handlers) h(m);
  };
  return { on: (h) => handlers.push(h), call: (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }) };
}
const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

if (!process.env.DATA_DIR) throw new Error('Set an isolated DATA_DIR');
await fs.access(path.join(root, 'dist/client/index.html')).catch(() => { throw new Error('dist/client is missing: run `npm run build` first'); });
await fs.access(CHROME).catch(() => { throw new Error(`Chrome not found at ${CHROME} (set CHROME_PATH)`); });

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-served-'));
const dataDir = path.join(process.env.DATA_DIR, 'served-build');
await fs.mkdir(dataDir, { recursive: true });
const port = await freePort();
let log = '';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, BACKUP_DIR: '', BACKUP_KEEP: '0', ENABLE_DEBUG: '0', WS_ALLOWED_ORIGINS: undefined, TELEMETRY: '0' },
});
server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
let chrome, browser, failed = false;
const problems = [];
try {
  await until(() => { if (server.exitCode !== null) throw new Error(log); return log.includes('listening on'); }, 60_000, 'game server');
  const base = `http://localhost:${port}`;
  const res = await fetch(`${base}/`);
  const csp = res.headers.get('content-security-policy');
  if (res.status !== 200) problems.push(`GET / → ${res.status}`);
  if (!csp) problems.push('the served page has no Content-Security-Policy header');
  chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1920,1080',
    '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome', 'DevToolsActivePort'), 'utf8'); } catch { return false; } }, 20_000, 'Chrome DevTools port');
  const [cport, browserPath] = active.trim().split('\n');
  browser = await cdp(`ws://127.0.0.1:${cport}${browserPath}`);
  const targets = await (await fetch(`http://127.0.0.1:${cport}/json/list`)).json();
  const page = await cdp(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  const errors = [];
  page.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(`exception: ${m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(`console.error: ${m.params.args.map((x) => x.value ?? x.description).join(' ')}`);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(`${m.params.entry.source}: ${m.params.entry.text}${m.params.entry.url ? ` (${m.params.entry.url})` : ''}`);
  });
  await page.call('Page.enable'); await page.call('Runtime.enable'); await page.call('Log.enable');
  await page.call('Page.navigate', { url: `${base}/?autostart=Servedcheck&class=warrior` });
  const t0 = Date.now();
  let state = null;
  try {
    await until(async () => {
      const r = await page.call('Runtime.evaluate', { expression: '({ screen: window.__ui?.get().screen ?? null, canvas: !!document.querySelector("canvas"), me: !!window.__ui?.get().me })', returnByValue: true });
      state = r.result.value;
      return state?.screen === 'game' && state.canvas && state.me;
    }, 60_000, 'the game screen');
  } catch (e) { problems.push(`${e.message}; last state ${JSON.stringify(state)}`); }
  await wait(1500); // let the first frames render and late errors arrive
  for (const e of [...new Set(errors)]) problems.push(e.split('\n')[0]);
  console.log(`served build on :${port}: CSP ${csp ? 'present' : 'missing'}, ${state?.screen === 'game' ? `game screen in ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'no game screen'}, ${errors.length} page error(s)`);
} catch (e) {
  problems.push(String(e?.stack ?? e));
} finally {
  await browser?.call('Browser.close').catch(() => {});
  await wait(300);
  if (chrome && chrome.exitCode === null) chrome.kill();
  if (server.exitCode === null) {
    server.send('hearthfall:shutdown');
    await Promise.race([new Promise((r) => server.once('close', r)), wait(8000)]);
    if (server.exitCode === null) server.kill();
  }
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
}
if (problems.length) {
  failed = true;
  console.error(`SERVED BUILD CHECK FAILED:\n  ${problems.join('\n  ')}`);
}
process.exitCode = failed ? 1 : 0;
