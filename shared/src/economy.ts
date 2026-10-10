import { GEMS, GEM_RANKS } from './data/items';
import { ownedItems } from './merchant';
import type { CharacterSave } from './types';

/** L113/D051: acquired resource deltas, never generated drops or inferred play rates. */
export const ECONOMY_ACTIONS = {
  forge:'Forged equipment',gemExchange:'Gem exchange',setConversion:'Set conversion',
  pickup:'Collected loot', offline:'Offline gains', quest:'Quest rewards', adventure:'Legacy quest rewards',
  merchantBuy:'Stock purchases', merchantSell:'Equipment sales', merchantBuyback:'Buyback', merchantRelease:'Released equipment',
  salvage:'Salvage', salvageAll:'Bulk salvage', enchantRoll:'Enchanting', upgrade:'Empowering', transmute:'Transmutation',
  extract:'Power extraction', reforge:'Reforging', socket:'Adding sockets', removeGem:'Removing gems', fuseGem:'Gem fusion',
  destroy:'Destroyed equipment', debug:'Debug grants', unclassified:'Outside recorded actions',
} as const;
export type EconomyAction = keyof typeof ECONOMY_ACTIONS;
export const ECONOMY_RESOURCES = ['gold','scrap','dust','crystal','soul','deathsBreath',
  ...Object.keys(GEMS).flatMap(g=>GEM_RANKS.map((_,i)=>`${g}:${i+1}`)), 'items'];
const resourceSet = new Set(ECONOMY_RESOURCES);
export type ResourceAmounts = Record<string,number>;
export interface EconomyActivity { events:number; gained:ResourceAmounts; spent:ResourceAmounts }
export interface EconomyState {
  revision:1; startedAt:number; baseline:ResourceAmounts; last:ResourceAmounts;
  activities:Partial<Record<EconomyAction,EconomyActivity>>;
  /** Counter saturation, invalid balances or a change outside an observed action. Never repair wealth from this record. */
  incomplete:boolean;
}
const integer=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
function validAmounts(v:unknown):v is ResourceAmounts {
  return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=ECONOMY_RESOURCES.length
    &&Object.entries(v).every(([k,n])=>resourceSet.has(k)&&integer(n));
}
export function validEconomy(v:unknown):v is EconomyState {
  if(!v||typeof v!=='object')return false;
  const e=v as EconomyState;
  return e.revision===1&&integer(e.startedAt)&&typeof e.incomplete==='boolean'&&validAmounts(e.baseline)&&validAmounts(e.last)
    &&!!e.activities&&typeof e.activities==='object'&&!Array.isArray(e.activities)
    &&Object.keys(e.activities).length<=Object.keys(ECONOMY_ACTIONS).length
    &&Object.entries(e.activities).every(([k,a])=>Object.hasOwn(ECONOMY_ACTIONS,k)&&a&&integer(a.events)&&validAmounts(a.gained)&&validAmounts(a.spent));
}
/** Count all retained custody: selling/socketing/storing gear must not destroy its gems. */
export function economySnapshot(save:CharacterSave):ResourceAmounts {
  const result:ResourceAmounts={gold:save.gold,...save.materials,items:0};
  for(const key of ECONOMY_RESOURCES)if(key.includes(':'))result[key]=save.gems[key]??0;
  for(const item of ownedItems(save))if(item){
    result.items++;
    for(const socket of item.sockets)if(socket){const key=`${socket.gem}:${socket.rank}`;if(resourceSet.has(key))result[key]++;}
  }
  return result;
}
function different(a:ResourceAmounts,b:ResourceAmounts):boolean {
  return ECONOMY_RESOURCES.some(k=>(a[k]??0)!==(b[k]??0));
}
function add(e:EconomyState,n:number,delta:number):number {
  if(delta>Number.MAX_SAFE_INTEGER-n){e.incomplete=true;return Number.MAX_SAFE_INTEGER;}
  return n+delta;
}
function accumulate(e:EconomyState,action:EconomyAction,before:ResourceAmounts,after:ResourceAmounts) {
  const a=e.activities[action]??={events:0,gained:{},spent:{}};
  a.events=add(e,a.events,1);
  for(const k of ECONOMY_RESOURCES){
    const delta=(after[k]??0)-(before[k]??0);
    if(delta){const bucket=delta>0?a.gained:a.spent;bucket[k]=add(e,bucket[k]??0,Math.abs(delta));}
  }
}
/** Only the authority calls this, after a real mutation. Optional/future records never gate gameplay. */
export function recordEconomy(save:CharacterSave,action:EconomyAction,before:ResourceAmounts,now=Date.now()):void {
  if(!Object.hasOwn(ECONOMY_ACTIONS,action)||!integer(now))return;
  const after=economySnapshot(save);
  if(!validAmounts(before)||!validAmounts(after)){
    if(validEconomy(save.economy))save.economy.incomplete=true;
    return;
  }
  if(!different(before,after))return;
  if(save.economy!==undefined&&!validEconomy(save.economy))return; // preserve unknown/malformed records for recovery
  const e=save.economy??={revision:1,startedAt:now,baseline:{...before},last:{...before},activities:{},incomplete:false};
  if(different(e.last,before)){e.incomplete=true;accumulate(e,'unclassified',e.last,before);}
  accumulate(e,action,before,after);
  e.last=after;
}
/** Only mutation-capable commands need a snapshot; transfers and rejected commands produce no entries. */
export function economyCommandAction(op:string,args:Record<string,unknown>):EconomyAction|undefined {
  if(op==='merchant'){
    const actions:Record<string,EconomyAction>={buy:'merchantBuy',sell:'merchantSell',buyback:'merchantBuyback',release:'merchantRelease'};
    return Object.hasOwn(actions,String(args.action))?actions[String(args.action)]:undefined;
  }
  if(op==='offline'||op==='pickup'||op==='unclassified'||op.startsWith('merchant'))return undefined;
  return Object.hasOwn(ECONOMY_ACTIONS,op)?op as EconomyAction:undefined;
}
