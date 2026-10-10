import {useState} from 'preact/hooks';
import {PARTY_MAX} from '@shared/constants';
import {ZONES} from '@shared/data/zones';
import {togglePanel,useUI} from '../store';
import {PanelFrame,Bar,Tabs} from './common';
import {run} from './util';
import {ClassEmblem} from '../hud/Glyphs';

export function PartyPanel(){
  const party=useUI(s=>s.party),[tab,setTab]=useState<'members'|'invitations'>(()=>party?.incoming.length?'invitations':'members'),[name,setName]=useState(''),[busy,setBusy]=useState(false);
  if(!party)return <PanelFrame id="party" title="Party" width={760}><p>Waiting for party information…</p></PanelFrame>;
  const lead=party.you===party.leader&&!!party.id;
  const act=async(action:string,args:Record<string,unknown>={})=>{setBusy(true);try{const result=await run('party',{action,...args});if(result.ok&&action==='invite')setName('');}finally{setBusy(false);}};
  return <PanelFrame id="party" title="Party" width={760} sub={`${party.members.length} / ${PARTY_MAX} members`}>
    <Tabs tabs={[{id:'members',label:'Members'},{id:'invitations',label:'Invitations',badge:party.incoming.length}]} value={tab} onChange={setTab}/>
    {!party.enabled&&<p class="pn-note">New party actions are disabled in this channel. You can still leave or decline an invitation.</p>}
    {tab==='members'?<>
      {!party.id&&<p>Invite an online character to travel as a group. Each player chooses whether to join.</p>}
      <div class="party-members">{party.members.map(m=><div class="party-member" key={m.key}>
        <div class="party-emblem"><ClassEmblem classId={m.classId}/></div>
        <div class="party-detail"><strong>{m.name}{m.key===party.leader?' · Leader':''}{m.key===party.you?' · You':''}</strong>
          <span>Level {m.level} · {m.online?`${ZONES[m.zone??'']?.name??'Travelling'}${m.channel?` · Channel ${m.channel}`:''}`:'Reconnecting'}</span>
          {m.online&&<Bar tone="life" frac={m.hp??0} text={m.dead?'Defeated':m.hp===null?'Travelling':`${Math.round(m.hp*100)}% Life`} height={12}/>}</div>
        {lead&&m.key!==party.you&&<div class="party-controls"><button class="btn tiny" disabled={busy||!party.enabled||!m.online} onClick={()=>void act('leader',{member:m.key})}>Make leader</button><button class="btn tiny" disabled={busy||!party.enabled} onClick={()=>void act('kick',{member:m.key})}>Remove</button></div>}
      </div>)}</div>
      {(!party.id||lead)&&<form class="party-invite" onSubmit={e=>{e.preventDefault();void act('invite',{name});}}>
        <label>Online character name<input maxLength={16} value={name} onInput={e=>setName(e.currentTarget.value)} autoComplete="off"/></label>
        <button class="btn primary" disabled={busy||!party.enabled||!name.trim()||party.members.length>=PARTY_MAX}>Invite</button>
      </form>}
      {party.id&&<button class="btn" disabled={busy} onClick={()=>void act('leave')}>Leave party</button>}
      <p class="pn-note">Invitations and disconnected places last 60 seconds. If the leader disconnects, an online member takes over. Party membership does not move anyone or bypass story gates. Personal loot and nearby experience rules remain in effect.</p>
    </>:<>
      <p class="pn-note">Invitations expire after 60 seconds. Accepting requires an available place; leave your current party first.</p>
      {!party.incoming.length&&!party.outgoing.length&&<p>No pending invitations.</p>}
      {party.incoming.map(i=><div class="party-invitation" key={i.id}><span><strong>{i.from}</strong> invited you</span><button class="btn primary" disabled={busy||!!party.id||!party.enabled} onClick={()=>void act('accept',{invite:i.id})}>Accept</button><button class="btn" disabled={busy} onClick={()=>void act('decline',{invite:i.id})}>Decline</button></div>)}
      {party.outgoing.map(i=><div class="party-invitation" key={i.id}><span>Waiting for <strong>{i.name}</strong></span><button class="btn" disabled={busy} onClick={()=>void act('cancel',{invite:i.id})}>Cancel</button></div>)}
    </>}
  </PanelFrame>;
}

export function PartyFrames(){
  const party=useUI(s=>s.party);if(!party)return null;
  return <div class="party-frames interactive">
    {party.incoming.length>0&&<button class="btn" onClick={()=>togglePanel('party',true)}>Party invitations · {party.incoming.length}</button>}
    {party.members.filter(m=>m.key!==party.you).map(m=><button class="party-frame" key={m.key} onClick={()=>togglePanel('party',true)}>
      <span>{m.name}{m.key===party.leader?' · Leader':''} · {m.level}</span>
      <Bar tone="life" frac={m.online?(m.hp??0):0} text={!m.online?'Reconnecting':m.dead?'Defeated':ZONES[m.zone??'']?.name??'Travelling'} height={12}/>
    </button>)}
  </div>;
}
