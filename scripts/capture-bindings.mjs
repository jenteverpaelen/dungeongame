// Local installed-Chrome keyboard regression; real DOM input and isolated game server.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-bindings-ui-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P03-foundations/checks/bindings-ui');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const r = await fn(); if (r) return r; await wait(100); }
  throw Error('Keyboard UI condition timed out');
}
const port = await new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
function launch(exe, args, env = {}, ipc = false) {
  const p = spawn(exe, args, { cwd: root, windowsHide: true,
    env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: '', ENABLE_DEBUG: '0', DISABLE_DEBUG: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  procs.push(p); p.on('error', e => logs.push(String(e)));
  p.stdout.on('data', d => logs.push(String(d))); p.stderr.on('data', d => logs.push(String(d))); return p;
}
async function connect(url) {
  const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.reject(m.error) : p?.resolve(m.result); } };
  const c = { ws, call: (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  }) }; channels.push(c); return c;
}
try {
  const build = launch(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'client/vite.config.ts']);
  await new Promise((resolve, reject) => { build.once('error', reject); build.once('exit', c => c === 0 ? resolve() : reject(Error(`Build: ${c}`))); });
  server = launch(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], { PORT: String(port) }, true);
  await until(async () => { if (server.exitCode !== null) throw Error(logs.join('')); try { return (await fetch(`http://127.0.0.1:${port}/healthz`)).ok; } catch { return false; } });
  launch('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0',
    `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1920,1080', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', 'about:blank']);
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome/DevToolsActivePort'), 'utf8'); } catch { return false; } });
  const [cdpPort, browserPath] = active.trim().split('\n');
  browser = await connect(`ws://127.0.0.1:${cdpPort}${browserPath}`); browserVersion = await browser.call('Browser.getVersion');
  const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  page = await connect(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await page.call('Page.enable'); await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const r = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const record = async name => {
    await wait(300);
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      text:document.body.innerText,keys:JSON.parse(localStorage.getItem('hearthfall.bindings.v1')),me:__ui.get().me,
      panels:[...document.querySelectorAll('.pn,.help-panel')].map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('data-panel')||'help',x:r.x,y:r.y,w:r.width,h:r.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}})})`);
    assert.equal(state.width, 1920); assert.equal(state.height, 1080); assert.equal(state.hidden, false); assert.equal(state.camera, 620);
    for (const panel of state.panels) { assert.ok(panel.y >= 0 && panel.y + panel.h <= 1081, JSON.stringify(panel)); }
    observations.push({ name, ...state });
    const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64')); console.log(`Captured ${name}`);
  };
  const keyEvent = (type, code, key, vk, extra = {}) => page.call('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...extra });
  const key = async (code, value = code.startsWith('Key') ? code.slice(3).toLowerCase() : code, vk = code.startsWith('Key') ? code.charCodeAt(3) : 0) => {
    await keyEvent('keyDown', code, value, vk, value.length === 1 ? { text: value } : {});
    await keyEvent('keyUp', code, value, vk); await wait(150);
  };
  const click = async selector => {
    const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing: '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
    await page.call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...box });
    await page.call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...box }); await wait(200);
  };
  const blur = () => evaluate('document.activeElement?.blur();true');
  let load = 0;
  const start = async () => {
    await page.call('Page.navigate', { url: `http://127.0.0.1:${port}/?autostart=BindingsTrace&class=mage&checkLoad=${++load}` });
    await until(() => evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
    await until(() => evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
    await wait(300); await blur();
  };
  const rebind = async (action, code, value, vk) => {
    await click(`[data-bind="${action}:0"]`); await key(code, value, vk);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('hearthfall.bindings.v1')).values.${action}[0]`), code);
  };
  await start(); await key('F1', 'F1', 112); await record('01-default-help'); await key('Escape', 'Escape', 27);
  await key('KeyO'); await click('.pn-settings .tab:nth-child(2)');
  await click('[data-bind="dash:0"]'); await key('KeyW');
  assert.match(await evaluate('document.querySelector(".pn-settings [role=status]").textContent'), /Already assigned to Move up/);
  assert.deepEqual(await evaluate('__game.input.move()'), { x: 0, y: 0 });
  assert.equal(await evaluate('__ui.get().me.dashCd'), 0); await record('02-conflict');
  await key('Escape', 'Escape', 27); assert.equal(await evaluate('Boolean(__ui.get().panels.settings)'), true);
  await rebind('dash', 'KeyJ'); await rebind('interact', 'Numpad9', '9', 105);
  await rebind('skills', 'KeyL'); await rebind('up', 'KeyT'); await rebind('settings', 'KeyY');
  await record('03-custom-controls');
  await key('F1', 'F1', 112); assert.equal(await evaluate('Boolean(__ui.get().panels.help)'), true);
  await record('04-custom-help'); await key('Escape', 'Escape', 27);
  assert.equal(await evaluate('document.querySelector(".slot-dash .slot-key").textContent'), 'J');
  assert.equal(await evaluate('document.querySelector(".ip-key").textContent'), 'Num9'); await record('05-long-interact-key');
  await key('KeyE'); assert.equal(await evaluate('Boolean(__ui.get().panels.waypoint)'), false);
  await key('Numpad9', '9', 105); assert.equal(await evaluate('Boolean(__ui.get().panels.waypoint)'), true); await key('Escape', 'Escape', 27);
  await key('KeyK'); assert.equal(await evaluate('Boolean(__ui.get().panels.skills)'), false);
  await key('KeyL'); assert.equal(await evaluate('Boolean(__ui.get().panels.skills)'), true); await key('Escape', 'Escape', 27);
  const before = await evaluate('({x:__ui.get().me.x,y:__ui.get().me.y})');
  await keyEvent('keyDown', 'KeyT', 't', 84); assert.equal(await evaluate('__game.input.move().y'), -1); await wait(180);
  await keyEvent('keyUp', 'KeyT', 't', 84); await wait(200);
  const after = await evaluate('({x:__ui.get().me.x,y:__ui.get().me.y})'); assert.notDeepEqual(after, before);
  await keyEvent('keyDown', 'KeyW', 'w', 87); assert.equal(await evaluate('__game.input.move().y'), 0); await keyEvent('keyUp', 'KeyW', 'w', 87);
  await key('KeyJ'); await until(() => evaluate('__ui.get().me.dashCd>0')); await until(() => evaluate('__ui.get().me.dashCd===0'));
  await key('Space', ' ', 32); assert.equal(await evaluate('__ui.get().me.dashCd'), 0);
  await key('Enter', 'Enter', 13); await key('KeyJ');
  assert.equal(await evaluate('document.activeElement.value'), 'j'); assert.equal(await evaluate('__ui.get().me.dashCd'), 0);
  await key('Escape', 'Escape', 27);
  await key('KeyO'); assert.equal(await evaluate('Boolean(__ui.get().panels.settings)'), false);
  await key('KeyY'); assert.equal(await evaluate('Boolean(__ui.get().panels.settings)'), true);
  const volumeBefore = await evaluate(`document.querySelector('input[aria-label="Master volume"]').value`);
  await key('ArrowLeft', 'ArrowLeft', 37);
  assert.equal(Number(await evaluate(`document.querySelector('input[aria-label="Master volume"]').value`)), Number(volumeBefore) - 1);
  await record('06-sound-retained'); await key('Escape', 'Escape', 27);
  await evaluate('__game.conn.close();true'); await until(() => evaluate('__ui.get().screen==="select"'));
  await page.call('Page.navigate', { url: 'about:blank' }); await wait(500); await start();
  assert.equal(await evaluate('document.querySelector(".slot-dash .slot-key").textContent'), 'J');
  assert.equal(await evaluate('__ui.get().chat.filter(l=>l.text.includes("F1 shows your controls")).length'), 0);
  await key('KeyY'); await click('.pn-settings .tab:nth-child(2)');
  assert.equal(await evaluate(`document.querySelector('[data-bind="interact:0"]').textContent`), 'Num9');
  await record('07-reloaded-controls');
  await click('.pn-settings .settings-content > button'); await key('Escape', 'Escape', 27);
  assert.equal(await evaluate('document.querySelector(".slot-dash .slot-key").textContent'), 'SPACE');
  await key('KeyO'); await click('.pn-settings .tab:nth-child(2)'); await record('08-reset-controls');
  const saved = await evaluate('JSON.parse(localStorage.getItem("hearthfall.bindings.v1"))');
  assert.equal(saved.values.up[0], 'KeyW'); assert.equal(saved.values.inventory[1], 'KeyB');
  observations.push({ name: 'real-input-assertions', beforeMove: before, afterMove: after,
    checks: ['conflict/cancel', 'movement and key release', 'actual dash cooldown', 'old keys inactive', 'physical Waypoint interaction', 'skills/settings toggles', 'typing suppression', 'native volume slider', 'reload', 'reset'] });
  passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure,
    scope: 'Own local game, installed Chrome, synthetic profile/saves. Real input events and game snapshots. Not a human usability or performance measurement.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Keyboard evidence: ${tmp}; captures: ${out}`);
}
