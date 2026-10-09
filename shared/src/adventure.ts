import { RILLWAKE } from './data/rillwake';
import { BRACKEN } from './data/bracken';
import type { AdventureData } from './adventureTypes';
import { TILE } from './constants';
import { T_FLOOR, T_WATER, type MapData } from './mapgen';
import { inGround } from './townGeometry';
import type { CharacterSave } from './types';

export const RILLWAKE_ID = 'rillwake_crossing';
export const ADVENTURES:Readonly<Record<string,AdventureData>>={rillwake_crossing:RILLWAKE,bracken_sluice:BRACKEN};
export function loadRillwake(seed: number): MapData {
  return loadAdventure(RILLWAKE_ID,seed);
}
export function loadAdventure(id:string,seed:number):MapData {
  const a = structuredClone(ADVENTURES[id]);
  a.geometry.props = a.scenery.filter(p=>p.r>0).map(p=>({x:p.x,y:p.y,radius:p.r*p.s}));
  a.geometry.props.push(a.wheel);
  a.geometry.npcs = a.npcs;
  const [w,h]=a.size, tiles=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)tiles[y*w+x]=inGround(a.geometry,(x+.5)*TILE,(y+.5)*TILE)?T_FLOOR:T_WATER;
  return {zone:a.id,theme:'glade',seed,w,h,tiles,props:a.scenery,spawns:a.encounters,entry:a.geometry.entry,portals:a.portals,npcs:a.npcs,adventure:a};
}

export function rillwakeObjective(save: CharacterSave): { text:string; target:string } {
  const q=save.rillwake;
  if(!q)return {text:'Speak with Orren at the camp',target:'tender'};
  if(q.claimed)return {text:'The Silent Wheel — completed',target:'tender'};
  if(!q.cart)return {text:'Inspect the cart beyond the timber crossing',target:'cart'};
  if(!q.warden)return {text:'Defeat Siltroot in the mill yard',target:'mill'};
  if(!q.ledger)return {text:'Recover the ledger inside the ruined mill',target:'ledger'};
  return {text:'Return the ledger to Orren at the camp',target:'tender'};
}
