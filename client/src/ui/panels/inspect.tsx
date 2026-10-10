import {useEffect,useState} from 'preact/hooks';
import type {Inspection} from '@shared/social';
import {SLOTS,type Slot} from '@shared/types';
import {CLASSES} from '@shared/data/classes';
import {cmd} from '../../net/api';
import {ui,useUI,togglePanel} from '../store';
import {PanelFrame} from './common';
import {ItemCard,ItemVisual} from './tooltip';
import {SLOT_LABEL} from './util';

export function openInspection(name:string){ui.set({inspectionName:name});togglePanel('inspect',true);}
export function InspectPanel(){
  const target=useUI(s=>s.inspectionName),[name,setName]=useState(target),[profile,setProfile]=useState<Inspection|null>(null),[slot,setSlot]=useState<Slot>('mainhand'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=async(value:string)=>{setBusy(true);setError('');setProfile(null);try{const result=await cmd<Inspection>('inspect',{name:value.trim()});if(result.ok&&result.data)setProfile(result.data);else setError(result.err??'Equipment is unavailable');}finally{setBusy(false);}};
  useEffect(()=>{setName(target);if(target)void load(target);},[target]);
  const item=profile?.equipment[slot];
  return <PanelFrame id="inspect" title="Inspect equipment" width={960} sub={profile?`${profile.name} · Level ${profile.level} ${CLASSES[profile.classId].name}`:'Shared equipped items'}>
    <form class="party-invite" onSubmit={e=>{e.preventDefault();void load(name);}}><label>Online character name<input maxLength={16} value={name} onInput={e=>setName(e.currentTarget.value)}/></label><button class="btn" disabled={busy||!name.trim()}>Inspect</button></form>
    {error&&<p role="status">{error}</p>}{busy&&<p>Checking shared equipment…</p>}
    {profile&&<div class="inspection-body"><div class="inspection-slots">{SLOTS.map(s=><button class={`inspection-slot${slot===s?' selected':''}`} onClick={()=>setSlot(s)}><span>{profile.equipment[s]?<ItemVisual item={profile.equipment[s]!} size={30}/>:null}</span><span><strong>{SLOT_LABEL[s]}</strong><span>{profile.equipment[s]?.name??'Empty'}</span></span></button>)}</div><div class="inspection-item">{item?<ItemCard item={item} char={null} alt={false} tag="Shared equipment"/>:<p>This slot is empty.</p>}</div></div>}
    <p class="pn-note">This is an online equipment snapshot. Refresh to see changes. Inspection follows the other player's privacy setting and grants no item access or control.</p>
  </PanelFrame>;
}
