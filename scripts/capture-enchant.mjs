// UI render/lifecycle fixture, not a walk or a server transaction. Installed local Chrome only.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCharacter } from '../shared/src/character.ts';
import { generateItem } from '../shared/src/items.ts';
import { Rng } from '../shared/src/math.ts';
import { computeStats } from '../shared/src/stats.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-enchant-ui-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P03-foundations/checks/enchant-ui');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const fixture = createCharacter('EnchantUI', 'warrior', 17);
fixture.level = 70; fixture.cube.level = 8; fixture.gold = 1e9;
for (const k of Object.keys(fixture.materials)) fixture.materials[k] = 10000;
fixture.inventory[0] = generateItem(new Rng(17), { ilvl: 70, classId: 'warrior', rarity: 'legendary', legendary: 'ouroboros_loop' });
const offer = { itemId: fixture.inventory[0].id, affix: 0, options: fixture.inventory[0].affixes.slice(1, 3) };
const procs = [], channels = [], logs = [], observations = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const r = await fn(); if (r) return r; await wait(100); }
  throw new Error('Enchant UI condition timed out');
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
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      text:document.body.innerText,offer:__ui.get().enchant,artisan:__ui.get().artisan,
      disabled:document.querySelector('.cw-foot .act')?.disabled,warn:document.querySelector('.cw-warn')?.textContent})`);
    assert.equal(state.width, 1920); assert.equal(state.height, 1080); assert.equal(state.hidden, false); assert.equal(state.camera, 620);
    observations.push({ name, ...state });
    const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  await page.call('Page.navigate', { url: `http://127.0.0.1:${port}/?autostart=EnchantUI&class=warrior` });
  await until(() => evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
  await until(() => evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
  await evaluate(`__ui.set({char:${JSON.stringify(fixture)},derived:${JSON.stringify(computeStats(fixture))},enchant:${JSON.stringify(offer)},panels:{cube:true,inventory:true}});__game.openArtisan('mystic');true`);
  await wait(500);
  await evaluate(`document.querySelector('[data-drop="bag:0"]').click();true`); await wait(500);
  assert.equal(await evaluate('Boolean(document.querySelector(".cw-choosing"))'), true);
  await record('01-mystic-choice');
  await evaluate('__game.closePanels();true'); await wait(100);
  assert.deepEqual(await evaluate('__ui.get().enchant'), offer);
  await evaluate('__game.openArtisan("cube");true'); await wait(250);
  await evaluate(`[...document.querySelectorAll('.cn')].find(e=>e.querySelector('.cn-n').textContent.includes('Reforge')).click();true`);
  await wait(500);
  assert.deepEqual(await evaluate('__ui.get().enchant'), offer);
  assert.equal(await evaluate('document.querySelector(".cw-foot .act").disabled'), true);
  assert.match(await evaluate('document.querySelector(".cw-warn").textContent'), /Choose your pending enchantment at the Mystic/);
  await record('02-reforge-blocked');
  await evaluate('__game.openArtisan("mystic");true'); await wait(500);
  assert.equal(await evaluate('Boolean(document.querySelector(".cw-choosing"))'), true);
  await record('03-returned-choice');
  // Model the successful server reply. This fixture never sends crafting commands.
  await evaluate('__ui.set({enchant:null});__game.openArtisan("cube");true'); await wait(250);
  await evaluate(`[...document.querySelectorAll('.cn')].find(e=>e.querySelector('.cn-n').textContent.includes('Reforge')).click();true`); await wait(500);
  assert.equal(await evaluate('document.querySelector(".cw-foot .act").disabled'), false);
  await record('04-reforge-ready');
  await evaluate(`__ui.set({enchant:${JSON.stringify(offer)}});__game.conn.close();true`);
  await until(() => evaluate('__ui.get().screen==="select"'));
  assert.equal(await evaluate('__ui.get().enchant'), null);
  observations.push({ name: 'disconnect-clears-session-offer', passed: true }); passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure,
    scope: 'Synthetic client UI fixture on a real local Chrome session; no crafting requests, player walk, human usability or performance measurement', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join(''));
  console.log(`Enchant UI evidence: ${tmp}; captures: ${out}`);
}
