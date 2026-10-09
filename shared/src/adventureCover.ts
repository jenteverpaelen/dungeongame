import type { AdventureData } from './adventureTypes';
import { inPolygon } from './townGeometry';

const distance=(px:number,py:number,ax:number,ay:number,bx:number,by:number)=>{
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(px-ax-dx*t,py-ay-dy*t);
};
function crosses(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,dx:number,dy:number):boolean {
  const cross=(x:number,y:number,u:number,v:number)=>x*v-y*u;
  const den=cross(bx-ax,by-ay,dx-cx,dy-cy);
  if(Math.abs(den)<1e-9)return Math.min(distance(ax,ay,cx,cy,dx,dy),distance(bx,by,cx,cy,dx,dy),distance(cx,cy,ax,ay,bx,by),distance(dx,dy,ax,ay,bx,by))<1e-7;
  const t=cross(cx-ax,cy-ay,dx-cx,dy-cy)/den,u=cross(cx-ax,cy-ay,bx-ax,by-ay)/den;
  return t>=0&&t<=1&&u>=0&&u<=1;
}

/** L110: obstacle cover only. Open water/shorelines do not block airborne shots. */
export function adventureCover(a:AdventureData,x:number,y:number,tx:number,ty:number):boolean {
  for(const b of a.geometry.buildings){
    if(inPolygon(x,y,b.footprint)||inPolygon(tx,ty,b.footprint))return true;
    for(let i=0;i<b.footprint.length;i++){const p=b.footprint[i],q=b.footprint[(i+1)%b.footprint.length];if(crosses(x,y,tx,ty,...p,...q))return true;}
  }
  for(const p of a.geometry.props)if(distance(p.x,p.y,x,y,tx,ty)<=p.radius)return true;
  for(const b of a.geometry.barriers){
    if(crosses(x,y,tx,ty,...b.a,...b.b)||Math.min(distance(x,y,...b.a,...b.b),distance(tx,ty,...b.a,...b.b),distance(...b.a,x,y,tx,ty),distance(...b.b,x,y,tx,ty))<=b.radius)return true;
  }
  return false;
}
