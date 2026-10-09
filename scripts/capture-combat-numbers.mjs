// Controlled local renderer/handler fixture; not server combat or a human accessibility study.
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
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-combat-numbers-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P03-foundations/checks/combat-numbers', phase.slice(2));
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [], exceptions = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const value = await fn(); if (value) return value; await wait(100); }
  throw Error('Combat-number UI condition timed out');
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
const save = createCharacter('NumbersTrace', 'mage', 31);
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
  const step = () => evaluate('__game.scene.vfx.text.update(0);__game.app.render();true');
  const read = () => evaluate(`(()=>{const t=__game.scene.vfx.text;return {count:t.count,quads:t.container.particleChildren.length,recs:t.recs.size,lanes:t.lanes.size,
    numbers:t.nums.map(n=>({amount:n.amount,px:n.px,fill:n.fill,outline:n.outline,alpha:n.alpha,prefix:n.prefix,count:n.count,kind:n.opts.kind}))}})()`);
  const spawnNumbers = () => evaluate(`const t=__game.scene.vfx.text,p=__game.world.me,random=Math.random;t.clear();Math.random=()=>.5;
    try{for(let kind=0;kind<5;kind++)t.spawn(123+kind,p.x+(kind-2)*115,p.y-95,{kind,key:kind+1,lane:kind+1});t.update(.12);}finally{Math.random=random;}
    __game.app.render();true`);
  const start = async () => {
    await page.call('Page.navigate', { url: `http://127.0.0.1:${port}/?autostart=NumbersTrace&class=mage` });
    await until(() => evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
    await until(() => evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
    await evaluate('document.activeElement?.blur();__game.app.ticker.stop();true');
  };
  const record = async name => {
    await step();
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      settings:JSON.parse(localStorage.getItem('hearthfall.preferences.v1')),text:document.body.innerText,
      panels:[...document.querySelectorAll('.pn')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})})`);
    assert.equal(state.width,1920);assert.equal(state.height,1080);assert.equal(state.hidden,false);assert.equal(state.camera,620);
    for(const p of state.panels)assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=1921&&p.y+p.h<=1081);
    observations.push({name,...state,numbers:await read()});
    const shot=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await fs.writeFile(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));console.log(`Captured ${name}`);
  };
  const toggle = async () => {
    await evaluate(`document.querySelectorAll('.settings-check').forEach(e=>{if(e.textContent==='Show combat numbers')e.setAttribute('data-numbers-setting','true')});true`);
    await click('[data-numbers-setting] input');await step();
  };
  const assertHidden = async () => assert.deepEqual(await read(),{count:0,quads:0,recs:0,lanes:0,numbers:[]});
  const feedback = () => evaluate(`(()=>{const v=__game.scene.vfx,V=v.core,ctx=V.ctx,t=v.text,p=__game.world.me,fake=987654;
    const old={pos:ctx.entityPos,view:ctx.entityView,sound:V.sound,shake:V.shake,hitStop:V.hitStop,random:Math.random};
    const calls={sounds:[],shakes:[],stops:[],hits:[]};
    ctx.entityPos=id=>id===fake?{x:p.x+60,y:p.y}:old.pos(id);
    ctx.entityView=id=>id===fake?{height:40,hit:(a,c)=>calls.hits.push([a,c])}:old.view(id);
    V.sound=(...a)=>calls.sounds.push(a);V.shake=(...a)=>calls.shakes.push(a);V.hitStop=(...a)=>calls.stops.push(a);
    V.register(fake,'mob','bonewalker',2);V.hitEma=0;V.sys.clear();t.clear();Math.random=()=>.5;
    try{
      for(const event of [{e:'dmg',t:fake,s:p.id,a:100,el:0},{e:'dmg',t:fake,s:p.id,a:1000,el:0,c:1},
        {e:'dmg',t:fake,s:p.id,a:5,el:0,dot:1},{e:'dmg',t:p.id,s:fake,a:25,el:0,p:1},{e:'heal',t:p.id,a:10}]){V.real+=1;v.handle(event);}
      t.update(.12);return {...calls,particles:V.sys.live,hitEma:V.hitEma,numbers:t.count};
    }finally{ctx.entityPos=old.pos;ctx.entityView=old.view;V.sound=old.sound;V.shake=old.shake;V.hitStop=old.hitStop;Math.random=old.random;V.forget(fake);}
  })()`);
  await start();await spawnNumbers();await record('01-default-numbers');
  const defaults=await read();assert.equal(defaults.count,5);assert.ok(defaults.quads>0);
  const visibleFeedback=await feedback();assert.equal(visibleFeedback.numbers,5);assert.equal(visibleFeedback.hitEma,100);
  assert.ok(visibleFeedback.particles>0);assert.ok(visibleFeedback.stops.length>0);assert.ok(visibleFeedback.shakes.length>0);
  observations.push({name:'visible-handler-feedback',...visibleFeedback});
  if(phase==='--after'){
    const before=JSON.parse(await fs.readFile(path.join(path.dirname(out),'before/trace.json'),'utf8'));
    assert.deepEqual(defaults,before.observations.find(o=>o.name==='01-default-numbers').numbers);
    const {name: ignoredName,...beforeFeedback}=before.observations.find(o=>o.name==='visible-handler-feedback');assert.deepEqual(visibleFeedback,beforeFeedback);
  }
  if(phase==='--after'){
    await spawnNumbers();await key();await toggle();await assertHidden();await record('02-hidden-setting');
    await evaluate('document.activeElement?.blur();true');await key();
    for(let i=0;i<5;i++){await spawnNumbers();await assertHidden();}
    const hiddenFeedback=await feedback();await assertHidden();
    const {numbers:visibleCount,...visibleEffects}=visibleFeedback,{numbers:hiddenCount,...hiddenEffects}=hiddenFeedback;
    assert.equal(hiddenCount,0);assert.deepEqual(hiddenEffects,visibleEffects);observations.push({name:'hidden-handler-feedback',...hiddenFeedback});
    await record('03-hidden-numbers');
    await evaluate('__game.app.ticker.start();__game.conn.close();true');await until(()=>evaluate('__ui.get().screen==="select"'));
    await start();await spawnNumbers();await assertHidden();await key();await record('04-retained-setting');
    await toggle();await assertHidden();await spawnNumbers();assert.deepEqual((await read()).numbers,defaults.numbers);
    await record('05-enabled-setting');
    await toggle();await assertHidden();await click('.settings-content > button');await step();
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('hearthfall.preferences.v1')).values.combatNumbers"),true);
    await spawnNumbers();assert.deepEqual((await read()).numbers,defaults.numbers);await record('06-reset-setting');
  }
  assert.deepEqual(exceptions,[]);passed=true;
} catch (error) { failure = String(error.stack ?? error); console.error(failure); process.exitCode = 1; }
finally {
  if (browser) await browser.call('Browser.close').catch(() => {});
  for (const c of channels) c.ws.close();
  if (server?.connected) { server.send('hearthfall:shutdown'); await Promise.race([new Promise(r => server.once('close', r)), wait(9000)]); }
  for (const p of procs) if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL');
  await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify({ tmp, dataDir, node: process.version, browserVersion, passed, failure, exceptions,
    scope: 'Installed local Chrome, synthetic save/profile, controlled five-style numeric fixture and actual presentation handlers. Real settings input and reconnect. No earned-drop, human accessibility, vision-simulation or performance claim.', observations }, null, 2) + '\n');
  await fs.writeFile(path.join(tmp, 'capture.log'), logs.join('')); console.log(`Combat-number UI evidence: ${tmp}`);
}
