import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import {generateMap} from '../shared/src/mapgen.ts';
import {createCharacter} from '../shared/src/character.ts';
import {generateItem} from '../shared/src/items.ts';
import {Rng} from '../shared/src/math.ts';
import {townPath} from '../server/test/townNavigation.ts';
for (const port of [2577]) await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,()=>s.close(resolve));});
const repo = 'C:/Users/LaptopJente/dungeongame';
const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hf-m2-walk-'));
const out = path.join(repo,'docs/town');
await fs.mkdir(path.join(out,'tour'),{recursive:true});
const procs=[]; const logs=[];
const wait = ms => new Promise(r=>setTimeout(r,ms));
function launch(exe,args,env={}) { const p=spawn(exe,args,{cwd:repo,windowsHide:true,env:{...process.env,ENABLE_DEBUG:'1',DISABLE_DEBUG:'0',DATA_DIR:path.join(tmp,'saves'),...env},stdio:['ignore','pipe','pipe']}); procs.push(p); p.stdout.on('data',d=>logs.push(String(d)));p.stderr.on('data',d=>logs.push(String(d)));return p; }
async function cdp(url) {const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const q=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const h=q.get(m.id);q.delete(m.id);m.error?h?.reject(m.error):h?.resolve(m.result);}};return {ws,call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;q.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};}
async function until(f,n=150){for(let i=0;i<n;i++){try{const v=await f();if(v)return v}catch{}await wait(200)}throw Error('Timed out waiting for readiness');}
const save=createCharacter('M2Walkthrough','warrior',1);save.level=70;save.cube.level=8;save.paragon.level=40;save.gold=1e9;for(const k in save.materials)save.materials[k]=10000;save.gems['ruby:1']=30;
const rng=new Rng(17);for(let i=0;i<4;i++)save.inventory[i]=generateItem(rng,{ilvl:70,classId:'warrior',rarity:'rare',base:'chest_plate'});
await fs.mkdir(path.join(tmp,'saves'),{recursive:true});await fs.writeFile(path.join(tmp,'saves',save.id+'.json'),JSON.stringify(save));
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
await page.call('Page.navigate',{url:'http://localhost:2577/?autostart=M2Walkthrough&class=warrior'});
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
await capture('m2-plaza');await key('u','KeyU');if(await evaluate('!!__ui.get().panels.cube'))throw Error('U opened away from Cube');
for(const role of ['stash','blacksmith','jeweler','mystic','cube','waypoint','obelisk','paragon']){
 await key('Escape','Escape');const n=map.town.npcs.find(n=>n.role===role);await go(n.approach);await key(role==='cube'?'u':'e',role==='cube'?'KeyU':'KeyE');
 const panel=['blacksmith','jeweler','mystic'].includes(role)?'cube':role; if(!await evaluate('__ui.get().panels['+JSON.stringify(panel)+']'))throw Error('Service panel did not open: '+role);
 if(role==='stash'){await click('[data-idx="0"]');await until(()=>evaluate('__ui.get().char.stash.some(Boolean)'));const grid=await evaluate('(()=>{const p=document.querySelector(".pn-stash").getBoundingClientRect();const a=[...document.querySelectorAll(".pn-stash .cell")].map(e=>e.getBoundingClientRect());return {right:p.right,maxRight:Math.max(...a.map(r=>r.right)),cells:a.length}})()');if(grid.maxRight>grid.right)throw Error('stash grid overflow');await capture('m2-stash-stored');await click('.pn-stash .cell:not([disabled])');await until(()=>evaluate('!__ui.get().char.stash.some(Boolean)'));}
 if(role==='blacksmith'){await click('[data-idx="1"]');await click('.pn-cube .act');await until(()=>evaluate('__ui.get().char.inventory[1]===null'));}
 if(role==='jeweler'){await click('.pn-cube .act');await until(()=>evaluate('(__ui.get().char.gems["ruby:2"]||0)>0'));}
 if(role==='mystic'){await click('[data-idx="0"]');await click('.ench-row:not([disabled])');await click('.pn-cube .act');await until(()=>evaluate('!!__ui.get().enchant'));await capture('m2-mystic-choice');await click('.ench-card:not(.orig)');await until(()=>evaluate('__ui.get().char.inventory[0]?.enchanted!==undefined'));}
 await capture('m2-service-'+role);services.push({role,panel,position:await evaluate('[__game.predictor.x,__game.predictor.y]'),title:await evaluate('document.querySelector("[data-panel='+panel+'] h2")?.textContent')});console.log('Verified browser service',role);
}
await key('Escape','Escape');
for(const route of (process.argv.includes('--quick')?[]:map.town.routes)){await go(route.points[0]);const r=await walk(route.points.slice(1));const length=route.points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-route.points[i][0],p[1]-route.points[i][1]),0);results.push({label:route.label,lengthU:length,nominalSeconds:length/250,observedSeconds:r.ms/1000,...r});console.log('Walked',route.label,(r.ms/1000).toFixed(2)+'s');}
await go(map.town.buildings.find(b=>b.id==='inn').doors[0].inside);await key('F3','F3');await capture('m2-inn-door-collision');await key('F3','F3');
const d=map.town.npcs.find(n=>n.role==='dummy');await go(d.approach);await wait(2000);await capture('m2-training');
await fs.writeFile(path.join(out,'checks',process.argv.includes('--quick')?'m2-browser-followup.json':'m2-browser.json'),JSON.stringify({date:'2026-10-08',mode:'installed Chrome headless=new; 1920x1080; real server; normal predicted input vectors; no teleports or dash',version,actual,services,routes:results,isolatedDataDir:path.join(tmp,'saves')},null,2));
} catch(e) { console.error(e);await fs.writeFile(path.join(out,'checks','m2-browser-error.txt'),String(e)+'\n'+logs.join(''));process.exitCode=1; }
finally {if(browser)try{await browser.call('Browser.close')}catch{}for(const p of procs)try{p.kill()}catch{};console.log('Stopped only capture processes created by this script; isolated files retained at '+tmp);setTimeout(()=>process.exit(process.exitCode??0),1000);}
