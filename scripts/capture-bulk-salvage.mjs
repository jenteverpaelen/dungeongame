// Actual local browser/server bulk salvage, generated gear and ordinary movement; not human usability or performance.
import { createCharacter } from '../shared/src/character.ts';
import { generateItem } from '../shared/src/items.ts';
import { Rng } from '../shared/src/math.ts';
import { townPath } from '../server/test/townNavigation.ts';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-bulk-salvage-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P03-foundations/checks/bulk-salvage/ui');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [], exceptions = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const value = await fn(); if (value) return value; await wait(100); }
  throw Error('Bulk-salvage UI condition timed out');
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
const save = createCharacter('BulkTrace', 'mage', 31), rng = new Rng(71);
save.level = 70; save.cube.level = 8;
for (const [i, rarity] of ['normal', 'magic', 'rare', 'legendary', 'set'].entries()) {
  save.inventory[i] = generateItem(rng, { ilvl: 70, classId: 'mage', rarity, ancientAllowed: false });
}
await fs.writeFile(path.join(dataDir, save.id + '.json'), JSON.stringify(save));
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
  const click = async selector => {
    const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
    for (const type of ['mousePressed', 'mouseReleased']) await page.call('Input.dispatchMouseEvent', { type, button: 'left', clickCount: 1, ...box });
    await wait(120);
  };
  const record = async name => {
    await wait(200);
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      text:document.body.innerText,char:__ui.get().char,menu:document.querySelector('.salvage-menu')?.innerText,
      panels:[...document.querySelectorAll('.pn')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})})`);
    assert.equal(state.width,1920);assert.equal(state.height,1080);assert.equal(state.hidden,false);assert.equal(state.camera,620);
    for(const p of state.panels)assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=1921&&p.y+p.h<=1081);
    observations.push({name,...state});
    const shot=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await fs.writeFile(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));console.log(`Captured ${name}`);
  };
  await page.call('Page.navigate', {url:`http://127.0.0.1:${port}/?autostart=BulkTrace&class=mage`});
  await until(()=>evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
  await until(()=>evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
  const before = await evaluate('__ui.get().char');
  assert.equal(before.inventory.filter(Boolean).length,5);
  const far = await evaluate("__cmd('salvageAll',{rarities:['normal']})");assert.equal(far.ok,false);assert.match(far.err,/Stand beside/);
  const map=await evaluate('__game.world.map'), start=await evaluate('[__game.predictor.x,__game.predictor.y]');
  const target=map.town.npcs.find(n=>n.role==='blacksmith').approach;
  const route=townPath(map,start,target);observations.push({name:'physical-route',start,target,route});
  await evaluate('window.__bulkMove={x:0,y:0};window.__oldBulkMove=__game.input.move;__game.input.move=()=>__bulkMove;document.activeElement?.blur();true');
  for(const [x,y] of route) {
    await until(async()=>{
      const p=await evaluate('({x:__game.predictor.x,y:__game.predictor.y})'),dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);
      if(d<12){await evaluate('__bulkMove={x:0,y:0};true');return true;}
      await evaluate(`__bulkMove={x:${dx/d},y:${dy/d}};true`);return false;
    },45000);
  }
  await evaluate('__bulkMove={x:0,y:0};__game.input.move=__oldBulkMove;document.activeElement?.blur();true');await wait(250);
  for(const type of ['keyDown','keyUp'])await page.call('Input.dispatchKeyEvent',{type,code:'KeyI',key:'i',windowsVirtualKeyCode:73,nativeVirtualKeyCode:73});
  await until(()=>evaluate("Boolean(document.querySelector('.bag-bar'))"));
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Salvage All').setAttribute('data-open-salvage','true');true");
  await click('[data-open-salvage]');
  await until(()=>evaluate("Boolean(document.querySelector('.salvage-menu'))"));
  const labels=await evaluate("[...document.querySelectorAll('.salvage-menu .rar-name')].map(e=>e.textContent)");assert.deepEqual(labels,['Normal','Magic','Rare']);
  assert.equal(await evaluate("document.querySelector('.menu-act .primary').textContent.trim()"),'Salvage 2');
  await record('01-existing-bulk-menu');
  const bad = await evaluate("__cmd('salvageAll',{rarities:['normal','legendary']})");assert.equal(bad.ok,false);
  const rejected=await evaluate('__ui.get().char');
  for(const field of ['inventory','stash','equipment','gems','materials','cube'])assert.deepEqual(rejected[field],before[field]);
  observations.push({name:'mixed-request-rejected',reply:bad});
  await click('.menu-act .primary');
  await until(()=>evaluate('__ui.get().char.inventory.filter(Boolean).length===3'));
  const after=await evaluate('__ui.get().char');
  assert.deepEqual(after.inventory.filter(Boolean).map(i=>i.id),before.inventory.slice(2,5).map(i=>i.id));
  assert.deepEqual(after.materials,{...before.materials,scrap:before.materials.scrap+3,dust:before.materials.dust+3});
  await record('02-after-bulk');
  await evaluate('__game.conn.close();true');await until(()=>evaluate('__ui.get().screen==="select"'));
  await evaluate('__game.start("BulkTrace","mage");true');await until(()=>evaluate('__ui.get().screen==="game"'));
  const reload=await evaluate('__ui.get().char');
  for(const field of ['inventory','stash','equipment','gems','materials','cube'])assert.deepEqual(reload[field],after[field]);
  observations.push({name:'reconnect-preserved-result',passed:true});
  assert.deepEqual(exceptions,[]);passed=true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure, exceptions,
    scope: 'Installed local Chrome and real local server; synthetic generated gear, ordinary movement to Blacksmith, actual menu click, rejected mixed request and reconnect. No earned-loot, human usability or performance claim.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Bulk-salvage UI evidence: ${tmp}`);
}
