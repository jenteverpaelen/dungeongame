import { MAX_MESSAGE_BYTES, type CmdOp } from './protocol';
import type { AffixRoll } from './types';

export interface CommandRequest { epoch:string; sequence:number; token:string }
export interface SavedEnchant { itemId:string; affix:number; options:AffixRoll[] }
export interface CommandState {
  revision:1; epoch:string; sequence:number;
  latest?: { request:CommandRequest; fingerprint:string; result:{ok:boolean; err?:string; data?:unknown} };
  pendingEnchant?:SavedEnchant;
}
const sequence=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
export function validCommandRequest(v:unknown):v is CommandRequest {
  const r=v as CommandRequest|undefined;
  return !!r&&typeof r.epoch==='string'&&/^[a-f0-9-]{36}$/.test(r.epoch)&&sequence(r.sequence)
    &&typeof r.token==='string'&&/^[a-f0-9]{32}$/.test(r.token);
}
export function validCommandState(v:unknown):v is CommandState {
  const s=v as CommandState|undefined;
  if(!s||s.revision!==1||!validCommandRequest({epoch:s.epoch,sequence:s.sequence,token:'0'.repeat(32)}))return false;
  const r=s.latest,p=s.pendingEnchant;
  if(r&&(!validCommandRequest(r.request)||r.request.epoch!==s.epoch||r.request.sequence!==s.sequence-1
    ||typeof r.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(r.fingerprint)||!r.result||typeof r.result.ok!=='boolean'
    ||(r.result.err!==undefined&&typeof r.result.err!=='string')))return false;
  if(p&&(typeof p.itemId!=='string'||!Number.isInteger(p.affix)||p.affix<0||p.affix>15||!Array.isArray(p.options)||p.options.length!==2
    ||!p.options.every(a=>a&&typeof a.stat==='string'&&typeof a.primary==='boolean'&&[a.value,a.min,a.max].every(Number.isFinite))))return false;
  try{return new TextEncoder().encode(JSON.stringify(s)).length<=MAX_MESSAGE_BYTES;}catch{return false;}
}
/** Classify every command explicitly. New currency costs must join the persisted path. */
const persisted:Record<CmdOp,boolean>={
  party:false,
  social:true,
  onboarding:true,passive:true,merchant:true,equip:true,unequip:true,swapInv:true,destroy:true,itemProtect:true,stashDeposit:true,stashWithdraw:true,
  adventure:true,quest:true,salvage:true,salvageAll:true,enchantRoll:true,enchantPick:true,upgrade:true,transmute:true,extract:true,cubeEquip:true,
  reforge:true,socket:true,insertGem:true,removeGem:true,fuseGem:true,skillSlot:true,skillRune:true,skillTier:true,skillReset:true,
  skillAutoCast:true,targetPriority:true,skillCast:false,skillAutoRule:true,paragon:true,paragonReset:true,
  travel:false,riftOpen:false,riftEnter:false,leave:false,channel:false,debug:true,
};
export function isPersistedCommand(op:string):boolean {return Object.hasOwn(persisted,op)&&persisted[op as CmdOp];}
