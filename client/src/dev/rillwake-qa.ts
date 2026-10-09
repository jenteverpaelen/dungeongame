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
  const game=()=>(window as unknown as {__game?:Game}).__game;
  let route:Point[]=[],index=0,started=0,held:string[]=[],message='Ready',lastZone='';
  const keys=(next:string[])=>{for(const key of held)if(!next.includes(key))window.dispatchEvent(new KeyboardEvent('keyup',{code:key,bubbles:true}));for(const key of next)if(!held.includes(key))window.dispatchEvent(new KeyboardEvent('keydown',{code:key,bubbles:true,cancelable:true}));held=next;};
  const walk=(p:Point[])=>{closeAllPanels();keys([]);route=p;index=0;started=performance.now();message='Walking ordinary inputs';};
  const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:3px;padding:4px';b.onclick=fn;controls.append(b);};
  const main=()=>game()?.world.map?.adventure?.routes[0]??[];
  button('Travel to Rillwake',()=>void cmd('travel',{zone:'rillwake_crossing'}).then(r=>message=JSON.stringify(r)));
  button('Toggle infinite HP',()=>void cmd('debug',{op:'infhp'}).then(r=>message=JSON.stringify(r)));
  button('Walk to Orren',()=>walk([[800,2445]]));
  button('Walk to return portal from camp',()=>walk([[480,2440]]));
  button('Walk to cart',()=>walk([[900,2430],...main().slice(2,6),[2270,2035]]));
  button('Walk to mill',()=>walk([[2350,2040],...main().slice(6,9)]));
  button('Walk to ledger',()=>walk([[3340,1130],[3340,940],[3350,865]]));
  button('Walk back to camp',()=>walk([[3340,940],[3360,1130],...main().slice(0,8).reverse(),[800,2445]]));
  button('Walk ridge from camp',()=>walk([[900,2430],[1450,2010],...(game()?.world.map?.adventure?.routes[1]??[])]));
  button('Interact (E)',()=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',key:'e',bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',key:'e',bubbles:true}));});
  button('Stop walking',()=>{route=[];keys([]);message='Stopped';});
  button('Toggle QA controls',()=>{controls.hidden=!controls.hidden;});
  // Keep the toggle reachable when controls are hidden.
  const toggle=document.createElement('button');toggle.textContent='Show / hide QA';toggle.onclick=()=>controls.hidden=!controls.hidden;panel.append(toggle);
  setInterval(()=>{
    const g=game();if(!g)return;
    if(g.world.zone?.zone!==lastZone){keys([]);route=[];lastZone=g.world.zone?.zone??'';}
    if(route.length && g.predictor.ready) {
      if(document.hidden || performance.now()-started>90000 || g.world.me?.dead){route=[];keys([]);message='Stopped: hidden, dead or timed out';}
      else {
        const [x,y]=route[index],dx=x-g.predictor.x,dy=y-g.predictor.y;
        if(Math.hypot(dx,dy)<13){index++;if(index===route.length){route=[];keys([]);message='Route finished';}}
        else {
          const next:string[]=[];const add=(a:'up'|'down'|'left'|'right')=>{const key=bindings.get().values[a][0];if(key)next.push(key);};
          if(Math.abs(dx)>7)add(dx>0?'right':'left');if(Math.abs(dy)>7)add(dy>0?'down':'up');keys(next);
        }
      }
    }
    const st=ui.get();status.textContent=`${message} | ${lastZone} (${g.predictor.x.toFixed(0)},${g.predictor.y.toFixed(0)}) | ${st.fps}fps | ${st.char?.classId} level ${st.char?.level} | ${route.length?`${index}/${route.length}`:'idle'}`;
  },50);
}
