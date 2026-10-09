import type { MapData } from './mapgen';
import { CollisionWorld } from './movement';
import { PLAYER_RADIUS, TILE } from './constants';

/** Reuses the town validator's diameter grid; every edge is swept with actual player collision. */
export function validateAdventureReachability(map:MapData):string[] {
  const a=map.adventure;if(!a)return [];
  const cw=new CollisionWorld(map),step=PLAYER_RADIUS*2,w=Math.ceil(map.w*TILE/step),h=Math.ceil(map.h*TILE/step);
  const seen=new Uint8Array(w*h),free=new Int8Array(w*h),queue:number[]=[];
  const clear=(x:number,y:number)=>{const k=y*w+x;if(!free[k])free[k]=cw.isFree(x*step,y*step,PLAYER_RADIUS)?1:-1;return free[k]===1;};
  const reaches=(x:number,y:number,tx:number,ty:number)=>{const p=cw.moveCircle(x,y,PLAYER_RADIUS,tx-x,ty-y);return Math.hypot(p.x-tx,p.y-ty)<.01;};
  const sx=Math.round(map.entry.x/step),sy=Math.round(map.entry.y/step);
  if(sx<0||sy<0||sx>=w||sy>=h||!clear(sx,sy)||!reaches(map.entry.x,map.entry.y,sx*step,sy*step))return [`${a.id}: entry cannot reach validation grid`];
  seen[sy*w+sx]=1;queue.push(sy*w+sx);
  for(let head=0;head<queue.length;head++) {
    const k=queue[head],x=k%w,y=Math.floor(k/w);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,next=ny*w+nx;
      if(nx<0||ny<0||nx>=w||ny>=h||seen[next]||!clear(nx,ny)||!reaches(x*step,y*step,nx*step,ny*step))continue;
      seen[next]=1;queue.push(next);
    }
  }
  const targets=[...a.interactions,...a.locations,...a.portals.map(p=>({...p,id:p.to,radius:110})),
    ...a.encounters.flatMap(e=>e.members.map((m,i)=>({id:`${e.id}/${i}`,x:e.x+m.dx,y:e.y+m.dy,radius:TILE})))];
  return targets.filter(t=>{
    const range=Math.ceil(t.radius/step),cx=Math.round(t.x/step),cy=Math.round(t.y/step);
    for(let y=Math.max(0,cy-range);y<=Math.min(h-1,cy+range);y++)for(let x=Math.max(0,cx-range);x<=Math.min(w-1,cx+range);x++)
      if(seen[y*w+x]&&Math.hypot(x*step-t.x,y*step-t.y)<=t.radius&&!cw.segmentBlocked(x*step,y*step,t.x,t.y))return false;
    return true;
  }).map(t=>`${a.id}/${t.id}: unreachable from entry with player collision`);
}
