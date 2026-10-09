import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import WS from 'ws';
import {Packr} from 'msgpackr';
import {generateMap} from '../shared/src/mapgen.ts';
import {createCharacter} from '../shared/src/character.ts';
import {generateItem} from '../shared/src/items.ts';
import {Rng} from '../shared/src/math.ts';
import {CollisionWorld} from '../shared/src/movement.ts';
import {townPath} from '../server/test/townNavigation.ts';
for (const port of [2578]) await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,()=>s.close(resolve));});
const repo = process.env.TOWN_BENCH_REPO ?? 'C:/Users/LaptopJente/dungeongame';
const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hf-town-complete-'));
const out = 'C:/Users/LaptopJente/dungeongame/docs/town';
const label=process.env.TOWN_BENCH_LABEL??'new';const clients=[];let driver;
await fs.mkdir(path.join(out,'tour'),{recursive:true});
const procs=[]; const logs=[];
const wait = ms => new Promise(r=>setTimeout(r,ms));
function launch(exe,args,env={}) { const p=spawn(exe,args,{cwd:repo,windowsHide:true,env:{...process.env,ENABLE_DEBUG:'1',DISABLE_DEBUG:'0',DATA_DIR:path.join(tmp,'saves'),...env},stdio:['ignore','pipe','pipe']}); procs.push(p); p.stdout.on('data',d=>logs.push(String(d)));p.stderr.on('data',d=>logs.push(String(d)));return p; }
async function cdp(url) {const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const q=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const h=q.get(m.id);q.delete(m.id);m.error?h?.reject(m.error):h?.resolve(m.result);}};return {ws,call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;q.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};}
async function until(f,n=150){for(let i=0;i<n;i++){try{const v=await f();if(v)return v}catch{}await wait(200)}throw Error('Timed out waiting for readiness');}
const save=createCharacter('TownComplete','warrior',1);save.level=70;save.cube.level=8;save.paragon.level=40;save.gold=1e9;for(const k in save.materials)save.materials[k]=10000;save.gems['ruby:1']=30;
const rng=new Rng(17);for(let i=0;i<4;i++)save.inventory[i]=generateItem(rng,{ilvl:70,classId:'warrior',rarity:'rare',base:'chest_plate'});
await fs.mkdir(path.join(tmp,'saves'),{recursive:true});await fs.writeFile(path.join(tmp,'saves',save.id+'.json'),JSON.stringify(save));
let browser;
try {
launch(process.execPath,['--import','tsx','server/src/main.ts'],{PORT:'2578'});
await until(async()=> (await fetch('http://localhost:2578/healthz')).ok);
launch('C:/Program Files/Google/Chrome/Application/chrome.exe',[...(process.argv.includes('--headed')?[]:['--headless=new']),'--remote-debugging-port=0','--user-data-dir='+path.join(tmp,'chrome'),'--window-size=1920,1080','--force-device-scale-factor=1','--no-first-run','--no-default-browser-check','about:blank']);
const active=await until(async()=>await fs.readFile(path.join(tmp,'chrome','DevToolsActivePort'),'utf8'));
const [port,browserPath]=active.trim().split('\n');browser=await cdp('ws://127.0.0.1:'+port+browserPath);
const version=await browser.call('Browser.getVersion');const system=await browser.call('SystemInfo.getInfo');
const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const page=await cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await page.call('Page.enable');await page.call('Runtime.enable');await page.call('Performance.enable');
await page.call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const evaluate=async(expression,awaitPromise=false)=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
await page.call('Page.navigate',{url:'http://localhost:2578/?autostart=TownComplete&class=warrior'});
await until(()=>evaluate('Boolean(window.__game?.world?.map && window.__ui?.get().screen === "game")'));
await wait(5000);
const actual=await evaluate('({hidden:document.hidden,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,zone:__game.world.map.zone,seed:__game.world.map.seed,position:{x:__game.predictor.x,y:__game.predictor.y},fps:__ui.get().fps,moveSpeedPercent:__ui.get().derived.ms})');

const capture=async(name)=>{await wait(250);const p=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,'tour',name+'.png'),Buffer.from(p.data,'base64'));};
const key=async(key,code)=>{await page.call('Input.dispatchKeyEvent',{type:'keyDown',key,code});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key,code});await wait(150)};
const click=async(selector)=>{await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.disabled)throw Error("missing/disabled "+'+JSON.stringify(selector)+');e.click();return true})()');await wait(250)};

const pack=new Packr({useRecords:false});
for(let i=0;i<99;i++) {
 const ws=new WS('ws://localhost:2578/ws');const b={ws,seq:0,x:actual.position.x,y:actual.position.y,welcome:false,snaps:0,channel:0};clients.push(b);
 ws.on('message',bytes=>{const m=pack.unpack(bytes);if(m.t==='welcome'){b.welcome=true;b.channel=m.zone.channel;}if(m.t==='s'){b.snaps++;if(m.me){b.x=m.me.x;b.y=m.me.y;}}});
 await new Promise((r,j)=>{ws.on('open',r);ws.on('error',j)});ws.send(pack.pack({t:'hello',name:'Crowd'+String(i).padStart(3,'0'),classId:['warrior','ranger','mage'][i%3],v:1}));
 if(i%10===9)await wait(100);
}
await until(()=>clients.every(b=>b.welcome));
let tick=0;driver=setInterval(()=>{tick++;for(let i=0;i<clients.length;i++){const b=clients[i],a=i*2.39996+tick*.003,r=70+(i%7)*17,tx=actual.position.x+Math.cos(a)*r,ty=actual.position.y+Math.sin(a)*r*.65,dx=tx-b.x,dy=ty-b.y,d=Math.max(30,Math.hypot(dx,dy));if(b.ws.readyState===WS.OPEN)b.ws.send(pack.pack({t:'in',seq:++b.seq,mx:dx/d,my:dy/d}));}},50);
await page.call('Page.bringToFront');
await key('F3','F3');await key('F3','F3');
await wait(15000);
const initial=await page.call('Performance.getMetrics');
const info=await evaluate('({hidden:document.hidden,players:[...__game.world.entities.values()].filter(e=>e.kind==="player").length,visible:[...__game.world.entities.values()].filter(e=>e.kind==="player"&&e.view?.root.visible).length,clock:__game.world.serverNow(),width:innerWidth,height:innerHeight})');
if(info.hidden||info.players!==100)throw Error('Crowd/visibility requirement failed '+JSON.stringify(info));
const textures=await evaluate('(()=>{const r=__game.app.renderer,a=[...new Set(r.texture.managedTextures)].filter(Boolean);return{count:a.length,baseBytes:a.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4,0),mipBytes:a.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4*(s.autoGenerateMipmaps?4/3:1),0)}})()');
await evaluate('window.__bench={start:performance.now(),last:0,dt:[],hidden:document.hidden};function frame(t){let b=__bench;if(b.last)b.dt.push(t-b.last);b.last=t;b.hidden ||=document.hidden;if(performance.now()-b.start<61000)requestAnimationFrame(frame);else b.done=true}requestAnimationFrame(frame);true');
if(process.argv.includes('--profile')){await page.call('Profiler.enable');await page.call('Profiler.start');}
console.log('Sampling 100 networked players for 61 seconds: '+label);
await until(()=>evaluate('Boolean(__bench.done)'),400);
const metrics=await evaluate('(()=>{const b=__bench,a=[...b.dt].sort((a,b)=>a-b),sum=b.dt.reduce((a,b)=>a+b,0);return{durationMs:sum,frames:a.length,fpsAverage:a.length*1000/sum,fpsP1:1000/a[Math.ceil(a.length*.99)-1],fpsMin:1000/a[a.length-1],frameP99:a[Math.ceil(a.length*.99)-1],frameMax:a[a.length-1],hidden:b.hidden}})()');
if(process.argv.includes('--profile')){const prof=await page.call('Profiler.stop');await fs.writeFile(path.join(tmp,'client.cpuprofile'),JSON.stringify(prof.profile));console.log('CPU profile: '+path.join(tmp,'client.cpuprofile'));}
const final=await page.call('Performance.getMetrics'),health=await(await fetch('http://localhost:2578/healthz')).json();
await capture('town-crowd-'+label);
const report={date:new Date().toISOString(),label,mode:process.argv.includes('--headed')?'headed Chrome brought to front':'headless Chrome',version,system,info,metrics,textures,health,heapStart:initial.metrics.find(m=>m.name==='JSHeapUsedSize'),heapEnd:final.metrics.find(m=>m.name==='JSHeapUsedSize'),clients:clients.map(b=>({channel:b.channel,snapshots:b.snaps,closed:b.ws.readyState!==WS.OPEN})),isolatedDataDir:path.join(tmp,'saves')};
await fs.writeFile(path.join(out,'checks','town-crowd-'+label+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({info,metrics,textures,health}));
} catch(e) {console.error(e);process.exitCode=1;}
finally {clearInterval(driver);for(const b of clients)b.ws.close();if(browser)try{await browser.call('Browser.close')}catch{}for(const p of procs)try{p.kill()}catch{};console.log('Benchmark stopped only its own processes; '+tmp);setTimeout(()=>process.exit(process.exitCode??0),1000);}
