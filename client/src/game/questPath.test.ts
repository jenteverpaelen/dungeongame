import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateMap} from '@shared/mapgen';
import {CollisionWorld} from '@shared/movement';
import {PLAYER_RADIUS} from '@shared/constants';
import {QuestPathfinder,type PathPoint} from './questPath';

test('quest floor routes reach authored destinations without crossing solid geometry',()=>{
  const routes=[['hearthmere','mystic'],['rillwake_crossing','cart'],['rillwake_crossing','ledger']] as const;
  for(const [zone,id] of routes){
    const map=generateMap(zone,73),collision=new CollisionWorld(map),finder=new QuestPathfinder(collision);
    const target=map.town?.npcs.find(n=>n.role===id)??map.adventure?.interactions.find(n=>n.id===id);
    assert(target,`${zone}/${id}`);
    const search=finder.search(map.entry,target);let step=search.next();while(!step.done)step=search.next();
    const route:PathPoint[]=step.value;assert(route.length>=2,`${zone}/${id} route found`);
    assert(Math.hypot(route.at(-1)!.x-target.x,route.at(-1)!.y-target.y)<90,'ends in interaction range');
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i];
      assert(!collision.town!.circlePathBlocked(a.x,a.y,PLAYER_RADIUS,b.x-a.x,b.y-a.y),'no wall/fence/prop shortcut');
    }
  }
});

test('a sealed destination produces no misleading floor trail',()=>{
  const map=generateMap('rillwake_crossing',73),collision=new CollisionWorld(map);
  // Surround the reachable start with a continuous ring of test-only bodies.
  for(let i=0;i<24;i++){const a=i*Math.PI/12;collision.addCollider({x:map.entry.x+Math.cos(a)*80,y:map.entry.y+Math.sin(a)*80,r:20});}
  const search=new QuestPathfinder(collision).search(map.entry,{x:map.entry.x+500,y:map.entry.y});
  let step=search.next();while(!step.done)step=search.next();assert.deepEqual(step.value,[]);
});
