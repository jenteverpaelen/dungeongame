import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMap} from '../src/mapgen';
import {CollisionWorld} from '../src/movement';
import {PLAYER_RADIUS,BASE_MOVE_SPEED} from '../src/constants';
import {MONSTERS} from '../src/data/monsters';

for(const zone of ['rillwake_crossing','bracken_sluice'])test(`${zone}: deterministic layout, clear routes, reachable interactions and safe spawn bodies`,()=>{
  const map=generateMap(zone,1),a=map.adventure!,cw=new CollisionWorld(map);
  assert.deepEqual(a,generateMap(zone,999).adventure,'seed never relocates authored content');
  assert.equal(map.town,undefined,'field never masquerades as a town');
  assert(cw.isFree(map.entry.x,map.entry.y,PLAYER_RADIUS));
  for(const e of a.encounters)for(const m of e.members)assert(cw.isFree(e.x+m.dx,e.y+m.dy,MONSTERS[m.type].radius),`${e.id}/${m.type}`);
  let length=0;
  for(const [r,route] of a.routes.entries())for(let i=1;i<route.length;i++) {
    const [x,y]=route[i-1],dx=route[i][0]-x,dy=route[i][1]-y,d=Math.hypot(dx,dy);length+=d;
    for(let n=0;n<=Math.ceil(d/8);n++){const t=n/Math.ceil(d/8);assert(cw.isFree(x+t*dx,y+t*dy,PLAYER_RADIUS),`route ${r}/${i} at ${x+t*dx},${y+t*dy}`);}
    const end=cw.moveCircle(x,y,PLAYER_RADIUS,dx,dy);assert(Math.hypot(end.x-route[i][0],end.y-route[i][1])<.01,'swept route matches destination');
  }
  for(const i of a.interactions)assert(Array.from({length:16},(_,n)=>{const x=i.x+70*Math.cos(n*Math.PI/8),y=i.y+70*Math.sin(n*Math.PI/8);return cw.isFree(x,y,16)&&!cw.segmentBlocked(x,y,i.x,i.y);}).some(Boolean),`${i.id} approachable`);
  for(const loc of a.locations)assert(cw.isFree(loc.x,loc.y,16),`${loc.id} reachable body`);
  console.log(JSON.stringify({routeUnits:length,walkingSecondsWithoutCombat:length/BASE_MOVE_SPEED,encounters:a.encounters.length,members:a.encounters.reduce((s,e)=>s+e.members.length,0)}));
});

test('exact shore, mill walls and bridge rails stop movement and rays; doorway remains open',()=>{
  const map=generateMap('rillwake_crossing',1),cw=new CollisionWorld(map);
  assert(!cw.isFree(1900,1800,16),'water');
  assert(cw.isFree(1900,2030,16),'bridge');
  const rail=cw.moveCircle(1900,2030,16,0,-600);assert(rail.y>=1943-1e-3,'no dash through bridge rail');
  assert(cw.segmentBlocked(1900,2030,1900,1800));
  const wall=cw.moveCircle(3360,850,16,0,-600);assert(wall.y>=754-1e-3,'no tunnel through mill wall');
  assert(cw.segmentBlocked(3360,850,3360,660));
  assert(!cw.segmentBlocked(3340,1130,3340,850),'open doorway');
  assert(cw.isFree(3340,1000,16));
});
