// Scripted expert audit of our own app, not a fresh-player comprehension study.
// Installed Chrome only; synthetic saves/profile; no debug grants or teleports.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { townPath } from '../server/test/townNavigation.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-first-session-'));
const controlsCheck = process.argv.includes('--controls');
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P01-research/checks', controlsCheck ? 'controls-cues' : 'first-session');
const controlsShots = new Set(['01-first-town', '03-first-skills', '12-primary-tooltip', '13-slot-tooltip', '14-returning']);
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [];
const started = performance.now(), wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) { const result = await fn(); if (result) return result; await wait(100); }
  throw new Error('First-session audit condition timed out');
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
  p.stdout.on('data', d => logs.push(String(d))); p.stderr.on('data', d => logs.push(String(d)));
  return p;
}
async function connect(url) {
  const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.reject(m.error) : p?.resolve(m.result); } };
  const channel = { ws, call: (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  }) };
  channels.push(channel); return channel;
}
try {
  const build = launch(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'client/vite.config.ts']);
  await new Promise((resolve, reject) => { build.once('error', reject); build.once('exit', code => code === 0 ? resolve() : reject(new Error(`Build exit ${code}`))); });
  server = launch(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], { PORT: String(port) }, true);
  await until(async () => { if (server.exitCode !== null) throw new Error(logs.join('')); try { return (await fetch(`http://127.0.0.1:${port}/healthz`)).ok; } catch { return false; } });
  launch('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=0',
    `--user-data-dir=${path.join(tmp, 'chrome')}`, '--window-size=1920,1080', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', 'about:blank']);
  const active = await until(async () => { try { return await fs.readFile(path.join(tmp, 'chrome/DevToolsActivePort'), 'utf8'); } catch { return false; } });
  const [cdpPort, browserPath] = active.trim().split('\n');
  browser = await connect(`ws://127.0.0.1:${cdpPort}${browserPath}`);
  browserVersion = await browser.call('Browser.getVersion');
  const tabs = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  page = await connect(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await page.call('Page.enable'); await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const r = await page.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const record = async (name, action) => {
    const state = await evaluate(`(()=>{const u=window.__ui?.get();return {width:innerWidth,height:innerHeight,hidden:document.hidden,
      text:document.body.innerText,controls:[...document.querySelectorAll('button,input')].map(e=>({text:e.innerText||e.getAttribute('aria-label')||e.placeholder,disabled:e.disabled})),
      screen:u?.screen,zone:u?.zone,char:u?.char,me:u?.me,panels:u?.panels,interact:u?.interact,
      camera:u?.screen==='game'?innerHeight/__game.scene.cam.zoom:null};})()`);
    assert.equal(state.width, 1920); assert.equal(state.height, 1080); assert.equal(state.hidden, false);
    if (state.screen === 'game') assert.equal(state.camera, 620);
    if (!controlsCheck || controlsShots.has(name)) {
      const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await fs.writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
    }
    observations.push({ name, action, elapsedScriptMs: Math.round(performance.now() - started), ...state });
    console.log(`Captured ${name}: ${state.screen}, level ${state.char?.level ?? '-'}, ${state.zone?.zone ?? '-'}`);
  };
  const key = async (key, code, keyCode) => {
    await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await wait(450);
  };
  await page.call('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until(() => evaluate('Boolean(document.querySelector(".cs-go"))')); await wait(1500);
  await record('00-class-selection', 'Fresh profile; no saved class/name, before input');
  await evaluate(`document.querySelector('canvas[data-preview="mage"]').closest('button').click();
    const n=document.querySelector('input[placeholder="Hero name"]');n.value='FirstTrace';n.dispatchEvent(new Event('input',{bubbles:true}));true`);
  await until(() => evaluate('!document.querySelector(".cs-go").disabled'));
  await evaluate('document.querySelector(".cs-go").click();true');
  await until(() => evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
  await until(() => evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
  await wait(1500); await evaluate('document.activeElement.blur();true');
  await record('01-first-town', 'Enter World through the visible class/name controls');
  if (controlsCheck) {
    assert.equal(await evaluate("document.querySelector('.slot-primary .slot-key').textContent"), 'AUTO');
    assert.equal(await evaluate("document.querySelector('.slot-dash .slot-key').textContent"), 'SPACE');
    assert.equal(await evaluate("__ui.get().chat.filter(l=>l.text==='Attacks and slotted skills are automatic.').length"), 1);
    assert.equal(await evaluate("__ui.get().chat.filter(l=>l.text.includes('F1 shows your controls')).length"), 1);
    for (const [selector, name, expected] of [
      ['.slot-primary', '12-primary-tooltip', 'Fires automatically'],
      ['.slot-skill', '13-slot-tooltip', 'slot number, not a cast key'],
    ]) {
      const rect = await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...rect }); await wait(350);
      assert.ok((await evaluate("document.querySelector('[role=tooltip]')?.textContent ?? ''")).includes(expected));
      await record(name, 'Hover the existing HUD slot; accurate automatic-combat cue');
    }
    await page.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1900, y: 20 });
  }
  await key('F1', 'F1', 112); await record('02-controls', 'Known F1 hotkey, deliberately opened by script');
  await key('Escape', 'Escape', 27);
  await key('k', 'KeyK', 75); await record('03-first-skills', 'Known K hotkey at level one');
  if (controlsCheck) {
    assert.equal(await evaluate("document.querySelector('.sslot.primary .sslot-key').textContent"), 'AUTO');
    await key('Escape', 'Escape', 27);
    await evaluate('__game.conn.close();true');
    await until(async () => { try { return JSON.parse(await fs.readFile(path.join(dataDir, 'firsttrace.json'), 'utf8')).id === 'firsttrace'; } catch { return false; } });
    await page.call('Page.reload');
    await until(() => evaluate('Boolean(document.querySelector(".cs-go"))'));
    await evaluate(`document.querySelector('canvas[data-preview="mage"]').closest('button').click();
      const n=document.querySelector('input[placeholder="Hero name"]');n.value='FirstTrace';n.dispatchEvent(new Event('input',{bubbles:true}));true`);
    await until(() => evaluate('!document.querySelector(".cs-go").disabled'));
    await evaluate('document.querySelector(".cs-go").click();true');
    await until(() => evaluate('__ui.get().screen==="game" && __ui.get().chat.some(l=>l.text.startsWith("Welcome to"))'));
    await wait(2000);
    assert.equal(await evaluate("__ui.get().chat.filter(l=>l.text==='Attacks and slotted skills are automatic.' || l.text.includes('F1 shows your controls')).length"), 0);
    await record('14-returning', 'Reconnect the same saved character through class selection; no repeated new-character hints');
    passed = true;
  } else {
  await key('Escape', 'Escape', 27);
  await key('i', 'KeyI', 73); await record('04-first-inventory', 'Known I hotkey, original starting equipment');
  await key('Escape', 'Escape', 27);
  const navigation = await evaluate('({map:__game.world.map,x:__game.predictor.x,y:__game.predictor.y})');
  const waypoint = navigation.map.town.npcs.find(n => n.role === 'waypoint');
  const route = townPath(navigation.map, [navigation.x, navigation.y], waypoint.approach);
  observations.push({ name: 'assisted-route', route, target: waypoint.id,
    method: 'Authored collision graph; analog intent through the existing input/prediction/server path; no teleport or speed change' });
  await evaluate('window.__traceOriginalMove=__game.input.move;window.__traceMove={x:0,y:0};__game.input.move=()=>__traceMove;true');
  for (const [x, y] of route) {
    await until(async () => evaluate(`(()=>{const dx=${x}-__game.predictor.x,dy=${y}-__game.predictor.y,d=Math.hypot(dx,dy);
      __traceMove=d<18?{x:0,y:0}:{x:dx/d,y:dy/d};return d<18;})()`), 120000);
  }
  await evaluate('__traceMove={x:0,y:0};__game.input.move=__traceOriginalMove;true'); await wait(500);
  await record('05-waypoint-approach', 'Walk using explicitly assisted route and ordinary movement speed');
  await key('e', 'KeyE', 69);
  await until(() => evaluate('Boolean(document.querySelector("[data-panel=waypoint]"))'));
  await record('06-waypoint', 'E beside the physical Waypoint');
  await evaluate(`const card=[...document.querySelectorAll('.wp-card')].find(e=>e.innerText.includes('Whispering Glade'));
    const go=card.querySelector('.wp-go button');if(go.disabled)throw Error('First field disabled');go.click();true`);
  await until(() => evaluate('__ui.get().zone?.kind==="field"')); await wait(2000);
  await record('07-first-field', 'Click first field travel button; no debug grants');
  await key('F1', 'F1', 112); await key('Escape', 'Escape', 27); // Dismiss any focus before movement.
  // Observe at the entrance first, then a short normal forward walk. No claim of an optimal route.
  await wait(8000); await record('08-field-idle', 'Eight scripted seconds at the field entrance');
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD' });
  await wait(3000);
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD' });
  await wait(12000); await record('09-field-after-walk', 'Three seconds eastward input, then twelve seconds observing automatic combat');
  await key('k', 'KeyK', 75); await record('10-skills-after-field', 'Inspect available skill decisions after field observation');
  await key('Escape', 'Escape', 27); await key('i', 'KeyI', 73);
  await record('11-inventory-after-field', 'Inspect collected items without scripted gear grants');
  passed = true;
  }
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) {
    server.send('hearthfall:shutdown');
    await Promise.race([new Promise(resolve => server.once('close', resolve)), wait(9000)]);
  }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, controlsCheck, passed, failure,
    scope: 'Scripted expert baseline in installed local Chrome; not a fresh-player test or reference-game visual observation', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join(''));
  console.log(`First-session evidence: ${tmp}; captures: ${out}`);
}
