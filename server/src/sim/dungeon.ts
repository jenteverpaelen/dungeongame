import { MONSTERS } from '../../../shared/src/data/monsters';
import { questText } from '../../../shared/src/data/questMessages';
import { inPolygon } from '../../../shared/src/townGeometry';
import type { DungeonState } from '../../../shared/src/protocol';
import type { PlayerLink } from '../contracts';
import { creditQuestWave } from '../quests';
import type { Instance } from './instance';
import { createMob } from './monsters';
import type { Mob } from './types';

/** One player's ordered encounter run. Only actual deaths can clear the live member set. */
export class DungeonRuntime {
  private stage=0;
  private active=false;
  private initiator=0;
  private remaining=new Set<number>();
  private startT=-1;
  private endT=-1;
  private get stages(){return this.inst.map.adventure!.dungeon!.stages;}
  constructor(private inst:Instance){}

  state():DungeonState {
    return {stage:this.stage,phase:this.stage===this.stages.length?'done':this.active?'active':'ready',remaining:this.remaining.size,target:this.stages[this.stage]?.trigger??'work_record',
      totalStages:this.stages.length,elapsedMs:this.startT<0?0:(this.endT<0?this.inst.t:this.endT)-this.startT};
  }

  activate(link:PlayerLink,target:string):string|null {
    const stage=this.stages[this.stage];
    if(!stage)return 'The pumpworks is already cleared';
    if(this.active)return 'Clear the current chamber first';
    if(target!==stage.trigger)return 'Follow the current dungeon mechanism';
    const spot=this.inst.map.adventure!.interactions.find(i=>i.id===target)!;
    const p=this.inst.players.find(p=>p.link===link);
    if(!p||!this.inst.canInteract(link,spot.x,spot.y,spot.radius))return 'Stand beside the mechanism to turn it';
    const encounter=this.inst.map.adventure!.encounters.find(e=>e.id===stage.encounter)!;
    this.active=true;this.initiator=p.id;
    if(this.startT<0)this.startT=this.inst.t;
    for(const member of encounter.members){
      const mob=createMob(this.inst,MONSTERS[member.type],this.inst.level,encounter.x+member.dx,encounter.y+member.dy,
        {tier:member.tier??0,combat:member.combat,affixes:member.affixes,name:member.name,difficulty:this.inst.difficulty,players:1});
      mob.adventureSite=encounter.id;
      this.remaining.add(mob.id);
    }
    return null;
  }

  killed(mob:Mob) {
    if(!this.active||mob.noReward||!this.remaining.delete(mob.id))return;
    if(this.remaining.size)return;
    const stage=this.stages[this.stage],p=this.inst.playerById(this.initiator);
    if(!p||p.deadMs>0||p.hp<=0||!inPolygon(p.x,p.y,stage.area)){this.reset();return;}
    creditQuestWave(this.inst,p,stage.id);
    this.stage++;this.active=false;this.initiator=0;
    if(this.stage===this.stages.length)this.endT=this.inst.t;
    this.inst.notice(questText(this.stage===this.stages.length?'quest.pump.done':'quest.pump.next'),'info');
  }

  tick() {
    if(!this.active)return;
    const p=this.inst.playerById(this.initiator);
    // A despawn/debug removal is not a kill, and must not leave a permanently stuck encounter.
    if(!p||p.deadMs>0||p.hp<=0||!inPolygon(p.x,p.y,this.stages[this.stage].area)
      ||[...this.remaining].some(id=>!this.inst.mob(id)))this.reset();
  }

  leave(link:PlayerLink){if(this.inst.playerById(this.initiator)?.link===link)this.reset();}

  private reset() {
    for(const id of this.remaining){const m=this.inst.mob(id);if(m)this.inst.removeMob(m);}
    this.remaining.clear();this.active=false;this.initiator=0;
    // No lingering attack from the cancelled solo encounter may hit the retry.
    this.inst.projs.length=0;this.inst.grounds.length=0;this.inst.sched.clear();
    this.inst.notice(questText('quest.pump.retry'),'info');
  }
}
