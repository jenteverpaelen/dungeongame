import type { DungeonState, RiftState, ZoneInfo } from '@shared/protocol';

/** One bounded, transient presentation record. Never used as a reward receipt. */
export interface RunSummary {
  instance:string;
  zone:string;
  name:string;
  kind:'rift'|'dungeon';
  difficulty:number;
  elapsedMs:number|null;
  stages:number|null;
}
export function completedRunSummary(zone:ZoneInfo,rift:RiftState|undefined,dungeon:DungeonState|undefined):RunSummary|null {
  if(zone.kind==='rift'&&rift?.phase==='done')return {
    instance:zone.instance,zone:zone.zone,name:zone.name,kind:'rift',difficulty:rift.difficulty,
    elapsedMs:Number.isFinite(rift.elapsedMs)&&rift.elapsedMs>=0?rift.elapsedMs:null,stages:null,
  };
  if(zone.kind==='dungeon'&&dungeon?.phase==='done')return {
    instance:zone.instance,zone:zone.zone,name:zone.name,kind:'dungeon',difficulty:zone.difficulty,
    elapsedMs:typeof dungeon.elapsedMs==='number'&&Number.isFinite(dungeon.elapsedMs)&&dungeon.elapsedMs>=0?dungeon.elapsedMs:null,
    stages:dungeon.totalStages!==undefined&&dungeon.stage===dungeon.totalStages?dungeon.stage:null,
  };
  return null;
}
