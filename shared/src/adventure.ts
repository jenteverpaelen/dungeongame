import { RILLWAKE } from './data/rillwake';
import { BRACKEN } from './data/bracken';
import { PUMPWORKS } from './data/pumpworks';
import { CAIRNSPILL, CINDERWASH, KILNWATCH } from './data/frontier';
import { MIDGAME_ADVENTURES } from './data/midgame';
import type { AdventureData } from './adventureTypes';
import { TILE } from './constants';
import { T_FLOOR, T_WATER, type MapData } from './mapgen';
import { groundTester } from './townGeometry';

export const RILLWAKE_ID = 'rillwake_crossing';
export const ADVENTURES:Readonly<Record<string,AdventureData>>={rillwake_crossing:RILLWAKE,bracken_sluice:BRACKEN,reedvault_pumpworks:PUMPWORKS,cairnspill_terraces:CAIRNSPILL,cinderwash_kilns:CINDERWASH,kilnwatch_crown:KILNWATCH,
  ...Object.fromEntries(MIDGAME_ADVENTURES.map(a=>[a.id,a]))};
export function loadRillwake(seed: number): MapData {
  return loadAdventure(RILLWAKE_ID,seed);
}
export function loadAdventure(id:string,seed:number):MapData {
  // The visual-only paint block is shared read-only (it can hold thousands of decor entries); the rest is per instance.
  const {paint,...rest}=ADVENTURES[id];
  const a:AdventureData = {...structuredClone(rest),...(paint?{paint}:{})};
  a.geometry.props = a.scenery.filter(p=>p.r>0).map(p=>({x:p.x,y:p.y,radius:p.r*p.s}));
  if(a.wheel)a.geometry.props.push(a.wheel);
  for(const k of [...a.kilns??[],...a.works??[]])a.geometry.buildings.push({footprint:[[k.x,k.y],[k.x+k.w,k.y],[k.x+k.w,k.y+k.d],[k.x,k.y+k.d]]});
  // Phased contacts (appear / moveTo) are not solid, so every player in a channel shares one collision world.
  a.geometry.npcs = a.npcs.filter(n=>n.r>0);
  const [w,h]=a.size, tiles=new Uint8Array(w*h), ground=groundTester(a.geometry);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)tiles[y*w+x]=ground((x+.5)*TILE,(y+.5)*TILE)?T_FLOOR:T_WATER;
  return {zone:a.id,theme:a.theme??'glade',seed,w,h,tiles,props:a.scenery,spawns:a.encounters,entry:a.geometry.entry,portals:a.portals,npcs:a.npcs,adventure:a};
}
