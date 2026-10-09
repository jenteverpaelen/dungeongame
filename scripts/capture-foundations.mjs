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
const out = path.join(root,'docs/phase/P03-foundations/checks');
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
  const env={...process.env,DATA_DIR:dataDir,...extra}; delete env.ENABLE_DEBUG; delete env.DISABLE_DEBUG;
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
  await evaluate('__game.conn.close(); true');await wait(300);
  await page.call('Page.navigate',{url:`http://localhost:${port}/?autostart=FutureSmoke&class=mage`});
  await until(()=>evaluate('Boolean(document.body.innerText.includes("needs a newer server version"))'));
  await shot('future-save-refused');
  assert.equal(await fs.readFile(path.join(dataDir,'futuresmoke.json'),'utf8'),future);
  const report={date:new Date().toISOString(),chrome:await browser.call('Browser.getVersion'),isolatedDataDir:dataDir,
    viewport:{width:before.width,height:before.height,hidden:before.hidden,viewHeight:before.viewHeight},
    checks:{legacyVersion:after.version,debugDenied:denied,reconnectPreserved:true,futureBytesPreserved:true},
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
