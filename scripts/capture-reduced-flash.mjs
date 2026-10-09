// Own-app Chrome presentation probes and actual settings controls. No server combat claim.
import { createCharacter } from "../shared/src/character.ts";
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-flash-ui-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P03-foundations/checks/reduced-flash');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const r = await fn(); if (r) return r; await wait(100); }
  throw Error('Reduced-flash UI condition timed out');
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
const save=createCharacter('FlashTrace','mage',31);
await fs.writeFile(path.join(dataDir,save.id+'.json'),JSON.stringify(save));
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
  const record = async name => {
    await wait(300);
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      text:document.body.innerText,skills:__ui.get().char.skills,points:__ui.get().char.skillPoints,
      settings:JSON.parse(localStorage.getItem('hearthfall.preferences.v1')),probe:window.__flashProbe,
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
  const start = async () => {
    await page.call('Page.navigate', {url: 'http://127.0.0.1:'+port+'/?autostart=FlashTrace&class=mage'});
    await until(()=>evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
    await until(()=>evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
    assert.equal(await evaluate('__ui.get().char.level'),1); await blur();
  };
  const toggle = async () => {
    await evaluate(`document.querySelectorAll('.settings-check').forEach(e=>{if(e.textContent==='Reduce flashes')e.setAttribute('data-flash-setting','true')});true`);
    await click('[data-flash-setting] input');
  };
  await start(); await key('KeyO'); await record('01-default-setting');
  assert.equal(await evaluate("[...document.querySelectorAll('.settings-check')].find(e=>e.textContent==='Reduce flashes').querySelector('input').checked"),false);
  await evaluate(`__game.app.ticker.stop();
    window.__flashCore=__game.scene.vfx.core;window.__flashSounds=[];
    const sound=__flashCore.sound;__flashCore.sound=function(...args){__flashSounds.push(args[0]);return sound.apply(this,args)};
    window.__flashRead=()=>({visible:__flashCore.sys.aFlash.container.visible,celebrations:__flashCore.sys.layers.flatMap(l=>l.list).filter(p=>p.celebration).length,
      particles:__flashCore.sys.live,telegraphs:__flashCore.teleLayer.children.length,projectiles:__game.scene.vfx.projs.count,sounds:[...__flashSounds]});
    window.__flashStep=()=>{__game.frame(16);__game.app.render()};
    __game.onEvent({e:'level',t:__game.world.myId,lv:1});
    const p=__game.world.me;__game.scene.vfx.handle({e:'tele',v:'boss_ring',x:p.x+140,y:p.y+50,r:90,d:2000});
    __flashCore.sys.update(.12);__flashStep();window.__flashProbe=__flashRead();true`);
  let probe=await evaluate('__flashProbe');assert.ok(probe.celebrations>0);assert.equal(probe.visible,true);assert.ok(probe.telegraphs>0);assert.ok(probe.sounds.includes('level'));
  await record('02-default-burst-warning');
  await toggle();await evaluate('__flashStep();window.__flashProbe=__flashRead();true');
  probe=await evaluate('__flashProbe');assert.equal(probe.celebrations,0);assert.equal(probe.visible,false);assert.ok(probe.telegraphs>0);
  await record('03-existing-burst-hidden');
  await key('Escape');
  // Repeat level and Paragon while enabled; the renderer and notification paths execute, not the server reward paths.
  await evaluate(`__game.onEvent({e:'level',t:__game.world.myId,lv:1});__game.onEvent({e:'paragon',t:__game.world.myId,lv:0});
    const p=__game.world.me;__game.scene.vfx.handle({e:'proj',id:987654,s:p.id,v:'missile',x:p.x-140,y:p.y-60,vx:80,vy:0,life:2,el:5});
    __game.scene.vfx.handle({e:'dmg',s:p.id,t:p.id,a:12,el:0});
    __flashStep();window.__flashProbe=__flashRead();true`);
  probe=await evaluate('__flashProbe');assert.equal(probe.celebrations,0);assert.equal(probe.visible,false);assert.ok(probe.telegraphs>0);assert.ok(probe.projectiles>0);assert.ok(probe.sounds.includes('paragon'));
  assert.equal(await evaluate('__ui.get().char.level'),1);assert.equal(await evaluate('__ui.get().char.paragon.level'),0);
  await record('04-reduced-warning-projectile-text');
  // Render-path invariants with controlled presentation objects; no entity/save grant to server.
  await evaluate(`window.__fixtureMob=__game.scene.createView({id:987655,k:'mob',t:'bonewalker',lv:1,el:0});
    window.__fixtureState={x:0,y:0,vx:0,vy:0,moving:false,facingLeft:false,flags:0,attackSeq:0,hpFrac:1,time:0,aps:1};
    const hero=__game.world.me.view;hero.hit(1,true);hero.update(0,__fixtureState);
    __fixtureMob.hit(1,true);__fixtureMob.update(0,__fixtureState);
    const s=__flashCore.sys,p=s.aAdd.add(s.T.glow,0,0,2);p.flick=.4;p.a0=1;p.fi=0;p.fo=1;
    s.aAdd.update(.05);const a=p.color>>>24;s.aAdd.update(.05);const b=p.color>>>24;
    const marker=__flashCore.teleLayer.children[0];const beforeScale=marker.children[1].scale.x;
    for(let i=0;i<14;i++)__game.scene.vfx.update(100);
    window.__flashProbe={...__flashRead(),heroFlash:hero.flashing,mobFlash:__fixtureMob.p.flashing,heroHit:hero.hitK,mobHit:__fixtureMob.hitK,
      flickerAlpha:[a,b],warningAlpha:marker.children[0].alpha,warningProgress:[beforeScale,marker.children[1].scale.x]};true`);
  probe=await evaluate('__flashProbe');assert.equal(probe.heroFlash,false);assert.equal(probe.mobFlash,false);assert.ok(probe.heroHit>0);assert.ok(probe.mobHit>0);
  assert.deepEqual(probe.flickerAlpha,[153,153]);assert.equal(probe.warningAlpha,1);assert.ok(probe.warningProgress[1]>probe.warningProgress[0]);observations.push({name:'render-invariants',...probe});
  await key('KeyO');await record('05-enabled-setting');
  await toggle();
  await evaluate(`const h=__game.world.me.view;h.hit(1,true);h.update(0,__fixtureState);__fixtureMob.hit(1,true);__fixtureMob.update(0,__fixtureState);
    __game.scene.vfx.handle({e:'level',t:__game.world.myId,lv:1});__flashCore.sys.update(.05);
    window.__flashProbe={...__flashRead(),heroFlash:h.flashing,mobFlash:__fixtureMob.p.flashing};true`);
  probe=await evaluate('__flashProbe');assert.equal(probe.heroFlash,true);assert.equal(probe.mobFlash,true);assert.equal(probe.visible,true);assert.ok(probe.celebrations>0);observations.push({name:'default-restored',...probe});
  await toggle();await evaluate('__fixtureMob.destroy();__game.app.ticker.start();true');
  await evaluate('__game.conn.close();true');await until(()=>evaluate('__ui.get().screen==="select"'));
  await start();await key('KeyO');
  assert.equal(await evaluate("[...document.querySelectorAll('.settings-check')].find(e=>e.textContent==='Reduce flashes').querySelector('input').checked"),true);
  assert.equal(await evaluate('__game.scene.vfx.core.sys.aFlash.container.visible'),false);
  await record('06-reloaded-setting');
  await selectText('.settings-content button','Restore defaults');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('hearthfall.preferences.v1')).values.reduceFlashes"),false);
  await until(()=>evaluate('__game.scene.vfx.core.sys.aFlash.container.visible'));await record('07-restored-defaults');
  passed = true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure,
    scope: 'Own local game, installed Chrome, synthetic L1 save/profile. Actual settings controls/reload; injected presentation events and controlled renderer steps explicitly test visuals only, not server-earned rewards, human usability, photosensitivity thresholds or performance.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Reduced-flash UI evidence: ${tmp}; captures: ${out}`);
}
