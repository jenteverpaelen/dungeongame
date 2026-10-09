// Own-app local Chrome observation. Normal earned progression; explicitly assisted movement.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CollisionWorld } from '../shared/src/movement.ts';
import { TILE } from '../shared/src/constants.ts';
import { isBlockedTile } from '../shared/src/mapgen.ts';
import { canClassUse } from '../shared/src/items.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-first-decisions-'));
const dataDir = path.join(tmp, 'saves'), out = path.join(root, 'docs/phase/P01-research/checks/first-decisions');
await fs.mkdir(dataDir); await fs.mkdir(out, { recursive: true });
const procs = [], channels = [], logs = [], observations = [], fieldSamples = [];
const wait = ms => new Promise(r => setTimeout(r, ms)), startMs = performance.now();
let browser, page, server, browserVersion, passed = false, failure;
async function until(fn, timeout = 20000) {
  const end = performance.now() + timeout;
  while (performance.now() < end) { const r = await fn(); if (r) return r; await wait(100); }
  throw Error('First-decisions condition timed out');
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
// Research-only BFS over the replicated map, following the regression bot's navigation approach.
function steer(map, cw, px, py, tx, ty) {
  if (!cw.segmentBlocked(px, py, tx, ty)) return [tx - px, ty - py];
  const d = new Int32Array(map.w * map.h).fill(-1), q = new Int32Array(d.length);
  const target = Math.floor(ty / TILE) * map.w + Math.floor(tx / TILE);
  let head = 0, tail = 1; d[target] = 0; q[0] = target;
  while (head < tail) {
    const i = q[head++], x = i % map.w, y = Math.floor(i / map.w);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx, ny=y+dy, j=ny*map.w+nx;
      if(nx<0||ny<0||nx>=map.w||ny>=map.h||d[j]>=0||isBlockedTile(map.tiles[j])) continue;
      d[j]=d[i]+1; q[tail++]=j;
    }
  }
  const cx=Math.floor(px/TILE),cy=Math.floor(py/TILE); let best=d[cy*map.w+cx],bx=cx,by=cy;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const nx=cx+dx,ny=cy+dy;
    if(nx<0||ny<0||nx>=map.w||ny>=map.h)continue;
    const v=d[ny*map.w+nx]; if(v>=0&&(best<0||v<best)){best=v;bx=nx;by=ny;}
  }
  return [bx*TILE+TILE/2-px,by*TILE+TILE/2-py];
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
  const record = async (name, action) => {
    await wait(250);
    const state = await evaluate(`({width:innerWidth,height:innerHeight,hidden:document.hidden,camera:innerHeight/__game.scene.cam.zoom,
      text:document.body.innerText,char:__ui.get().char,derived:__ui.get().derived,me:__ui.get().me,zone:__ui.get().zone,
      tooltip:document.querySelector('[role=tooltip]')?.textContent,
      panels:[...document.querySelectorAll('.pn')].map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('data-panel'),x:r.x,y:r.y,w:r.width,h:r.height}})})`);
    assert.equal(state.width, 1920); assert.equal(state.height, 1080); assert.equal(state.hidden, false); assert.equal(state.camera, 620);
    for (const p of state.panels) assert.ok(p.y >= 0 && p.y+p.h <= 1081, JSON.stringify(p));
    observations.push({name,action,elapsedScriptMs:Math.round(performance.now()-startMs),...state});
    const shot = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(out, name+'.png'),Buffer.from(shot.data,'base64')); console.log(`Captured ${name}`);
  };
  const key = async (code, value=code.startsWith('Key')?code.slice(3).toLowerCase():code, vk=code.startsWith('Key')?code.charCodeAt(3):27) => {
    for (const type of ['keyDown','keyUp']) await page.call('Input.dispatchKeyEvent',{type,code,key:value,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
    await wait(200);
  };
  const point = selector => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const hover = async selector => {await page.call('Input.dispatchMouseEvent',{type:'mouseMoved',...await point(selector)});await wait(400);};
  const click = async (selector,button='left') => {
    const pos=await point(selector); await page.call('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});
    for(const type of ['mousePressed','mouseReleased']) await page.call('Input.dispatchMouseEvent',{type,button,clickCount:1,...pos});
    await wait(200);
  };
  const selectText = async (selector,text) => {
    const i=await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).findIndex(e=>e.textContent.includes(${JSON.stringify(text)}))`);
    assert.ok(i>=0,text);
    await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).forEach((e,i)=>e.setAttribute('data-audit-node',String(i)));true`);
    await click(`[data-audit-node="${i}"]`);
    await evaluate(`document.querySelectorAll('[data-audit-node]').forEach(e=>e.removeAttribute('data-audit-node'));true`);
  };
  const ready = async () => {
    await until(()=>evaluate('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));
    await until(()=>evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && !g.wanted.length && !g.timer})()'));
    await evaluate('document.activeElement?.blur();true');
  };
  await page.call('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  await until(()=>evaluate('Boolean(document.querySelector(".cs-go"))'));
  await click('canvas[data-preview="mage"]');
  await evaluate(`const n=document.querySelector('input[placeholder="Hero name"]');n.value='EarnedTrace';n.dispatchEvent(new Event('input',{bubbles:true}));true`);
  await click('.cs-go'); await ready(); assert.equal(await evaluate('__ui.get().char.level'),1);
  await key('KeyE'); await selectText('.wp-card','Whispering Glade');
  await evaluate(`document.querySelectorAll('.wp-card').forEach(e=>{if(e.textContent.includes('Whispering Glade'))e.setAttribute('data-audit-field','true')});true`);
  await click('[data-audit-field] .wp-go button');
  await until(()=>evaluate('__ui.get().zone?.kind==="field"')); await wait(800);
  await record('01-field-entry','Fresh character; normal physical Waypoint travel; no grants');
  const map=await evaluate('__game.world.map'),cw=new CollisionWorld(map);
  const fieldStart=performance.now();
  await evaluate('window.__decisionMove={x:0,y:0};window.__oldDecisionMove=__game.input.move;__game.input.move=()=>__decisionMove;document.activeElement?.blur();true');
  const readField=()=>evaluate(`({x:__game.predictor.x,y:__game.predictor.y,char:__ui.get().char,dead:__ui.get().me?.dead,
    entities:[...__game.world.entities.values()].filter(e=>!e.removed&&!e.dying).map(e=>({x:e.x,y:e.y,k:e.kind,t:e.desc.t,hp:e.hp,loot:e.desc.loot}))})`);
  const move=async (x,y)=>{const d=Math.hypot(x,y)||1;await evaluate(`__decisionMove={x:${x/d},y:${y/d}};true`);};
  let earned, lastLog=-1;
  while(performance.now()-fieldStart<120000) {
    const s=await readField(),ms=Math.round(performance.now()-fieldStart);
    const items=s.char.inventory.filter(Boolean);
    if(Math.floor(ms/1000)>lastLog){lastLog=Math.floor(ms/1000);fieldSamples.push({ms,x:s.x,y:s.y,dead:s.dead,level:s.char.level,xp:s.char.xp,gold:s.char.gold,kills:s.char.stats.kills,items:items.map(i=>i.id)});}
    earned=items.find(i=>i.reqLevel<=s.char.level&&canClassUse(s.char.classId,i));
    if(s.char.level>=3&&earned){await move(0,0);break;}
    const near=es=>es.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
    const loot=near(s.entities.filter(e=>e.k==='loot'&&e.loot?.lk==='item'));
    const mob=near(s.entities.filter(e=>e.k==='mob'&&e.hp>0));
    const target=loot??mob;
    if(target&&!s.dead){const d=Math.hypot(target.x-s.x,target.y-s.y),want=loot?5:260;
      if(d>want||cw.segmentBlocked(s.x,s.y,target.x,target.y)) await move(...steer(map,cw,s.x,s.y,target.x,target.y));else await move(0,0);
    }else await move(0,0);
    await wait(200);
  }
  await move(0,0); await record('02-earned-opportunity','End bounded assisted field observation; natural drops/levels only');
  assert.ok(earned,'No earned usable item within observation budget');
  assert.ok(await evaluate('__ui.get().char.level>=3'),'First rune/tier opportunity not reached');
  const portal=map.portals.find(s=>s.to==='hearthmere'); assert.ok(portal,'Return portal missing');
  await until(async()=>{const s=await readField();if(Math.hypot(s.x-portal.x,s.y-portal.y)<60){await move(0,0);return true;}await move(...steer(map,cw,s.x,s.y,portal.x,portal.y));return false;},45000);
  await evaluate('__decisionMove={x:0,y:0};__game.input.move=__oldDecisionMove;true');
  await key('KeyE'); await until(()=>evaluate('__ui.get().zone?.kind==="town"')); await ready();
  await key('KeyI');
  const before=await evaluate('__ui.get().char');
  const idx=before.inventory.findIndex(i=>i?.id===earned.id); assert.ok(idx>=0);
  await hover(`[data-drop="bag:${idx}"]`); await record('03-earned-item-comparison','Hover naturally acquired item before equip');
  await click(`[data-drop="bag:${idx}"]`,'right');
  await until(()=>evaluate(`Object.values(__ui.get().char.equipment).some(i=>i?.id===${JSON.stringify(earned.id)})`));
  await page.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1900,y:20});
  await record('04-equipped','Right-click equip; actual server-confirmed item identity');
  await key('Escape'); await key('KeyK'); await selectText('.srow','Magic Missile');
  const points=await evaluate('__ui.get().char.skillPoints');
  await record('05-first-skill-options','Inspect first rune and affordable tier after earned progression');
  await selectText('.rune','Seeker'); await until(()=>evaluate('__ui.get().char.skills.runes.magic_missile==="seeker"'));
  assert.equal(await evaluate('__ui.get().char.skillPoints'),points);
  await click('.tier-node.next button'); await until(()=>evaluate('__ui.get().char.skills.tiers.magic_missile===1'));
  assert.equal(await evaluate('__ui.get().char.skillPoints'),points-2);
  await record('06-rune-tier','Select first rune and buy first tier through existing controls');
  await selectText('.sk-points button','Reset Tiers'); await record('07-refund-prompt','First reset click requests confirmation; points unchanged');
  assert.equal(await evaluate('__ui.get().char.skillPoints'),points-2);
  await selectText('.srow','Meteor');
  assert.equal(await evaluate('__ui.get().char.skills.tiers.magic_missile'),1);
  await selectText('.sk-points button','Reset Tiers'); await selectText('.sk-points button','Refund');
  await until(()=>evaluate(`__ui.get().char.skillPoints===${points}`));
  assert.equal(await evaluate('__ui.get().char.skills.tiers.magic_missile??0'),0);
  assert.equal(await evaluate('__ui.get().char.skills.runes.magic_missile'),'seeker');
  await record('08-refunded','Cancel one prompt by focus change, then confirm a new refund; rune retained');
  await evaluate('__game.conn.close();true');
  await until(async()=>{try{const s=JSON.parse(await fs.readFile(path.join(dataDir,'earnedtrace.json'),'utf8'));return s.skills.runes.magic_missile==='seeker'&&s.skillPoints===points;}catch{return false;}});
  await page.call('Page.navigate',{url:`http://127.0.0.1:${port}/?autostart=EarnedTrace&class=mage`});await ready();
  assert.equal(await evaluate('__ui.get().char.skills.runes.magic_missile'),'seeker');
  assert.ok(await evaluate(`Object.values(__ui.get().char.equipment).some(i=>i?.id===${JSON.stringify(earned.id)})`));
  await key('KeyK'); await selectText('.srow','Magic Missile'); await record('09-reconnected','Normal reconnect reloads equipped item, selected rune and refunded points');
  passed=true;
} catch(error){failure=String(error.stack??error);console.error(failure);process.exitCode=1;}
finally {
  if(browser)await browser.call('Browser.close').catch(()=>{});for(const c of channels)c.ws.close();
  if(server?.connected){server.send('hearthfall:shutdown');await Promise.race([new Promise(r=>server.once('close',r)),wait(9000)]);}
  for(const p of procs)if(p.exitCode===null&&p.signalCode===null)p.kill('SIGKILL');
  await fs.writeFile(path.join(out,'trace.json'),JSON.stringify({tmp,dataDir,node:process.version,browserVersion,passed,failure,
    scope:'Own installed Chrome, fresh real-server character. Normal rewards; explicitly assisted input using replicated map/entities. Script time is not human time or a benchmark.',observations,fieldSamples},null,2)+'\n');
  await fs.writeFile(path.join(tmp,'capture.log'),logs.join(''));console.log(`First-decisions evidence: ${tmp}; captures: ${out}`);
}
