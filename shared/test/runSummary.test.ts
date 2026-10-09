import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedRunSummary } from '../../client/src/game/runSummary';
import type { DungeonState, RiftState, ZoneInfo } from '../src/protocol';

const zone:ZoneInfo={zone:'rift',name:'Fixture Rift',kind:'rift',theme:'glade',seed:1,channel:0,instance:'rift#fixture',difficulty:1};
const rift:RiftState={progress:100,phase:'done',level:10,difficulty:2,elapsedMs:90123,owner:'Fixture'};
const dungeon:DungeonState={stage:3,phase:'done',remaining:0,target:'record',totalStages:3,elapsedMs:123456};

test('only a completed matching instance kind produces a run summary',()=>{
  assert.equal(completedRunSummary(zone,undefined,undefined),null);
  for(const phase of ['hunt','guardian'] as const)assert.equal(completedRunSummary(zone,{...rift,phase},undefined),null);
  assert.equal(completedRunSummary({...zone,kind:'field'},rift,dungeon),null);
  assert.equal(completedRunSummary(zone,undefined,dungeon),null);
  const result=completedRunSummary(zone,rift,undefined)!;
  assert.equal(result.difficulty,2);assert.equal(result.elapsedMs,90123);assert.equal(result.stages,null);
  assert(!('reward' in result)&&!('items' in result)&&!('gold' in result),'result is not a grant or inferred loot total');
});
test('dungeon summary retains actual completion counts; legacy absent clock data stays unknown',()=>{
  const info={...zone,zone:'reedvault_pumpworks',kind:'dungeon' as const};
  const before=structuredClone(dungeon),result=completedRunSummary(info,undefined,dungeon)!;
  assert.equal(result.stages,3);assert.equal(result.elapsedMs,123456);assert.deepEqual(dungeon,before);
  const legacy=completedRunSummary(info,undefined,{stage:3,phase:'done',remaining:0,target:'record'})!;
  assert.equal(legacy.elapsedMs,null);assert.equal(legacy.stages,null);
  assert.equal(completedRunSummary(info,undefined,{...dungeon,phase:'active'}),null);
});
