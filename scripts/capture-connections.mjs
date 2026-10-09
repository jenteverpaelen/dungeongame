// Local app-only Chrome check: built client, real Vite proxy and an unlisted local page.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const selection = process.argv.includes('--selection');
const messageBoundary = process.argv.includes('--message-boundary');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-connection-ui-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, selection ? 'docs/originality/checks/signatures' : messageBoundary ? 'docs/phase/P03-foundations/checks/messages' : 'docs/phase/P03-foundations/checks/connections');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, server, foreign, browserVersion, passed = false, failure;
async function until(fn) {
  const end = Date.now() + 20000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await wait(100); }
  throw Error('Connection browser condition timed out');
}
async function freePort() {
  const s = net.createServer(); await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const port = s.address().port; await new Promise(resolve => s.close(resolve)); return port;
}
const port = await freePort(), devPort = await freePort();
const directOrigin = `http://127.0.0.1:${port}`, devOrigin = `http://127.0.0.1:${devPort}`;
function launch(args, env = {}, ipc = false, exe = process.execPath) {
  const child = spawn(exe, args, { cwd: root, windowsHide: true,
    env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: '', ENABLE_DEBUG: '0', DISABLE_DEBUG: '0', WS_ALLOWED_ORIGINS: undefined, ...env },
    stdio: ['ignore', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  procs.push(child); child.on('error', error => logs.push(String(error)));
  child.stdout.on('data', data => logs.push(String(data))); child.stderr.on('data', data => logs.push(String(data))); return child;
}
async function connect(url) {
  const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map(), events = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p?.reject(message.error) : p?.resolve(message.result); }
    else if (message.method?.startsWith('Network.webSocket') && /Handshake|FrameError/.test(message.method)) events.push(message);
  };
  const channel = { ws, events, call: (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  }) }; channels.push(channel); return channel;
}
try {
  const build = launch(['node_modules/vite/bin/vite.js', 'build', '--config', 'client/vite.config.ts']);
  await new Promise((resolve, reject) => { build.once('error', reject); build.once('exit', code => code === 0 ? resolve() : reject(Error(`Build: ${code}`))); });
  server = launch(['--import', 'tsx', 'server/src/main.ts'], { PORT: String(port), WS_ALLOWED_ORIGINS: `${directOrigin},${devOrigin}` }, true);
  await until(async () => { if (server.exitCode !== null) throw Error(logs.join('')); try { return (await fetch(`${directOrigin}/healthz`)).ok; } catch { return false; } });
  const viteCode = `import {createServer} from 'vite'; const s=await createServer({configFile:'client/vite.config.ts',server:{host:'127.0.0.1',port:${devPort},strictPort:true,proxy:{'/ws':{target:'ws://127.0.0.1:${port}',ws:true}}}});await s.listen();`;
  launch(['--input-type=module', '-e', viteCode]);
  await until(async () => { try { return (await fetch(devOrigin)).ok; } catch { return false; } });
  foreign = http.createServer((_req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Local connection test</title><h1>Unlisted local origin</h1>'));
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  const foreignOrigin = `http://127.0.0.1:${foreign.address().port}`;
  launch(['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'chrome')}`,
    '--window-size=1920,1080', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', 'about:blank'], {}, false,
    'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome/DevToolsActivePort'), 'utf8'); } catch { return false; } });
  const [cdpPort, browserPath] = active.trim().split('\n');
  browser = await connect(`ws://127.0.0.1:${cdpPort}${browserPath}`); browserVersion = await browser.call('Browser.getVersion');
  const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const page = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await page.call('Page.enable'); await page.call('Runtime.enable'); await page.call('Network.enable');
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const r = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  for (const [name, origin, character] of [['01-built-client', directOrigin, 'DirectTrace'], ['02-vite-proxy', devOrigin, 'ProxyTrace']]) {
    if (selection) {
      await page.call('Page.navigate', { url: origin });
      await until(() => evaluate('typeof __ui!=="undefined" && __ui.get().screen==="select" && document.querySelectorAll(".cs-sig-glyph").length===3'));
      await wait(900);
      const cards = await evaluate(`Array.from(document.querySelectorAll('.cs-card'), card => ({
        classId: card.querySelector('canvas').dataset.preview, signature: card.querySelector('.cs-sig b').textContent,
        glyph: card.querySelector('.cs-sig-glyph').outerHTML, visible: card.getBoundingClientRect().bottom <= innerHeight
      }))`);
      assert.deepEqual(cards.map(card => [card.classId, card.signature, card.visible]), [
        ['warrior', 'Whirlwind', true], ['ranger', 'Sentry Turrets', true], ['mage', 'Meteor', true]
      ]);
      if (observations.length) assert.deepEqual(cards, observations.find(o => o.capture === '01-built-client-selection').cards);
      const viewport = await evaluate('({width:innerWidth,height:innerHeight,hidden:document.hidden})');
      assert.deepEqual(viewport, { width:1920, height:1080, hidden:false });
      observations.push({ capture: name + '-selection', ...viewport, cards });
      const selectionShot = await page.call('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
      await fs.writeFile(path.join(out, name + '-selection.png'), Buffer.from(selectionShot.data, 'base64'));
      console.log(`Captured ${name}-selection`);
    }
    await page.call('Page.navigate', { url: `${origin}/?autostart=${character}&class=mage` });
    await until(() => evaluate('typeof __ui!=="undefined" && __ui.get().screen==="game" && !!__ui.get().char'));
    await wait(900);
    const state = await evaluate('({origin:location.origin,width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,name:__ui.get().char.name,level:__ui.get().char.level,text:document.body.innerText})');
    assert.equal(state.origin, origin); assert.equal(state.name, character); assert.equal(state.width, 1920); assert.equal(state.height, 1080);
    assert.equal(state.camera, 620); assert.equal(state.hidden, false);
    observations.push({ capture: name, ...state });
    const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64')); console.log(`Captured ${name}`);
  }
  await page.call('Page.navigate', { url: foreignOrigin });
  await until(() => evaluate(`location.origin===${JSON.stringify(foreignOrigin)}`));
  const foreignResult = await evaluate(`new Promise(resolve=>{const ws=new WebSocket('ws://127.0.0.1:${port}/ws');const timer=setTimeout(()=>{ws.close();resolve('timeout')},3000);ws.onopen=()=>{clearTimeout(timer);ws.close();resolve('opened')};ws.onerror=()=>{clearTimeout(timer);resolve('rejected')}})`);
  assert.equal(foreignResult, 'rejected');
  // Keep only handshake diagnostics; game payloads are unnecessary for this check.
  const handshakes = page.events.map(e => ({ event: e.method, requestId: e.params.requestId,
    origin: e.params.request?.headers?.Origin ?? e.params.response?.requestHeaders?.Origin,
    status: e.params.response?.status, error: e.params.errorMessage }));
  observations.push({ name: 'unlisted-browser-origin', foreignOrigin, result: foreignResult, handshakes });
  assert.ok(handshakes.some(e => e.event === 'Network.webSocketFrameError' && /403/.test(e.error)));
  passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const channel of channels) channel.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(resolve => server.once('close', resolve)), wait(9000)]); }
  for (const child of procs) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  if (foreign) { foreign.closeAllConnections(); await new Promise(resolve => foreign.close(resolve)); }
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure,
    scope: 'Installed headless Chrome1920x1080; own local app with fresh profile/data, actual built/Vite browser handshakes and unlisted local page. No production TLS/proxy, account security, human usability or load-performance claim.', selection, observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Connection browser evidence: ${tmp}`);
}
