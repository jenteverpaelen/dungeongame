import type { TownData } from '@shared/townTypes';
import { sfx } from './sfx';
import { SOUNDS } from './bank';

export class TownSound {
  private last=new Map<string,number>();
  private next=0;
  constructor(private town:TownData) {}
  update(time:number,x:number,y:number) {
    if(time<this.next)return;this.next=time+.08;
    for(const e of this.town.sounds){
      if(SOUNDS[e.kind]?.loop){sfx.positionedLoop(e.id,e.kind,...e.position,e.radius);continue;}
      const period=e.kind==='town_anvil'?2.4:e.kind==='town_gem'?3.7:29;
      const beat=Math.floor(time/period),old=this.last.get(e.id);this.last.set(e.id,beat);
      if(old===undefined||old===beat)continue;
      const d=Math.hypot(e.position[0]-x,e.position[1]-y);
      if(d<e.radius)sfx.play(e.kind,{x:e.position[0],y:e.position[1],vol:(1-d/e.radius)**2});
    }
  }
  destroy(){sfx.clearAmbient();this.last.clear();}
}
