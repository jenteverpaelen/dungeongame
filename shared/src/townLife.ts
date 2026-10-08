import type { Point } from './townTypes';

/** Stable non-solid townsfolk motion from the shared server clock, with no random client state. */
export function townPatrol(path: readonly Point[], speed: number, pause: number, seconds: number, out: {x:number;y:number;vx:number;vy:number}) {
  let period=0;
  for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];period+=Math.hypot(b[0]-a[0],b[1]-a[1])/speed+pause;}
  let t=((seconds%period)+period)%period;
  for(let i=0;i<path.length;i++) {
    const a=path[i],b=path[(i+1)%path.length],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),walk=d/speed;
    if(t<pause){out.x=a[0];out.y=a[1];out.vx=out.vy=0;return out;}t-=pause;
    if(t<walk){out.x=a[0]+dx*t/walk;out.y=a[1]+dy*t/walk;out.vx=dx/d*speed;out.vy=dy/d*speed;return out;}t-=walk;
  }
  out.x=path[0][0];out.y=path[0][1];out.vx=out.vy=0;return out;
}
