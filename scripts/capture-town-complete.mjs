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
const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'hf-town-complete-'));
const out = path.join(repo,'docs/town');
await fs.mkdir(path.join(out,'tour'),{recursive:true});
const procs=[]; const logs=[];
const wait = ms => new Promise(r=>setTimeout(r,ms));
function launch(exe,args,env={}) { const p=spawn(exe,args,{cwd:repo,windowsHide:true,env:{...process.env,DATA_DIR:path.join(tmp,'saves'),...env},stdio:['ignore','pipe','pipe']}); procs.push(p); p.stdout.on('data',d=>logs.push(String(d)));p.stderr.on('data',d=>logs.push(String(d)));return p; }
async function cdp(url) {const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});let id=0;const q=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const h=q.get(m.id);q.delete(m.id);m.error?h?.reject(m.error):h?.resolve(m.result);}};return {ws,call:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;q.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};}
async function until(f,n=150){for(let i=0;i<n;i++){try{const v=await f();if(v)return v}catch{}await wait(200)}throw Error('Timed out waiting for readiness');}
const mage=process.argv.includes('--mage'),testClass=mage?'mage':'warrior';
const save=createCharacter('TownComplete',testClass,1);save.level=70;save.cube.level=8;save.paragon.level=40;save.gold=1e9;for(const k in save.materials)save.materials[k]=10000;save.gems['ruby:1']=30;
if(mage){save.skills.slots=['meteor',null,null,null];save.skills.tiers.meteor=2;save.skills.runes.meteor='comet';}
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
if(process.argv.includes('--startup-profile')){await page.call('Profiler.enable');await page.call('Profiler.start');}
await page.call('Page.navigate',{url:'http://localhost:2578/?autostart=TownComplete&class='+testClass});
await until(()=>evaluate('Boolean(window.__game?.world?.map && window.__ui?.get().screen === "game")'));
const startup={readyMs:await evaluate('performance.now()')};
await wait(150);
await until(()=>evaluate('(()=>{const g=__game.scene.ground.children[0]?.children[0];return g?.tiles&&g.wanted.length===0&&!g.timer})()'));
startup.entryGroundPrefetchedMs=await evaluate('performance.now()');
await until(()=>evaluate('(()=>{const views=[...__game.scene.statics.filter(s=>s.view.root.visible).map(s=>s.view.inner),...__game.scene.townLife.walkers.map(w=>w.view),...[...__game.world.entities.values()].map(e=>e.view)].filter(v=>v?.sheet&&v.root.visible);return views.length>0&&views.every(v=>!v.sheet.live)})()'));
startup.visibleRigAtlasesReadyMs=await evaluate('performance.now()');
startup.breakdown=await evaluate('({measures:performance.getEntriesByType("measure").filter(m=>m.name.startsWith("town-")).map(m=>({name:m.name,start:m.startTime,duration:m.duration})),ground:(()=>{const g=__game.scene.ground.children[0].children[0];return{baked:g.baked,bakeMs:g.bakeMs}})()})');
startup.chromeMetrics=(await page.call('Performance.getMetrics')).metrics.filter(m=>/Duration|Count/.test(m.name));
if(process.argv.includes('--startup-profile')){const p=await page.call('Profiler.stop');await fs.writeFile(path.join(tmp,'startup.cpuprofile'),JSON.stringify(p.profile));console.log('Startup profile '+path.join(tmp,'startup.cpuprofile'));}
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
const multiplayerOnly=process.argv.includes('--multiplayer');
const verify=process.argv.includes('--verify')||multiplayerOnly;
const perimeter=process.argv.includes('--perimeters');
const poses=process.argv.includes('--lifecycle')||verify||perimeter||mage?[]:process.argv.includes('--quick')?[['inn-front',[2553,2195]]]:[
 ['plaza',[2891.5,2418.6]],['plaza-life',[3050,2300]],['inn-front',[2553,2195]],['inn-door',[2514.1,2083]],['inn-interior',[2440,1950]],['forge-interior',[3500,2160]],
 ['inn-east',[2760,1920]],['inn-north',[2469,1658]],['inn-west',[2150,1950]],
 ['shack-front',[2104.3,1961.6]],['shack-rear',[1905.9,1496.3]],['smith',[3116.8,2255.4]],['jeweler',[2947.8,1896.3]],['mystic',[3285.8,1754.9]],['cube',[2933.8,2538.2]],['rift',[3201.3,2451.2]],['shrine',[2426.9,1657]],['lane-house',[3790,1800]],['upper-court',[2180,883]],['court-house-a',[1900,970]],['court-house-b',[2830,600]],['cellar',[2580,790]],['north-gate',[1905.9,536.3]],['pier',[709.1,2037.8]],['east-exit',[5341.4,884.5]],['south-road',[2990.1,3125.8]],['south-end',[1962.2,2908.2]]];
if(perimeter)for(const b of map.town.buildings) {
 const center=b.footprint.reduce((s,p)=>[s[0]+p[0]/b.footprint.length,s[1]+p[1]/b.footprint.length],[0,0]);
 b.footprint.forEach((p,i)=>{const dx=p[0]-center[0],dy=p[1]-center[1],d=Math.hypot(dx,dy);poses.push(['corner-'+b.id+'-'+i,[p[0]+dx/d*40,p[1]+dy/d*40]]);});
}
for(const [name,desired] of poses){
 let goal=desired,path;
 for(let distance=0;distance<(perimeter?400:130)&&!path;distance+=16)for(let i=0;i<24&&!path;i++){
  const p=[desired[0]+Math.cos(i*Math.PI/12)*distance,desired[1]+Math.sin(i*Math.PI/12)*distance];
  if(!cw.isFree(...p,16))continue;
  try{const start=await evaluate('[__game.predictor.x,__game.predictor.y]');path=townPath(map,start,p);goal=p;}catch{}
 }
 if(!path){if(perimeter){shots.push({name,desired,unreachable:'No player-clear route within 400 u of this exterior corner'});continue;}throw Error('No route to screenshot '+name);}
 const result=await walk(path);await wait(700);await capture('town-complete-'+name);
 shots.push({name,desired,goal,...result});console.log('Captured',name,JSON.stringify(goal));
 if(name==='inn-door'){await key('F3','F3');await capture('town-complete-door-collision');await key('F3','F3');}
}
let lifecycle,audio,multiplayer,life,camera;
if(mage) {
 await evaluate('window.__casts=[];const originalEvent=__game.onEvent.bind(__game);__game.onEvent=ev=>{originalEvent(ev);if(ev.e==="cast"&&ev.s===__ui.get().myId)__casts.push({ev,time:performance.now()})};true');
 await evaluate('__game.conn.cmd("debug",{op:"infres"})',true);
 // Shared geometry survey: 522 u from the first dummy, with 337 u vertical separation
 // (outside the old 310 u half-view before even adding the spell radius).
 const spot=[2000,1080];
 if(!cw.isFree(...spot,16))throw Error('Mage camera fixture is no longer walkable');
 await go(spot);await evaluate('__casts.length=0');await until(()=>evaluate('__casts.some(c=>c.ev.sk==="meteor")'));
 await wait(300);await capture('town-camera-restored-meteor-fall');
 const audit=()=>evaluate('(()=>{const s=__game.scene,project=(x,y)=>[s.root.x+x*s.cam.zoom,s.root.y+y*s.cam.zoom];return{height:innerHeight/s.cam.zoom,cam:{...s.cam},hero:project(__game.predictor.x,__game.predictor.y),casts:__casts.slice(-5),hidden:document.hidden}})()');
 camera={restViewHeight:620,position:spot,meteor:await audit()};
 await wait(600);await capture('town-camera-restored-meteor-impact');
 await evaluate('__game.conn.cmd("skillRune",{skill:"meteor",rune:"meteor_shower"})',true);
 await evaluate('__casts.length=0');await until(()=>evaluate('__casts.some(c=>c.ev.sk==="meteor"&&c.ev.r==="meteor_shower")'));
 await wait(350);await capture('town-camera-restored-meteor-shower');camera.shower=await audit();
 await evaluate('__game.conn.cmd("skillSlot",{slot:0,skill:null})',true);await go([2450,820]);
 await evaluate('__game.conn.cmd("skillSlot",{slot:1,skill:"frost_nova"})',true);
 await evaluate('__casts.length=0');await until(()=>evaluate('__casts.some(c=>c.ev.sk==="frost_nova")'));
 await wait(150);await capture('town-camera-restored-frost-nova');camera.nova=await audit();
 for(const [name,a] of Object.entries(camera))if(a?.cam) {
   if(a.hidden||Math.abs(a.height-620)>1e-6)throw Error('Fixed camera changed during cast: '+name);
 }
 console.log('Fixed zoom preserved during real mage casts',JSON.stringify({position:spot,meteorHeight:camera.meteor.height,showerHeight:camera.shower.height,novaHeight:camera.nova.height}));
}
if(verify) {
 await key('Escape','Escape');await key('e','KeyE');await key('Escape','Escape');await wait(1800);
 const readAudio=()=>evaluate('__game.audio.inspect()');
 audio={plaza:await readAudio()};
 if(audio.plaza.state!=='running'||audio.plaza.buffers.length!==8||audio.plaza.buffers.some(b=>!b.rms))throw Error('Audio failed to unlock or generated a silent town buffer: '+JSON.stringify(audio.plaza));
 await go([3050,2300]);await wait(800);await capture('town-complete-plaza-life');
 const motionSample=()=>evaluate('(()=>{const life=__game.scene.townLife,visible=o=>{const b=o.getBounds();return o.visible&&o.getGlobalAlpha()>.002&&b.maxX>0&&b.minX<innerWidth&&b.maxY>0&&b.minY<innerHeight};return{time:__game.world.serverNow(),motions:life.motions.filter(m=>m.root.visible&&m.parts.some(visible)).map(m=>({kind:m.kind,parts:m.parts.map(p=>[p.x,p.y,p.scale.x,p.scale.y,p.alpha,p.rotation,p.skew.x])})),villagers:life.walkers.filter(w=>visible(w.view.root)).map(w=>[w.state.x,w.state.y]),smithVisible:__game.scene.statics.some(s=>s.role==="blacksmith"&&visible(s.view.root))}})()');
 life={before:await motionSample()};await wait(2500);life.after=await motionSample();
 const types=new Set(life.before.motions.map(m=>m.kind));if(life.before.villagers.length)types.add('villager patrol');if(life.before.smithVisible)types.add('smith hammer');
 life.visibleTypes=[...types];if(types.size<8)throw Error('Fewer than eight visible plaza animations: '+JSON.stringify(life));
 for(const role of multiplayerOnly?[]:['stash','blacksmith','jeweler','mystic','cube','waypoint','obelisk','paragon']) {
   await key('Escape','Escape');const n=map.town.npcs.find(n=>n.role===role);await go(n.approach);await key('e','KeyE');
   const panel=['blacksmith','jeweler','mystic','cube'].includes(role)?'cube':role;
   await until(()=>evaluate('Boolean(document.querySelector('+JSON.stringify('[data-panel="'+panel+'"]')+'))'));
   if(['stash','blacksmith','mystic'].includes(role)&&!await evaluate('Boolean(__ui.get().panels.inventory)'))await key('i','KeyI');
   const before=await evaluate('({inventory:__ui.get().char.inventory.filter(Boolean).length,gems:{...__ui.get().char.gems},stash:(__ui.get().char.stash??[]).filter(Boolean).length})');
   if(role==='stash') {
     await click('[data-panel="inventory"] .cell:not(.empty)');
     await until(()=>evaluate('__ui.get().char.stash.some(Boolean)'));
     await capture('town-service-stash-deposited');
     await click('[data-panel="stash"] button.cell:not(.empty)');
     await until(()=>evaluate('!__ui.get().char.stash.some(Boolean)'));
   }
   if(role==='blacksmith') {
     await click('[data-panel="inventory"] .cell:not(.empty)');await click('.cw-foot .act');
     await until(()=>evaluate('__ui.get().char.inventory.filter(Boolean).length==='+String(before.inventory-1)));
   }
   if(role==='jeweler') {await click('.cw-foot .act');await until(()=>evaluate('(__ui.get().char.gems["ruby:2"]??0)>0'));}
   if(role==='mystic') {
     await click('[data-panel="inventory"] .cell:not(.empty)');await click('.ench-row:not([disabled])');await click('.cw-foot .act');
     await until(()=>evaluate('Boolean(document.querySelector(".ench-card"))'));await capture('town-service-enchant-choice');
     await click('.ench-card:not(.orig)');await until(()=>evaluate('!__ui.get().enchant'));
   }
   await capture('town-service-'+role);
   services.push({role,panels:await evaluate('__ui.get().panels'),before,after:await evaluate('({inventory:__ui.get().char.inventory.filter(Boolean).length,gems:{...__ui.get().char.gems},stash:(__ui.get().char.stash??[]).filter(Boolean).length,enchanted:__ui.get().char.inventory.filter(Boolean).filter(i=>i.enchanted!==undefined).length})')});
   if(role==='blacksmith')audio.forge=await readAudio();if(role==='mystic')audio.mystic=await readAudio();
   console.log('Verified service UI',role);
 }
 await key('Escape','Escape');await go([2553,2195]);await wait(600);audio.inn=await readAudio();
 await evaluate('__game.audio.setMuted(true)');await wait(400);audio.muted=await readAudio();
 if(audio.muted.master>.001)throw Error('Master mute did not reach zero');await evaluate('__game.audio.setMuted(false)');
 await go(map.town.entry?[map.town.entry.x,map.town.entry.y]:map.entry);
 const second=await browser.call('Target.createTarget',{url:'about:blank',newWindow:true});
 const tab=await until(async()=>{const ts=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();return ts.find(t=>t.id===second.targetId)});
 const peer=await cdp(tab.webSocketDebuggerUrl);
 await peer.call('Page.enable');await peer.call('Runtime.enable');await peer.call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await peer.call('Page.navigate',{url:'http://localhost:2578/?autostart=TownWitness&class=mage'});
 const other=async(expression)=>{const r=await peer.call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await until(()=>other('Boolean(window.__game?.world?.map && __ui.get().screen==="game")'));await wait(15000);
 const sample='({hidden:document.hidden,channel:__ui.get().zone.channel,time:__game.world.serverNow(),id:__ui.get().myId,players:[...__game.world.entities.values()].filter(e=>e.kind==="player").map(e=>({id:e.id,x:e.x,y:e.y})),walkers:__game.scene.townLife.walkers.map(w=>({id:w.data.id,x:w.state.x,y:w.state.y}))})';
 const [a,b]=await Promise.all([evaluate(sample),other(sample)]);
 if(a.hidden||b.hidden)throw Error('A multiplayer browser window is hidden');
 await go([3000,2400]);await wait(450);const after=await other(sample);
 const remote=after.players.find(p=>p.id===a.id),pos=await evaluate('[__game.predictor.x,__game.predictor.y]');
 if(a.channel!==b.channel||!remote||Math.hypot(remote.x-pos[0],remote.y-pos[1])>2)throw Error('Peer channel or movement mismatch');
 const maxWalkerError=Math.max(...a.walkers.map((w,i)=>Math.hypot(w.x-b.walkers[i].x,w.y-b.walkers[i].y)));
 if(maxWalkerError>2)throw Error('Shared-clock villagers diverged after warmup');
 multiplayer={first:a,second:b,afterMovement:after,remotePositionError:Math.hypot(remote.x-pos[0],remote.y-pos[1]),maxWalkerError};
 await browser.call('Target.closeTarget',{targetId:second.targetId});console.log('Two-client movement/ambient check passed');
}
if(process.argv.includes('--lifecycle')||verify) {
 const npcAtlasExpression='(()=>{const v=[...__game.scene.statics.map(s=>s.view.inner),...__game.scene.townLife.walkers.map(w=>w.view)];return [...new Set(v.flatMap(v=>v?.sheet?.sources??[]))]})()';
 await evaluate('window.__npcSources='+npcAtlasExpression+';true');
 await evaluate(`window.__sliceSources=(()=>{const sources=new Set();const visit=c=>{if(c.texture?.source?.resource instanceof HTMLCanvasElement)sources.add(c.texture.source);for(const ch of c.children??[])visit(ch)};visit(__game.scene.ground);for(const p of __game.scene.props)if(p.view.texture)visit(p.view);return [...sources]})();true`);
 const allocation=await evaluate('({sources:__sliceSources.length,baseBytes:__sliceSources.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4,0),withMipBytes:__sliceSources.reduce((n,s)=>n+s.pixelWidth*s.pixelHeight*4*(s.autoGenerateMipmaps?4/3:1),0),strips:__game.scene.props.filter(p=>p.view.texture).length})');
 await go(map.town.npcs.find(n=>n.role==='waypoint').approach);
 const travel=await evaluate('__game.conn.cmd("travel",{zone:"whispering_glade"})',true);
 if(!travel.ok)throw Error('Lifecycle outbound travel failed');
 await until(()=>evaluate('__game.world.map.zone==="whispering_glade"'));await wait(1000);
 const disposed=await evaluate('__sliceSources.every(s=>s.destroyed)');if(!disposed)throw Error('Town texture source survived map teardown');
 if(verify){audio.field=await evaluate('__game.audio.inspect()');if(audio.field.loops.length)throw Error('Town loops leaked into field');}
 const home=await evaluate('__game.conn.cmd("travel",{zone:"hearthmere"})',true);if(!home.ok)throw Error('Lifecycle return failed');
 await until(()=>evaluate('__game.world.map.zone==="hearthmere"'));await wait(1500);
 await go([2553,2195]);await capture('town-complete-reentry');
 const npcAtlases=await evaluate('(()=>{const old=__npcSources,now='+npcAtlasExpression+';return{before:old.length,after:now.length,reused:now.filter(s=>old.includes(s)).length,destroyedBefore:old.filter(s=>s.destroyed).length}})()');
 lifecycle={allocation,allOwnedSourcesDestroyed:disposed,reentry:true,npcAtlases};console.log(JSON.stringify(lifecycle));
}
if(verify){await evaluate('__game.conn.close()');await wait(500);audio.disconnected=await evaluate('__game.audio.inspect()');if(audio.disconnected.loops.length)throw Error('Ambient loops survived disconnect');}
await fs.writeFile(path.join(out,'checks',mage?'town-camera-restored.json':multiplayerOnly?'town-complete-multiplayer.json':verify?'town-complete-verification.json':perimeter?'town-complete-perimeters.json':process.argv.includes('--lifecycle')?'town-complete-lifecycle.json':process.argv.includes('--quick')?'town-complete-load.json':'town-complete-browser.json'),JSON.stringify({date:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Brussels'}),version,startup,actual,shots,services,audio,life,camera,multiplayer,lifecycle,isolatedDataDir:path.join(tmp,'saves')},null,2));
} catch(e) { console.error(e);await fs.writeFile(path.join(out,'checks','town-complete-browser-error.txt'),String(e)+'\n'+logs.join(''));process.exitCode=1; }
finally {if(browser)try{await browser.call('Browser.close')}catch{}for(const p of procs)try{p.kill()}catch{};console.log('Stopped only slice capture processes; test files at '+tmp);setTimeout(()=>process.exit(process.exitCode??0),1000);}
