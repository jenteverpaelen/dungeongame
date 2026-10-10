import {useState} from 'preact/hooks';
import {PASSIVE_SLOT_LEVELS,passivesForClass,passiveEffect,validPassiveState,setPassive} from '@shared/passives';
import {computeStats} from '@shared/stats';
import type {CharacterSave} from '@shared/types';
import {IconLock,IconStar4} from './icons';
import {cls,run} from './util';

export function PassiveChoices({char}:{char:CharacterSave}){
  const list=passivesForClass(char.classId),[slot,setSlot]=useState(0),[choice,setChoice]=useState(list[0].id),[busy,setBusy]=useState(false);
  const supported=char.passives===undefined||validPassiveState(char.passives,char.classId);
  const slots=supported?(char.passives?.slots??PASSIVE_SLOT_LEVELS.map(()=>null)):PASSIVE_SLOT_LEVELS.map(()=>null);
  const selected=list.find(p=>p.id===choice)??list[0],current=list.find(p=>p.id===slots[slot]);
  const preview={...char},error=setPassive(preview,slot,selected.id);
  const before=computeStats(char),after=error?before:computeStats(preview);
  const change=async(id:string|null)=>{setBusy(true);try{await run('passive',{slot,passive:id});}finally{setBusy(false);}};
  const percent=(n:number)=>`${n.toFixed(1)}%`;
  return <>
    <div class="passive-slots" role="group" aria-label="Passive slots">
      {PASSIVE_SLOT_LEVELS.map((level,i)=>{
        const locked=char.level<level,p=list.find(p=>p.id===slots[i]);
        return <button key={i} class={cls('btn',slot===i&&'primary')} disabled={locked||busy||!supported} onClick={()=>setSlot(i)}>
          <span>{locked?<IconLock size={12}/>:<IconStar4 size={12}/>} Slot {i+1} · {locked?`Level ${level}`:p?.name??'Empty'}</span>
        </button>;
      })}
    </div>
    <div class="sk-main passive-main">
      <div class="slist">
        {list.map(p=><button key={p.id} class={cls('srow passive-row',p.id===selected.id&&'on',char.level<p.unlock&&'locked')} onClick={()=>setChoice(p.id)}>
          <div class="srow-ic"><IconStar4 size={25}/></div>
          <div class="srow-t"><b>{p.name}</b><span>{char.level<p.unlock?`Unlocks at level ${p.unlock}`:slots.includes(p.id)?'Equipped':'Available'}</span></div>
        </button>)}
      </div>
      <div class="sdet-wrap"><div class="sdetail passive-detail">
        <h2>{selected.name}</h2><p>{selected.note}</p>
        <div class="sd-sec"><span>Effect at level {char.level}</span><em>Improves as you level</em></div>
        <p class="passive-effect">{passiveEffect(selected,char.level)}</p>
        <div class="sd-sec"><span>Slot {slot+1} preview</span><em>{current?.id===selected.id?'Equipped':'Not applied yet'}</em></div>
        <p>{current?`${current.id===selected.id?'Currently equipped':'Replaces'}: ${current.name} — ${passiveEffect(current,char.level)}`:'This slot is empty.'}</p>
        <dl class="passive-preview">
          <dt>Life</dt><dd>{before.life.toLocaleString()} → {after.life.toLocaleString()}</dd>
          <dt>Armor / resistance</dt><dd>{before.armor} / {before.allRes} → {after.armor} / {after.allRes}</dd>
          <dt>Resource / second</dt><dd>{before.resourceRegen.toFixed(1)} → {after.resourceRegen.toFixed(1)}</dd>
          <dt>Cooldown reduction</dt><dd>{percent(before.cdr)} → {percent(after.cdr)}</dd>
          {selected.skill&&<><dt>Skill bonus</dt><dd>{percent(before.skillDmg[selected.skill]??0)} → {percent(after.skillDmg[selected.skill]??0)}</dd></>}
        </dl>
        <p class="passive-help">Choose a slot, preview a passive, then apply. Changes are free and use no skill points. Each passive can fill one slot.</p>
        <div class="pn-actions">
          <button class="btn primary" disabled={busy||!!error||slots[slot]===selected.id} onClick={()=>void change(selected.id)}>{busy?'Saving…':slots[slot]===selected.id?'Equipped':`Apply to slot ${slot+1}`}</button>
          <button class="btn" disabled={busy||!current||!supported} onClick={()=>void change(null)}>Clear slot</button>
        </div>
        {error&&<p class="passive-help" role="status">{error}</p>}
      </div></div>
    </div>
  </>;
}
