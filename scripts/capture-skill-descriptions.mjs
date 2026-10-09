// Local Chrome skill-text verification: synthetic saved characters, actual UI rune/tier commands.
import { createCharacter } from "../shared/src/character.ts";
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-skill-ui-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P01-research/checks/skill-ui');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const r = await fn(); if (r) return r; await wait(100); }
  throw Error('Skill UI condition timed out');
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
for (const [name, cls] of [['SkillMage','mage'],['SkillWarrior','warrior']]) {
  const save=createCharacter(name,cls,31); save.level=70; save.skillPoints=69;
  await fs.writeFile(path.join(dataDir,save.id+'.json'),JSON.stringify(save));
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
      text:document.body.innerText,skills:__ui.get().char.skills,points:__ui.get().char.skillPoints,
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

  const selectText = async (selector, text) => {
    const index = await evaluate('Array.from(document.querySelectorAll('+JSON.stringify(selector)+')).findIndex(e=>e.textContent.includes('+JSON.stringify(text)+'))');
    assert.ok(index>=0, text);
    await evaluate('Array.from(document.querySelectorAll('+JSON.stringify(selector)+')).forEach((e,i)=>e.setAttribute("data-test-skill-node",String(i)));true');
    await click(`[data-test-skill-node="${index}"]`);
    await evaluate('document.querySelectorAll("[data-test-skill-node]").forEach(e=>e.removeAttribute("data-test-skill-node"));true');
  };
  const start = async (name, cls) => {
    await page.call('Page.navigate', {url: 'http://127.0.0.1:'+port+'/?autostart='+name+'&class='+cls});
    await until(()=>evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
    await until(()=>evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
    assert.equal(await evaluate('__ui.get().char.level'),70); await blur(); await key('KeyK');
  };
  const selectSkill = text => selectText('.srow',text);
  const selectRune = async (text,id,skill) => {
    await selectText('.rune',text); await until(()=>evaluate('__ui.get().char.skills.runes['+JSON.stringify(skill)+']==='+JSON.stringify(id)));
  };
  const upgrade = async skill => {
    for(let i=1;i<=3;i++) {
      await click('.tier-node.next button');
      await until(()=>evaluate('__ui.get().char.skills.tiers['+JSON.stringify(skill)+']==='+i));
    }
  };
  const description = () => evaluate('document.querySelector(".sd-desc").textContent');
  await start('SkillMage','mage'); await selectSkill('Hydra');
  await selectRune('Frost Hydra','frost_hydra','hydra');
  assert.match(await description(), /as Cold/);
  assert.match(await evaluate('document.querySelector(".rune.on p").textContent'), /shards of ice/);
  await record('01-frost-hydra');
  await selectSkill('Magic Weapon'); await selectRune('Force Weapon','force_weapon','magic_weapon');
  await upgrade('magic_weapon'); assert.match(await description(), /damage by 25% for 90 seconds/);
  await record('02-force-weapon-tier3');
  await evaluate('__game.conn.close();true'); await until(()=>evaluate('__ui.get().screen==="select"'));
  await page.call('Page.navigate',{url:'about:blank'}); await wait(300);
  await start('SkillWarrior','warrior'); await selectSkill('Battle Rage');
  await selectRune("Marauder's Rage",'marauders_rage','battle_rage'); await upgrade('battle_rage');
  assert.match(await description(), /damage by 30% and Critical Hit Chance by 3% for 90 seconds/);
  await record('03-marauder-tier3');
  await selectRune('Ferocity','ferocity','battle_rage');
  assert.match(await description(), /damage by 15% and Critical Hit Chance by 3% and Critical Hit Damage by 25% for 90 seconds/);
  await record('04-ferocity-tier3');
  assert.equal(await evaluate('__ui.get().char.skillPoints'),57);
  passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure,
    scope: 'Own local game, installed Chrome, synthetic L70 saves/profile. Actual rune selection and tier purchase UI/server requests; no client state injection. Not a human usability or performance measurement.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Skill UI evidence: ${tmp}; captures: ${out}`);
}
