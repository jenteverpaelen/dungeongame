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

// Open-field rebuild (2026-10-12, docs/rework/worlds/OPEN.md): positions come from the zone data, bridges cross the
// rivers at any angle, and the mill is a house with its wheel on the race (no interior, so no doorway to check).
test('exact shore, bridge edges and mill walls stop movement and rays; the wheel stands on the mill',()=>{
  const map=generateMap('rillwake_crossing',1),cw=new CollisionWorld(map),a=map.adventure!;
  const bridges=a.paths.filter(p=>p.bridge);assert(bridges.length>=3,'two Rill bridges and the race bridge');
  for(const bridge of bridges){
    const b0=bridge.points[0],b1=bridge.points[bridge.points.length-1],mid=[(b0[0]+b1[0])/2,(b0[1]+b1[1])/2],l=Math.hypot(b1[0]-b0[0],b1[1]-b0[1]);
    let nx=-(b1[1]-b0[1])/l,ny=(b1[0]-b0[0])/l;if(ny>0){nx=-nx;ny=-ny;} // across the deck
    const water=[mid[0]+nx*260,mid[1]+ny*260];
    assert(!cw.isFree(water[0],water[1],16),'water');
    assert(cw.isFree(mid[0],mid[1],16),'bridge');
    const edge=cw.moveCircle(mid[0],mid[1],16,nx*600,ny*600);assert((edge.x-mid[0])*nx+(edge.y-mid[1])*ny<=bridge.width/2+1e-3,'no dash off the bridge');
    assert(cw.segmentBlocked(mid[0],mid[1],water[0],water[1]));
  }
  const ledger=a.interactions.find(i=>i.id==='ledger')!;
  const over=a.geometry.buildings.filter(b=>!b.hole&&Math.min(...b.footprint.map(p=>p[0]))<ledger.x&&Math.max(...b.footprint.map(p=>p[0]))>ledger.x);
  const north=Math.max(...over.map(b=>Math.max(...b.footprint.map(p=>p[1]))).filter(y=>y<ledger.y));
  assert(ledger.y-north<500,'the ledger stands in front of the mill');
  const wall=cw.moveCircle(ledger.x,ledger.y+60,16,0,-600);assert(wall.y>=north+16-1e-3,'no tunnel through mill wall');
  assert(cw.segmentBlocked(ledger.x,ledger.y+60,ledger.x,north-120));
  const st=a.paint!.structures!,wheel=st.find(s=>s.kind==='waterwheel')!,house=st.filter(s=>s.kind==='house').sort((p,q)=>Math.hypot(p.x-wheel.x,p.y-wheel.y)-Math.hypot(q.x-wheel.x,q.y-wheel.y))[0];
  assert(!cw.isFree(wheel.x,wheel.y-wheel.d/2,16),'the wheel is solid');
  assert(Math.abs(wheel.x-wheel.w/2-(house.x+house.w/2))<40,'the wheel stands on the mill wall');
  const brake=a.interactions.find(i=>i.id==='mill_brake')!;assert(Math.hypot(brake.x-wheel.x,brake.y-wheel.y)<300,'the brake stands at the wheel');
});
