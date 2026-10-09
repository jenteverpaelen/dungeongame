import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import {generateMap} from '../shared/src/mapgen.ts';
import {createCharacter} from '../shared/src/character.ts';
import {generateItem} from '../shared/src/items.ts';
import {Rng} from '../shared/src/math.ts';
import {CollisionWorld} from '../shared/src/movement.ts';
import {townPath} from '../server/test/townNavigation.ts';
for (const port of [2578]) await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,()=>s.close(resolve));});
const repo = 'C:/Users/LaptopJente/dungeongame';
const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hf-m3-slice-'));
const out = path.join(repo,'docs/town');
await fs.mkdir(path.join(out,'tour'),{recursive:true});
const procs=[]; const logs=[];
const wait = ms => new Promise(r=>setTimeout(r,ms));
function launch(exe,args,env={}) { const p=spawn(exe,args,{cwd:repo,windowsHide:true,env:{...process.env,ENABLE_DEBUG:'1',DISABLE_DEBUG:'0',DATA_DIR:path.join(tmp,'saves'),...env},stdio:['ignore','pipe','pipe']}); procs.push(p); p.stdout.on('data',d=>logs.push(String(d)));p.stderr.on('data',d=>logs.push(String(d)));return p; }
async function cdp(url) {const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const q=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const h=q.get(m.id);q.delete(m.id);m.error?h?.reject(m.error):h?.resolve(m.result);}};return {ws,call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;q.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};}
async function until(f,n=150){for(let i=0;i<n;i++){try{const v=await f();if(v)return v}catch{}await wait(200)}throw Error('Timed out waiting for readiness');}
const save=createCharacter('M3LookSlice','warrior',1);save.level=70;save.cube.level=8;save.paragon.level=40;save.gold=1e9;for(const k in save.materials)save.materials[k]=10000;save.gems['ruby:1']=30;
const rng=new Rng(17);for(let i=0;i<4;i++)save.inventory[i]=generateItem(rng,{ilvl:70,classId:'warrior',rarity:'rare',base:'chest_plate'});
await fs.mkdir(path.join(tmp,'saves'),{recursive:true});await fs.writeFile(path.join(tmp,'saves',save.id+'.json'),JSON.stringify(save));
let browser;
try {
launch(process.execPath,['--import','tsx','server/src/main.ts'],{PORT:'2578'});
await until(async()=> (await fetch('http://localhost:2578/healthz')).ok);
launch('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+path.join(tmp,'chrome'),'--window-size=1920,1080','--force-device-scale-factor=1','--no-first-run','--no-default-browser-check','about:blank']);
const active=await until(async()=>await fs.readFile(path.join(tmp,'chrome','DevToolsActivePort'),'utf8'));
const [port,browserPath]=active.trim().split('\n');browser=await cdp('ws://127.0.0.1:'+port+browserPath);
const version=await browser.call('Browser.getVersion');const system=await browser.call('SystemInfo.getInfo');
const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const page=await cdp(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await page.call('Page.enable');await page.call('Runtime.enable');await page.call('Performance.enable');
await page.call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
const evaluate=async(expression,awaitPromise=false)=>{const r=await page.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
await page.call('Page.navigate',{url:'http://localhost:2578/?autostart=M3LookSlice&class=warrior'});
await until(()=>evaluate('Boolean(window.__game?.world?.map && window.__ui?.get().screen === "game")'));
await wait(5000);
const actual=await evaluate('({hidden:document.hidden,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,zone:__game.world.map.zone,seed:__game.world.map.seed,position:{x:__game.predictor.x,y:__game.predictor.y},fps:__ui.get().fps,moveSpeedPercent:__ui.get().derived.ms})');

const capture=async(name)=>{await wait(250);const p=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(out,'tour',name+'.png'),Buffer.from(p.data,'base64'));};
const key=async(key,code)=>{await page.call('Input.dispatchKeyEvent',{type:'keyDown',key,code});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key,code});await wait(150)};
const click=async(selector)=>{await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e||e.disabled)throw Error("missing/disabled "+'+JSON.stringify(selector)+');e.click();return true})()');await wait(250)};
const map=generateMap('hearthmere',actual.seed),results=[],services=[];
await evaluate('window.__walk=null;__game.input.move=()=>{const w=__walk;if(!w||w.done)return{x:0,y:0};for(;;){const p=w.points[w.i];if(!p){w.done=true;w.ms=performance.now()-w.start;return{x:0,y:0}}const dx=p[0]-__game.predictor.x,dy=p[1]-__game.predictor.y,d=Math.hypot(dx,dy);if(d<.4){w.i++;continue}const k=Math.max(12.5,d);return{x:dx/k,y:dy/k}}};true');
const walk=async(points)=>{await evaluate('window.__walk={points:'+JSON.stringify(points)+',i:0,start:performance.now(),done:false};true');await until(()=>evaluate('Boolean(__walk?.done)'),400);await wait(200);return evaluate('({ms:__walk.ms,predicted:[__game.predictor.x,__game.predictor.y],authoritative:[__ui.get().me.x,__ui.get().me.y],hidden:document.hidden})')};
const go=async(goal)=>{const start=await evaluate('[__game.predictor.x,__game.predictor.y]');return walk(townPath(map,start,goal))};
const cw=new CollisionWorld(map),shots=[];
const poses=process.argv.includes('--lifecycle')?[]:process.argv.includes('--quick')?[['inn-front',[2553,2195]]]:[
 ['plaza',[2891.5,2418.6]],['inn-front',[2553,2195]],['inn-door',[2514.1,2083]],
 ['inn-east',[2760,1920]],['inn-north',[2469,1658]],['inn-west',[2150,1950]],
 ['shack-front',[2104.3,1961.6]],['shack-rear',[1905.9,1496.3]],['smith',[3116.8,2255.4]]];
for(const [name,desired] of poses){
 let goal=desired,path;
 for(let distance=0;distance<130&&!path;distance+=16)for(let i=0;i<24&&!path;i++){
  const p=[desired[0]+Math.cos(i*Math.PI/12)*distance,desired[1]+Math.sin(i*Math.PI/12)*distance];
  if(!cw.isFree(...p,16))continue;
  try{const start=await evaluate('[__game.predictor.x,__game.predictor.y]');path=townPath(map,start,p);goal=p;}catch{}
 }
 if(!path)throw Error('No route to screenshot '+name);
 const result=await walk(path);await wait(700);await capture('m3-slice-'+name);
 shots.push({name,desired,goal,...result});console.log('Captured',name,JSON.stringify(goal));
 if(name==='inn-door'){await key('F3','F3');await capture('m3-slice-door-collision');await key('F3','F3');}
}
let lifecycle;
if(process.argv.includes('--lifecycle')) {
 await evaluate(`window.__sliceSources=(()=>{const sources=new Set();const visit=c=>{if(c.texture?.source?.resource instanceof HTMLCanvasElement)sources.add(c.texture.source);for(const ch of c.children??[])visit(ch)};visit(__game.scene.ground);for(const p of __game.scene.props)if(p.view.texture)visit(p.view);return [...sources]})();true`);
 const allocation=await evaluate('({sources:__sliceSources.length,baseBytes:__sliceSources.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4,0),withMipBytes:__sliceSources.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4*(s.autoGenerateMipmaps?4/3:1),0),strips:__game.scene.props.filter(p=>p.view.texture).length})');
 await go(map.town.npcs.find(n=>n.role==='waypoint').approach);
 const travel=await evaluate('__game.conn.cmd("travel",{zone:"whispering_glade"})',true);
 if(!travel.ok)throw Error('Lifecycle outbound travel failed');
 await until(()=>evaluate('__game.world.map.zone==="whispering_glade"'));await wait(1000);
 const disposed=await evaluate('__sliceSources.every(s=>s.destroyed)');if(!disposed)throw Error('Town texture source survived map teardown');
 const home=await evaluate('__game.conn.cmd("travel",{zone:"hearthmere"})',true);if(!home.ok)throw Error('Lifecycle return failed');
 await until(()=>evaluate('__game.world.map.zone==="hearthmere"'));await wait(1500);
 await go([2553,2195]);await capture('m3-slice-reentry');
 lifecycle={allocation,allOwnedSourcesDestroyed:disposed,reentry:true};console.log(JSON.stringify(lifecycle));
}
await fs.writeFile(path.join(out,'checks',process.argv.includes('--lifecycle')?'m3-slice-lifecycle.json':'m3-slice-browser.json'),JSON.stringify({date:'2026-10-08',version,actual,shots,lifecycle,isolatedDataDir:path.join(tmp,'saves')},null,2));
} catch(e) { console.error(e);await fs.writeFile(path.join(out,'checks','m3-slice-browser-error.txt'),String(e)+'\n'+logs.join(''));process.exitCode=1; }
finally {if(browser)try{await browser.call('Browser.close')}catch{}for(const p of procs)try{p.kill()}catch{};console.log('Stopped only slice capture processes; test files at '+tmp);setTimeout(()=>process.exit(process.exitCode??0),1000);}
