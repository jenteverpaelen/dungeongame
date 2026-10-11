// Shared plumbing for the browser-based client performance gate (scripts/client-perf-check.mjs): the real game server
// serving dist/client on a free port with an isolated save directory, and headless Chrome at 1920×1080 driven over the
// DevTools protocol (a visible page target, so requestAnimationFrame runs). Plain Node, no packages.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export async function until(fn, ms, label) {
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

/** The game server on a free port (debug commands off), serving the built client. */
export async function startServer(root, dataDir) {
  await fs.mkdir(dataDir, { recursive: true });
  const port = await freePort();
  let log = '';
  const proc = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, BACKUP_DIR: '', BACKUP_KEEP: '0', ENABLE_DEBUG: '0', WS_ALLOWED_ORIGINS: undefined, TELEMETRY: '0' },
  });
  proc.stdout.on('data', (d) => { log += d; }); proc.stderr.on('data', (d) => { log += d; });
  await until(() => { if (proc.exitCode !== null) throw new Error(log); return log.includes('listening on'); }, 60_000, 'game server');
  return {
    base: `http://localhost:${port}`,
    async stop() {
      if (proc.exitCode !== null) return;
      proc.send('hearthfall:shutdown');
      await Promise.race([new Promise((r) => proc.once('close', r)), wait(8000)]);
      if (proc.exitCode === null) proc.kill();
    },
  };
}

/** Headless Chrome with one 1920×1080 page; `page.eval` returns by value, `page.errors` collects page errors. */
export async function startChrome() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-perf-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1920,1080',
    '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome', 'DevToolsActivePort'), 'utf8'); } catch { return false; } }, 20_000, 'Chrome DevTools port');
  const [cport, browserPath] = active.trim().split('\n');
  const browser = await cdp(`ws://127.0.0.1:${cport}${browserPath}`);
  const targets = await (await fetch(`http://127.0.0.1:${cport}/json/list`)).json();
  const conn = await cdp(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  const errors = [];
  conn.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(`exception: ${m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(`console.error: ${m.params.args.map((x) => x.value ?? x.description).join(' ')}`);
  });
  await conn.call('Page.enable'); await conn.call('Runtime.enable');
  await conn.call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const page = {
    errors,
    cdp: (method, params) => conn.call(method, params),
    onCdp: (h) => conn.on(h),
    async eval(expression) {
      const r = await conn.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
      return r.result.value;
    },
    async goto(url) { await conn.call('Page.navigate', { url }); await wait(300); },
    async mouse(x, y) { await conn.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); },
  };
  return {
    page,
    async stop() {
      await browser.call('Browser.close').catch(() => {});
      await wait(300);
      if (proc.exitCode === null) proc.kill();
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** Running CSS animations (kind 'animation') and transitions (kind 'transition') with the properties they animate. */
export async function runningAnimations(page) {
  return page.eval(`(() => { const out = []; for (const an of document.getAnimations()) { if (an.playState !== 'running') continue; const t = an.effect && an.effect.target; if (!t) continue;
    const kf = an.effect.getKeyframes ? an.effect.getKeyframes() : [];
    const props = [...new Set(kf.flatMap(k => Object.keys(k).filter(p => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))];
    out.push({ kind: an.animationName !== undefined ? 'animation' : an.transitionProperty !== undefined ? 'transition' : 'script', name: an.animationName || an.transitionProperty || an.constructor.name, target: t.tagName.toLowerCase() + (t.getAttribute('class') ? '.' + String(t.getAttribute('class')).trim().split(/\\s+/).slice(0, 2).join('.') : ''), props }); }
    return out; })()`);
}
