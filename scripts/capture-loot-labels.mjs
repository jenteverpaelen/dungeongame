// Controlled local renderer fixture; not server-earned drops or a human accessibility study.
import { createCharacter } from '../shared/src/character.ts';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const phase = process.argv[2];
assert.ok(['--before', '--after'].includes(phase));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-loot-labels-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P03-foundations/checks/loot-labels', phase.slice(2));
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [], exceptions = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const value = await fn(); if (value) return value; await wait(100); }
  throw Error('Loot-label UI condition timed out');
}
const port = await new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
function launch(exe, args, env = {}, ipc = false) {
  const p = spawn(exe, args, { cwd: root, windowsHide: true,
    env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: '', ENABLE_DEBUG: '0', DISABLE_DEBUG: '0', WS_ALLOWED_ORIGINS: undefined, ...env },
    stdio: ['ignore', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  procs.push(p); p.on('error', e => logs.push(String(e)));
  p.stdout.on('data', d => logs.push(String(d))); p.stderr.on('data', d => logs.push(String(d))); return p;
}
async function connect(url) {
  const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.reject(m.error) : p?.resolve(m.result); }
  };
  const c = { ws, call: (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  }) }; channels.push(c); return c;
}
const save = createCharacter('QualityTrace', 'mage', 31);
await fs.writeFile(path.join(dataDir, save.id + '.json'), JSON.stringify(save));
const qualities = ['Normal', 'Magic', 'Rare', 'Legendary', 'Set', 'Ancient Legendary', 'Primal Ancient Legendary', 'Ancient Set', 'Primal Ancient Set'];
const variants = [['normal', 0], ['magic', 0], ['rare', 0], ['legendary', 0], ['set', 0], ['legendary', 1], ['legendary', 2], ['set', 1], ['set', 2]];
const fixtures = variants.map(([rarity, ancient]) => ({ lk: 'item', name: 'Quality probe', kind: 'weapon1h', rarity, ancient }));
fixtures.push({ lk: 'gem', name: 'Ruby probe', gem: 'ruby:1' }, { lk: 'mat', name: 'Material probe' },
  { lk: 'item', name: 'Long named item of the distant forgotten watch', kind: 'head', rarity: 'rare', ancient: 0 });
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
    const r = await page.call('Runtime.evaluate', { expression: `{${expression}\n}`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const key = async () => {
    for (const type of ['keyDown', 'keyUp']) await page.call('Input.dispatchKeyEvent', { type, code: 'KeyO', key: 'o', windowsVirtualKeyCode: 79, nativeVirtualKeyCode: 79 });
    await wait(120);
  };
  const click = async selector => {
    const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
    for (const type of ['mousePressed', 'mouseReleased']) await page.call('Input.dispatchMouseEvent', { type, button: 'left', clickCount: 1, ...box });
    await wait(120);
  };
  const step = () => evaluate('__game.scene.vfx.loot.update(0);__game.app.render();true');
  const read = () => evaluate(`window.__qualityViews.map(v=>{const t=v.label.children.find(c=>typeof c.text==='string'),r=v.label.getBounds();return {text:t.text,tint:t.tint,width:v.labelW,height:v.labelH,children:v.label.children.length,x:r.x,y:r.y,w:r.width,h:r.height,visible:v.label.visible}})`);
  const record = async name => {
    await step(); await wait(100);
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      settings:JSON.parse(localStorage.getItem('hearthfall.preferences.v1')),text:document.body.innerText,
      panels:[...document.querySelectorAll('.pn')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})})`);
    assert.equal(state.width, 1920); assert.equal(state.height, 1080); assert.equal(state.hidden, false); assert.equal(state.camera, 620);
    for (const p of state.panels) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1921 && p.y + p.h <= 1081);
    observations.push({ name, ...state, labels: await read() });
    const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64')); console.log(`Captured ${name}`);
  };
  const start = async () => {
    await page.call('Page.navigate', { url: `http://127.0.0.1:${port}/?autostart=QualityTrace&class=mage` });
    await until(() => evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
    await until(() => evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
    await evaluate('document.activeElement?.blur();__game.app.ticker.stop();true');
    await evaluate(`const scene=__game.scene,p=__game.world.me;scene.vfx.core.zoneAge=0;
      window.__qualityViews=${JSON.stringify(fixtures)}.map((loot,i)=>{const view=scene.vfx.createLootView({id:900000+i,k:'loot',t:loot.lk,r:8,loot});
        const x=p.x+(i%3-1)*290,y=p.y-135+Math.floor(i/3)*85;view.root.position.set(x,y);view.root.zIndex=y;scene.entities.addChild(view.root);
        view.update(0,{x,y,vx:0,vy:0,moving:false,facingLeft:false,flags:0,attackSeq:0,hpFrac:1,time:0,aps:1});return view});true`);
    await step();
  };
  const toggle = async () => {
    await evaluate(`document.querySelectorAll('.settings-check').forEach(e=>{if(e.textContent==='Show loot quality')e.setAttribute('data-quality-setting','true')});true`);
    await click('[data-quality-setting] input'); await step();
  };
  const assertDefault = async () => assert.deepEqual((await read()).map(l => l.text), fixtures.map(f => f.name));
  const assertEnabled = async () => {
    const labels = await read();
    assert.deepEqual(labels.map(l => l.text), [...qualities.map(q => `[${q}] Quality probe`), 'Ruby probe', 'Material probe', `[Rare] ${fixtures[11].name}`]);
    assert.ok(labels.every(l => l.children === 2 && l.visible));
  };
  await start(); await assertDefault(); await record('01-default-labels');
  const defaultLabels = await read();
  if (phase === '--after') {
    const before = JSON.parse(await fs.readFile(path.join(path.dirname(out), 'before/trace.json'), 'utf8'));
    const baseline = before.observations.find(o => o.name === '01-default-labels').labels;
    const appearance = labels => labels.map(({ text, tint, width, height, children }) => ({ text, tint, width, height, children }));
    assert.deepEqual(appearance(defaultLabels), appearance(baseline));
    await key(); await toggle(); await assertEnabled(); await record('02-enabled-setting');
    await evaluate('document.activeElement?.blur();true'); await key(); await record('03-enabled-labels');
    for (let i = 0; i < 5; i++) {
      await key(); await toggle(); await assertDefault(); await toggle(); await assertEnabled();
      await evaluate('document.activeElement?.blur();true'); await key();
    }
    await evaluate(`const p=__game.world.me;__qualityViews.forEach((v,i)=>{v.root.position.set(p.x+(i%3)*7,p.y+125+Math.floor(i/3)*5)});true`);
    await step(); const dense = await read();
    for (let i = 0; i < dense.length; i++) {
      const a = dense[i]; assert.ok(a.x >= 0 && a.y >= 0 && a.x+a.w <= 1921 && a.y+a.h <= 1081);
      for (let j = i+1; j < dense.length; j++) { const b=dense[j]; assert.ok(a.x+a.w <= b.x+.2 || b.x+b.w <= a.x+.2 || a.y+a.h <= b.y+.2 || b.y+b.h <= a.y+.2, `Overlapping labels ${i}/${j}`); }
    }
    await record('04-dense-labels');
    await evaluate('__qualityViews.forEach(v=>v.destroy());__game.app.ticker.start();__game.conn.close();true');
    await until(() => evaluate('__ui.get().screen==="select"'));
    await start(); await assertEnabled(); await key(); await record('05-retained-setting');
    await click('.settings-content > button'); await step(); await assertDefault();
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('hearthfall.preferences.v1')).values.lootQualityLabels"), false);
    await record('06-reset-setting');
  }
  assert.deepEqual(exceptions, []); passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure, exceptions,
    scope: 'Installed local Chrome, synthetic save/profile, controlled twelve-view presentation fixture. Real settings input and reconnect. No earned-drop, human accessibility, vision-simulation or performance claim.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Loot-label UI evidence: ${tmp}`);
}
