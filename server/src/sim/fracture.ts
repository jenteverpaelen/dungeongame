import { PLAYER_RADIUS, type Element } from '../shared';
import { damagePlayer } from './damage';
import { elIdx } from './effects';
import type { Instance } from './instance';
import type { Mob } from './types';

/** L109: three mortar-sized marks along locked aim, no homing or hits through solid cover.
 * Ground magic ends with its source; this is intentionally distinct from airborne Reedclaw shells. */
export function fractureLine(inst:Instance,m:Mob,tx:number,ty:number,range:number,damage:number,element:Element) {
  const ox=m.x,oy=m.y,angle=Math.atan2(ty-oy,tx-ox),length=Math.min(range,Math.hypot(tx-ox,ty-oy));
  const level=m.level;
  for(let i=1;i<=3;i++) {
    const x=Math.round(ox+Math.cos(angle)*length*i/3),y=Math.round(oy+Math.sin(angle)*length*i/3);
    if(!inst.cw.isFree(x,y,1)||inst.cw.segmentBlocked(ox,oy,x,y))break;
    const delay=900+(i-1)*120,r=75;
    inst.emit({e:'tele',v:'mortar',x,y,r,d:delay},x,y);
    inst.sched.schedule(inst.t+delay,()=>{
      if(m.dead||m.state==='return')return;
      inst.emit({e:'aoe',v:'slam',x,y,r,d:350,el:elIdx(element),s:m.id},x,y);
      for(const p of inst.players)if(p.deadMs<=0&&Math.hypot(p.x-x,p.y-y)<=r+PLAYER_RADIUS&&!inst.cw.segmentBlocked(x,y,p.x,p.y))
        damagePlayer(inst,p,damage,element,m,level,false);
    });
  }
}
