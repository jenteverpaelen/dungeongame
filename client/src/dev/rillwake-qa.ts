// Local Vite-only harness. Buttons drive ordinary movement inputs; no server bypass or teleport.
import type { Game } from '../game/game';
import { cmd } from '../net/api';
import { ui, closeAllPanels } from '../ui/store';
import { bindings } from '../game/bindings';
import type { Point } from '@shared/townTypes';
if(import.meta.env.DEV) {
  const panel=document.createElement('div');panel.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;background:#14201fee;color:#eee;padding:8px;font:12px monospace;max-width:620px';
  const status=document.createElement('div');status.dataset.qa='status';panel.append(status);
  const controls=document.createElement('div');panel.append(controls);document.body.append(panel);
  const audioStatus=document.createElement('pre');audioStatus.style.cssText='white-space:pre-wrap;max-height:240px;overflow:auto';panel.append(audioStatus);
  const game=()=>(window as unknown as {__game?:Game}).__game;
  let route:Point[]=[],index=0,started=0,held:string[]=[],message='Ready',lastZone='';
  // Browser focus changes clear Input's held keys. Reassert this active QA route's
  // ordinary inputs each tick so the helper cannot retain a stale held-key belief.
  const keys=(next:string[])=>{for(const key of held)if(!next.includes(key))window.dispatchEvent(new KeyboardEvent('keyup',{code:key,bubbles:true}));for(const key of next)window.dispatchEvent(new KeyboardEvent('keydown',{code:key,bubbles:true,cancelable:true}));held=next;};
  const walk=(p:Point[])=>{closeAllPanels();keys([]);route=p;index=0;started=performance.now();message='Walking ordinary inputs';};
  const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:3px;padding:4px';b.onclick=fn;controls.append(b);};
  const main=()=>game()?.world.map?.adventure?.routes[0]??[];
  button('Walk to Waypoint',()=>{const wp=game()?.world.map?.town?.npcs.find(n=>n.role==='waypoint');if(wp)walk([wp.approach]);});
  button('Travel to Bracken',()=>void cmd('travel',{zone:'bracken_sluice'}).then(r=>message=JSON.stringify(r)));
  button('Walk to Pumpworks hatch',()=>walk([...main().slice(1,7),[2730,1590]]));
  button('Walk to west wheel',()=>walk(main()));
  button('Walk to east wheel',()=>walk([[740,1390],[715,1600],[715,1875],...(game()?.world.map?.adventure?.routes[1]??[])]));
  button('Walk to main pump',()=>walk([[1780,1390],[1565,1230],[1565,915],[1330,915],[1330,780]]));
  button('Travel to Rillwake',()=>void cmd('travel',{zone:'rillwake_crossing'}).then(r=>message=JSON.stringify(r)));
  button('Toggle infinite HP',()=>void cmd('debug',{op:'infhp'}).then(r=>message=JSON.stringify(r)));
  button('Walk to Orren',()=>walk([[800,2445]]));
  button('Walk to return portal from camp',()=>walk([[480,2440]]));
  button('Walk to cart',()=>walk([[900,2430],...main().slice(2,6),[2270,2035]]));
  button('Walk to mill',()=>walk([[2350,2040],...main().slice(6,9)]));
  button('Walk to ledger',()=>walk([[3340,1130],[3340,940],[3350,865]]));
  button('Walk back to camp',()=>walk([[3340,940],[3360,1130],...main().slice(0,8).reverse(),[800,2445]]));
  button('Walk ridge from camp',()=>walk([[900,2430],[1450,2010],...(game()?.world.map?.adventure?.routes[1]??[])]));
  button('Walk to ridge survey',()=>walk([[900,2430],[1450,2010],[1450,1900],[1160,1400],[1600,1350],[2340,1120],[2440,1055]]));
  button('Return from survey',()=>walk([[2340,1120],[1600,1350],[1160,1400],[1450,1900],[1450,2010],[900,2430],[800,2445]]));
  button('Walk to upstream exit',()=>walk([[900,2430],...main().slice(2,8),[3070,1230],[3070,910],[3120,780]]));
  button('Walk to spillway keeper',()=>walk(main().slice(1,8)));
  button('Walk to floodgate',()=>walk([[2540,910]]));
  button('Return along sluice causeway',()=>walk([...main().slice(0,8).reverse(),[670,2760]]));
  button('Interact (E)',()=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',key:'e',bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',key:'e',bubbles:true}));});
  button('Stop walking',()=>{route=[];keys([]);message='Stopped';});
  button('Inspect ambience',()=>{audioStatus.textContent=JSON.stringify(game()?.audio.inspect(),null,2);});
  button('Toggle QA controls',()=>{controls.hidden=!controls.hidden;});
  // Keep the toggle reachable when controls are hidden.
  const toggle=document.createElement('button');toggle.textContent='Show / hide QA';toggle.onclick=()=>controls.hidden=!controls.hidden;panel.append(toggle);
  setInterval(()=>{
    const g=game();if(!g)return;
    if(g.world.zone?.zone!==lastZone){keys([]);route=[];lastZone=g.world.zone?.zone??'';}
    if(route.length && g.predictor.ready) {
      if(document.hidden || performance.now()-started>90000 || g.world.me?.dead){route=[];keys([]);message='Stopped: hidden, dead or timed out';}
      else {
        // Follow the last authoritative position; render correction can lag at low frame rates.
        const pos=ui.get().me??g.predictor;
        const [x,y]=route[index],dx=x-pos.x,dy=y-pos.y;
        // Snapshots arrive every 100 ms: at the base 250 u/s, a 13 u threshold can
        // oscillate between two samples. 26 u exceeds one sample's travel and is
        // still inside the 45 u spare interaction margin of these route endpoints.
        if(Math.hypot(dx,dy)<26){index++;if(index===route.length){route=[];keys([]);message='Route finished';}}
        else {
          const next:string[]=[];const add=(a:'up'|'down'|'left'|'right')=>{const key=bindings.get().values[a][0];if(key)next.push(key);};
          if(Math.abs(dx)>7)add(dx>0?'right':'left');if(Math.abs(dy)>7)add(dy>0?'down':'up');keys(next);
        }
      }
    }
    const st=ui.get();status.textContent=`${message} | ${lastZone} (${g.predictor.x.toFixed(0)},${g.predictor.y.toFixed(0)}) server (${st.me?.x},${st.me?.y}) | ${st.fps}fps | ${st.char?.classId} level ${st.char?.level} | ${route.length?`${index}/${route.length} toward ${route[index]} keys ${held.join('+')}`:'idle'}`;
  },50);
}
