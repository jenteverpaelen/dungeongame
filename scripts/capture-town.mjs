import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
for (const port of [2577]) await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,()=>s.close(resolve));});
const repo = 'C:/Users/LaptopJente/dungeongame';
const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hf-m1-capture-'));
const out = path.join(repo,'docs/town');
await fs.mkdir(path.join(out,'tour'),{recursive:true});
const procs=[]; const logs=[];
const wait = ms => new Promise(r=>setTimeout(r,ms));
function launch(exe,args,env={}) { const p=spawn(exe,args,{cwd:repo,windowsHide:true,env:{...process.env,DATA_DIR:path.join(tmp,'saves'),...env},stdio:['ignore','pipe','pipe']}); procs.push(p); p.stdout.on('data',d=>logs.push(String(d)));p.stderr.on('data',d=>logs.push(String(d)));return p; }
async function cdp(url) {const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const q=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const h=q.get(m.id);q.delete(m.id);m.error?h?.reject(m.error):h?.resolve(m.result);}};return {ws,call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;q.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};}
async function until(f,n=150){for(let i=0;i<n;i++){try{const v=await f();if(v)return v}catch{}await wait(200)}throw Error('Timed out waiting for readiness');}
let browser;
try {
launch(process.execPath,['--import','tsx','server/src/main.ts'],{PORT:'2577'});
await until(async()=> (await fetch('http://localhost:2577/healthz')).ok);
launch('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+path.join(tmp,'chrome'),'--window-size=1920,1080','--force-device-scale-factor=1','--no-first-run','--no-default-browser-check','about:blank']);
const active=await until(async()=>await fs.readFile(path.join(tmp,'chrome','DevToolsActivePort'),'utf8'));
const [port,browserPath]=active.trim().split('\n');browser=await cdp('ws://127.0.0.1:'+port+browserPath);
const version=await browser.call('Browser.getVersion');const system=await browser.call('SystemInfo.getInfo');
const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const page=await cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await page.call('Page.enable');await page.call('Runtime.enable');await page.call('Performance.enable');
await page.call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const evaluate=async(expression,awaitPromise=false)=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
await page.call('Page.navigate',{url:'http://localhost:2577/?autostart=M1Blockout&class=warrior'});
await until(()=>evaluate('Boolean(window.__game?.world?.map && window.__ui?.get().screen === "game")'));
await wait(5000);
const actual=await evaluate('({hidden:document.hidden,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,zone:__game.world.map.zone,seed:__game.world.map.seed,position:{x:__game.predictor.x,y:__game.predictor.y},fps:__ui.get().fps})');
const shot=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,'tour','m1-blockout-plaza.png'),Buffer.from(shot.data,'base64'));
console.log('Captured isolated real-game plaza',JSON.stringify(actual));
await evaluate('__game.scene.toggleCollision()');
await wait(200);
const debug=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,'tour','m1-blockout-collision.png'),Buffer.from(debug.data,'base64'));
await fs.writeFile(path.join(out,'checks','m1-browser.json'),JSON.stringify({version,actual,isolatedDataDir:path.join(tmp,'saves')},null,2));
} catch(e) { console.error(e);await fs.writeFile(path.join(out,'checks','browser-error.txt'),String(e)+'\n'+logs.join(''));process.exitCode=1; }
finally {if(browser)try{await browser.call('Browser.close')}catch{}for(const p of procs)try{p.kill()}catch{};console.log('Stopped only capture processes created by this script; isolated files retained at '+tmp);setTimeout(()=>process.exit(process.exitCode??0),1000);}