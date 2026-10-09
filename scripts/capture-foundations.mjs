// Local installed Chrome, synthetic saves, real server. No reference media or browser profile downloads.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-foundation-browser-'));
const dataDir = path.join(tmp,'saves');
const settingsMode = process.argv.includes('--settings');
const out = path.join(root,'docs/phase/P03-foundations/checks',settingsMode?'settings':'.');
await fs.mkdir(dataDir,{recursive:true}); await fs.mkdir(out,{recursive:true});
const old = JSON.parse(await fs.readFile(path.join(root,'server/test/fixtures/saves/v0-unversioned.json'),'utf8'));
old.id='legacysmoke'; old.name='LegacySmoke'; old.lastSeen=Date.now(); old.lastZone='hearthmere';
await fs.writeFile(path.join(dataDir,'legacysmoke.json'),JSON.stringify(old));
const future = JSON.stringify({version:999,displayName:'FutureSmoke',classId:'future-class'});
await fs.writeFile(path.join(dataDir,'futuresmoke.json'),future);
const port = await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const procs=[], logs=[], channels=[];
const wait = ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=120000){const start=Date.now();while(Date.now()-start<timeout){const v=await fn();if(v)return v;await wait(200);}throw Error('Readiness timeout');}
function launch(exe,args,extra={}) {
  const env={...process.env,BACKUP_DIR:'',DATA_DIR:dataDir,...extra}; delete env.ENABLE_DEBUG; delete env.DISABLE_DEBUG;
  const p=spawn(exe,args,{cwd:root,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
  procs.push(p); for(const s of [p.stdout,p.stderr])s.on('data',d=>logs.push(String(d)));
  return p;
}
async function connect(url){
  const ws=new WebSocket(url); await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const h=pending.get(m.id);pending.delete(m.id);m.error?h?.reject(m.error):h?.resolve(m.result);}};
  const c={ws,call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};
  channels.push(c);return c;
}
let browser;
try {
  // The real server serves dist/client; always capture the current source.
  const build=launch(process.execPath,['node_modules/vite/bin/vite.js','build','--config','client/vite.config.ts']);
  await new Promise((resolve,reject)=>{build.on('error',reject);build.on('exit',code=>code===0?resolve():reject(Error('Client build failed: '+code)));});
  const server=launch(process.execPath,['--import','tsx','server/src/main.ts'],{PORT:String(port)});
  await until(async()=>{if(server.exitCode!==null)throw Error('Server exited');try{return(await fetch(`http://localhost:${port}/healthz`)).ok;}catch{return false;}});
  launch('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${path.join(tmp,'chrome')}`,'--window-size=1920,1080','--force-device-scale-factor=1','--no-first-run','--no-default-browser-check','about:blank']);
  const active=await until(async()=>{try{return await fs.readFile(path.join(tmp,'chrome/DevToolsActivePort'),'utf8');}catch{return false;}});
  const [cdpPort,browserPath]=active.trim().split('\n');browser=await connect(`ws://127.0.0.1:${cdpPort}${browserPath}`);
  const tabs=await(await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const page=await connect(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await page.call('Page.enable');await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  const evaluate=async(expression,awaitPromise=false)=>{const r=await page.call('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const ready=()=>until(()=>evaluate('Boolean(window.__game?.world?.map && __ui.get().screen === "game")'));
  const shot=async(name)=>{const r=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
  await page.call('Page.navigate',{url:`http://localhost:${port}/?autostart=LegacySmoke&class=mage`});await ready();
  await until(()=>evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles && g.wanted.length===0 && !g.timer})()'));
  await wait(2000);
  const before=await evaluate('({char:__ui.get().char,hidden:document.hidden,width:innerWidth,height:innerHeight,viewHeight:innerHeight/__game.scene.cam.zoom})');
  assert.equal(before.hidden,false);assert.equal(before.width,1920);assert.equal(before.height,1080);assert.equal(before.viewHeight,620);
  assert.equal(before.char.version,1);
  const denied=await evaluate('__game.conn.cmd("debug",{op:"gold",n:999999,admin:true,ENABLE_DEBUG:"1"})',true);
  assert.equal(denied.ok,false);assert.match(denied.err,/disabled/);
  assert.equal(await evaluate('__ui.get().char.gold'),before.char.gold);
  await shot('legacy-town');
  await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'i',code:'KeyI'});
  await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'i',code:'KeyI'});
  await until(()=>evaluate('Boolean(document.querySelector("[data-panel=inventory]"))'));
  await shot('legacy-inventory');
  await evaluate('__game.conn.close(); true');
  await until(async()=>JSON.parse(await fs.readFile(path.join(dataDir,'legacysmoke.json'),'utf8')).version===1);
  await page.call('Page.reload');await ready();
  const after=await evaluate('__ui.get().char');
  for(const k of ['equipment','inventory','stash','gold','xp','paragon','cube'])assert.deepEqual(after[k],before.char[k],k);
  let settingsChecks;
  if(settingsMode) {
    const key=async(key,code,keyCode)=>{
      await page.call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
      await page.call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
      await wait(100);
    };
    const snapshot=()=>evaluate('({audio:__game.audio.inspect(),stored:JSON.parse(localStorage.getItem("hearthfall.preferences.v1")),viewHeight:innerHeight/__game.scene.cam.zoom,hidden:document.hidden})');
    // Keep both effect buses processing: Chrome can leave .value stale on a
    // disconnected, idle AudioParam. Quiet synthetic probes affect this test only.
    const probes=()=>evaluate('window.__gainProbes=["effects","priorityEffects"].map(k=>{const e=__game.audio.eng,s=e.ctx.createConstantSource();s.offset.value=.00001;s.connect(e[k]);s.start();return s;});true');
    const setRange=async(label,value)=>{
      await evaluate(`(()=>{const e=document.querySelector('input[aria-label="${label}"]');e.value=${value};e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
      await wait(350);
    };
    await key('o','KeyO',79);
    await until(()=>evaluate('Boolean(document.querySelector("[data-panel=settings]"))'));
    await key('End','End',35);await wait(500);
    await until(()=>evaluate('__game.audio.inspect().state==="running"'));
    await probes();
    assert.ok(Math.abs((await snapshot()).audio.master-1)<.002,'keyboard slider changes live gain');
    await key('ArrowLeft','ArrowLeft',37);await wait(350);
    assert.ok(Math.abs((await snapshot()).audio.master-.99)<.002,'arrow adjusts slider');
    assert.deepEqual(await evaluate('__game.input.move()'),{x:0,y:0},'slider arrow must not move');
    await evaluate('document.activeElement.blur();true');
    await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});
    assert.equal((await evaluate('__game.input.move()')).y,-1);
    await evaluate('document.querySelector("input[aria-label=Effects]").focus();true');
    assert.deepEqual(await evaluate('__game.input.move()'),{x:0,y:0},'focusing a control clears held movement');
    await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});
    await setRange('Master volume',40);await setRange('Effects',25);await setRange('Ambience',70);
    await until(async()=>{const s=await snapshot();return Math.abs(s.audio.categories.effects-.25)<.002 && Math.abs(s.audio.categories.priorityEffects-.25)<.002 && Math.abs(s.audio.categories.ambience-.7)<.002;},5000);
    await evaluate('window.__settingsDashes=0;const dash=__game.input.h.onDash;__game.input.h.onDash=()=>{__settingsDashes++;dash();};document.querySelector(".settings-check input").focus();true');
    await key(' ','Space',32);await setRange('Master volume',60);
    const muted=await snapshot();assert.ok(muted.audio.master<.002,'slider cannot unmute');assert.equal(muted.audio.muted,true);
    assert.equal(await evaluate('__settingsDashes'),0,'checkbox keyboard action must not dash');
    await evaluate('document.querySelectorAll(".settings-check input")[1].focus();true');await key(' ','Space',32);
    await evaluate('__game.scene.shake(30,2000);true');await wait(100);
    const shakeOff=await evaluate('(()=>{const s=__game.scene;return{shakeRemaining:s.shakeEnd-performance.now(),offsetX:s.root.x-Math.round(innerWidth/2-s.cam.x*s.cam.zoom),offsetY:s.root.y-Math.round(innerHeight/2-s.cam.y*s.cam.zoom)}})()');
    assert.ok(shakeOff.shakeRemaining<0);assert.equal(shakeOff.offsetX,0);assert.equal(shakeOff.offsetY,0);
    await shot('settings-custom');
    await page.call('Page.reload');await ready();await key('o','KeyO',79);await wait(700);
    await until(()=>evaluate('__game.audio.inspect().state==="running"'));await probes();
    const reloaded=await snapshot();assert.equal(reloaded.stored.values.cameraShake,false);assert.equal(reloaded.audio.muted,true);
    assert.ok(reloaded.audio.master<.002);assert.ok(Math.abs(reloaded.audio.categories.effects-.25)<.002);
    assert.ok(Math.abs(reloaded.audio.categories.priorityEffects-.25)<.002);assert.ok(Math.abs(reloaded.audio.categories.ambience-.7)<.002);
    assert.equal(reloaded.viewHeight,620);assert.equal(reloaded.hidden,false);
    await shot('settings-reloaded');
    await evaluate('window.__settingsDashes=0;const dash=__game.input.h.onDash;__game.input.h.onDash=()=>{__settingsDashes++;dash();};document.querySelector(".settings-content button").focus();true');
    await key(' ','Space',32);await wait(350);
    assert.equal(await evaluate('__settingsDashes'),0,'button keyboard action must not dash');
    await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});
    assert.equal((await evaluate('__game.input.move()')).y,-1,'ordinary focused button must not trap movement');
    await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});
    await until(async()=>{const s=await snapshot();return s.audio.state==='running' && Math.abs(s.audio.categories.effects-1)<.002 && Math.abs(s.audio.categories.ambience-1)<.002;},5000);
    const defaults=await snapshot();assert.equal(defaults.stored.values.cameraShake,true);assert.equal(defaults.audio.muted,false);
    assert.ok(Math.abs(defaults.audio.master-.8)<.002);assert.ok(Math.abs(defaults.audio.categories.effects-1)<.002);assert.ok(Math.abs(defaults.audio.categories.ambience-1)<.002);
    await shot('settings-defaults');await key('Escape','Escape',27);
    assert.equal(await evaluate('Boolean(document.querySelector("[data-panel=settings]"))'),false);
    await key('F1','F1',112);
    await evaluate('document.querySelector(".help-panel button.btn").click();true');
    assert.equal(await evaluate('Boolean(document.querySelector("[data-panel=settings]"))'),true);
    await wait(400);
    await shot('settings-from-help');
    await evaluate('__gainProbes.forEach(s=>{s.stop();s.disconnect();});true');
    settingsChecks={muted,reloaded,defaults,shakeOff,keyboardControlsNoDash:true,sliderArrowNoMovement:true,focusClearsMovement:true,buttonFocusAllowsMovement:true,escapeCloses:true,helpEntry:true};
  }
  await evaluate('__game.conn.close(); true');await wait(300);
  await page.call('Page.navigate',{url:`http://localhost:${port}/?autostart=FutureSmoke&class=mage`});
  await until(()=>evaluate('Boolean(document.body.innerText.includes("needs a newer server version"))'));
  await wait(2000); // Let the existing login entrance animation finish before visual review.
  await shot('future-save-refused');
  assert.equal(await fs.readFile(path.join(dataDir,'futuresmoke.json'),'utf8'),future);
  const report={date:new Date().toISOString(),chrome:await browser.call('Browser.getVersion'),isolatedDataDir:dataDir,
    viewport:{width:before.width,height:before.height,hidden:before.hidden,viewHeight:before.viewHeight},
    checks:{legacyVersion:after.version,debugDenied:denied,reconnectPreserved:true,futureBytesPreserved:true},settingsChecks,
    scope:'Functional screenshots; not a performance or accessibility certification'};
  await fs.writeFile(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} catch(e){await fs.writeFile(path.join(tmp,'error.log'),String(e)+'\n'+logs.join(''));console.error(e);process.exitCode=1;}
finally {
  if(browser)try{await browser.call('Browser.close');}catch{}
  for(const c of channels)c.ws.close();
  for(const p of procs)if(p.exitCode===null)p.kill();
  console.log('Owned test processes stopped; synthetic data at '+tmp);
}
