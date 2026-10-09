import { RILLWAKE_ID } from '../../shared/src/adventure';
import { addToInventory } from '../../shared/src/character';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { fail, ok, type CmdResult } from './world';
import type { Session } from './net/session';
import type { Instance } from './sim/instance';
import type { Mob, Player } from './sim/types';
import { XP_SHARE_RANGE } from './config';

export function adventureCommand(s: Session, a: Record<string,unknown>): CmdResult {
  const rec=s.rec, map=rec?.inst.map;
  if(map?.zone!==RILLWAKE_ID || !map.adventure)return fail('Travel to Rillwake Crossing first');
  const target=map.adventure.interactions.find(i=>i.id===a.target);
  if(!target)return fail('Unknown adventure interaction');
  if(!rec!.inst.canInteract(s,target.x,target.y,target.radius))return fail(`Stand beside ${target.name}`);
  if(a.action==='talk')return ok({target:target.id});
  let q=s.save.rillwake;
  if(a.action==='accept') {
    if(target.id!=='tender')return fail('Speak with Orren at the camp');
    if(q)return fail('This adventure is already recorded in your journal');
    q=s.save.rillwake={revision:1,cart:false,warden:false,ledger:false,claimed:false};
  } else {
    if(!q || q.revision!==1)return fail('Accept The Silent Wheel from Orren first');
    if(q.claimed)return fail('The Silent Wheel is already completed');
    if(a.action==='inspect') {
      if(target.id==='cart')q.cart=true;
      else if(target.id==='ledger') {
        if(!q.cart || !q.warden)return fail('Investigate the cart and defeat Siltroot first');
        if(!q.ledger)q.reward=generateItem(new Rng((Math.random()*0xffffffff)>>>0),{
          ilvl:s.save.level,classId:s.save.classId,rarity:'magic',smartChance:1,
          base:s.save.classId==='mage'?'staff':s.save.classId==='ranger'?'bow':'sword',
        });
        q.ledger=true;
      } else return fail('There is nothing to recover here');
    } else if(a.action==='claim') {
      if(target.id!=='tender')return fail('Bring the ledger back to Orren');
      if(!q.cart || !q.warden || !q.ledger)return fail('Recover the mill ledger first');
      if(!q.reward)return fail('Your reserved reward could not be read');
      if(addToInventory(s.save,structuredClone(q.reward))<0)return fail('Make room in your inventory, then speak with Orren again');
      q.claimed=true;
    } else return fail('Unknown adventure action');
  }
  s.changed(false);
  return ok();
}

/** Local living witnesses only. The owner of a distant summon does not get remote quest credit. */
export function creditRillwakeKill(inst: Instance, mob: Mob, witnesses: Player[]) {
  if(inst.map.zone!==RILLWAKE_ID || mob.adventureTarget!=='mill' || mob.noReward || mob.dummy)return;
  for(const p of witnesses) {
    const q=p.save.rillwake;
    if(!q || q.revision!==1 || !q.cart || q.warden || q.claimed || p.deadMs>0 || p.hp<=0 || Math.hypot(p.x-mob.x,p.y-mob.y)>XP_SHARE_RANGE)continue;
    q.warden=true; p.link.markDirty();
    inst.emitTo(p.id,{e:'notice',kind:'info',text:'Siltroot defeated. Recover the ledger inside the ruined mill.'});
  }
}
