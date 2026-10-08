import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMap} from '../src/mapgen';
import {CollisionWorld} from '../src/movement';
import {townPatrol} from '../src/townLife';
import {inGround} from '../src/townGeometry';

test('town ambience paths stay on shared walkable ground and reproduce at the same clock',()=>{
 const t=generateMap('hearthmere',42).town!,a={x:0,y:0,vx:0,vy:0},b={...a};
 for(const v of t.villagers??[])for(let tm=0;tm<300;tm+=.25){townPatrol(v.path,v.speed,v.pause,tm,a);townPatrol(v.path,v.speed,v.pause,tm,b);assert.deepEqual(a,b);assert.ok(inGround(t,a.x,a.y),`${v.id} at ${a.x},${a.y}`);}
});
test('Inn and Forge interiors are open, furniture is solid, and their back walls stop dashes',()=>{
 const m=generateMap('hearthmere',42),w=new CollisionWorld(m);
 for(const b of m.town!.buildings.filter(b=>b.interior)){
  const p=b.interior!.target;assert.ok(w.isFree(...p,16),b.id);
  const q=w.moveCircle(...p,16,0,-900);assert.ok(w.isFree(q.x,q.y,16));assert.ok(q.y>p[1]-800);
 }
 for(const id of ['inn-table','inn-cask','forge-rack']){const p=m.town!.props.find(p=>p.id===id)!;assert.equal(w.isFree(p.x,p.y,16),false,id);}
});
