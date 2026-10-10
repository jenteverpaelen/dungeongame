import {useEffect,useState} from 'preact/hooks';
import {PARTY_ACTIVITIES,type PartyDirectory} from '@shared/party';
import {PARTY_MAX} from '@shared/constants';
import {ZONES} from '@shared/data/zones';
import {togglePanel,useUI} from '../store';
import {PanelFrame,Bar,Tabs} from './common';
import {run} from './util';
import {ClassEmblem} from '../hud/Glyphs';

export function PartyPanel(){
  const party=useUI(s=>s.party),[tab,setTab]=useState<'members'|'invitations'|'directory'>(()=>party?.incoming.length?'invitations':'members'),[name,setName]=useState(''),[busy,setBusy]=useState(false),[directory,setDirectory]=useState<PartyDirectory|null>(null);
  const browse=async(page=0)=>{setBusy(true);try{const r=await run('party',{action:'browse',page});if(r.ok)setDirectory(r.data as PartyDirectory);}finally{setBusy(false);}};
  useEffect(()=>{if(tab==='directory')void browse();},[tab]);
  if(!party)return <PanelFrame id="party" title="Party" width={760}><p>Waiting for party information…</p></PanelFrame>;
  const lead=party.you===party.leader&&!!party.id;
  const act=async(action:string,args:Record<string,unknown>={})=>{setBusy(true);try{const result=await run('party',{action,...args});if(result.ok&&action==='invite')setName('');if(result.ok&&action==='join')setTab('members');}finally{setBusy(false);}};
  return <PanelFrame id="party" title="Party" width={760} sub={`${party.members.length} / ${PARTY_MAX} members`}>
    <Tabs tabs={[{id:'members',label:'Members'},{id:'invitations',label:'Invitations',badge:party.incoming.length},{id:'directory',label:'Find group'}]} value={tab} onChange={setTab}/>
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
      {(!party.id||lead)&&<><h3>Public group listing</h3><p class="pn-note">Listing shares your name, level, zone and channel. Anyone you have not blocked can join while a place is free. Players still travel themselves.</p><div class="social-options">{PARTY_ACTIVITIES.map(activity=><button class={`btn tiny${party.listing===activity?' primary':''}`} disabled={busy||!party.enabled} onClick={()=>void act('list',{activity})}>List for {activity}</button>)}{party.listing&&<button class="btn tiny" disabled={busy} onClick={()=>void act('unlist')}>Unlist</button>}</div></>}
      <p class="pn-note">Invitations and disconnected places last 60 seconds. If the leader disconnects, an online member takes over. Party membership does not move anyone or bypass story gates. Personal loot and nearby experience rules remain in effect.</p>
    </>:tab==='invitations'?<>
      <p class="pn-note">Invitations expire after 60 seconds. Accepting requires an available place; leave your current party first.</p>
      {!party.incoming.length&&!party.outgoing.length&&<p>No pending invitations.</p>}
      {party.incoming.map(i=><div class="party-invitation" key={i.id}><span><strong>{i.from}</strong> invited you</span><button class="btn primary" disabled={busy||!!party.id||!party.enabled} onClick={()=>void act('accept',{invite:i.id})}>Accept</button><button class="btn" disabled={busy} onClick={()=>void act('decline',{invite:i.id})}>Decline</button></div>)}
      {party.outgoing.map(i=><div class="party-invitation" key={i.id}><span>Waiting for <strong>{i.name}</strong></span><button class="btn" disabled={busy} onClick={()=>void act('cancel',{invite:i.id})}>Cancel</button></div>)}
    </>:<>
      <p class="pn-note">Join an openly listed group. Joining does not teleport you or unlock story routes. Full, unavailable and blocked groups are hidden.</p>
      <button class="btn" disabled={busy||!party.enabled} onClick={()=>void browse(directory?.page)}>Refresh groups</button>
      <div class="social-list">{directory?.entries.map(entry=><div class="social-row" key={entry.id}><div><strong>{entry.leader} · {entry.activity}</strong><span>Level {entry.level} · {entry.members}/{PARTY_MAX} · {ZONES[entry.zone]?.name??entry.zone} · Channel {entry.channel}</span></div><button class="btn" disabled={busy||!!party.id||!party.enabled} onClick={()=>void act('join',{group:entry.id})}>Join</button></div>)}</div>
      {directory&&!directory.entries.length&&<p>No open groups. List your own from Members.</p>}
      {party.id&&<p class="pn-note">Leave your current party before joining another.</p>}
      {directory&&<div class="social-pages"><button class="btn tiny" disabled={busy||directory.page===0} onClick={()=>void browse(directory.page-1)}>Previous</button><span>{directory.page+1} / {directory.pages} · {directory.total} groups</span><button class="btn tiny" disabled={busy||directory.page===directory.pages-1} onClick={()=>void browse(directory.page+1)}>Next</button></div>}
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
