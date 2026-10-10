import {useState} from 'preact/hooks';
import {SOCIAL_LIMIT,SOCIAL_PAGE_SIZE} from '@shared/social';
import {ZONES} from '@shared/data/zones';
import {ui,useUI,togglePanel} from '../store';
import {PanelFrame,Tabs} from './common';
import {run} from './util';
import {openInspection} from './inspect';

export function whisperTo(name:string){togglePanel('social',false);ui.set({chatChannel:'whisper',chatTarget:name,chatOpen:true});}
type Tab='friends'|'blocked'|'muted'|'privacy';
export function SocialPanel(){
  const social=useUI(s=>s.social),[tab,setTab]=useState<Tab>('friends'),[page,setPage]=useState(0),[name,setName]=useState(''),[busy,setBusy]=useState(false);
  if(!social)return <PanelFrame id="social" title="Social" width={800}><p>Waiting for contacts…</p></PanelFrame>;
  const act=async(action:string,args:Record<string,unknown>={})=>{setBusy(true);try{const r=await run('social',{action,...args});if(r.ok)setName('');}finally{setBusy(false);}};
  const entries=tab==='privacy'?[]:social[tab].map(v=>typeof v==='string'?{name:v,online:false}:v),pages=Math.max(1,Math.ceil(entries.length/SOCIAL_PAGE_SIZE)),current=Math.min(page,pages-1);
  return <PanelFrame id="social" title="Social" width={800} sub="Friends, conversations & personal controls">
    <Tabs tabs={[{id:'friends',label:'Friends',badge:social.friends.length},{id:'blocked',label:'Blocked',badge:social.blocked.length},{id:'muted',label:'Muted',badge:social.muted.length},{id:'privacy',label:'Privacy'}]} value={tab} onChange={t=>{setTab(t);setPage(0);}}/>
    {(!social.enabled||!social.supported)&&<p class="pn-note">{!social.supported?'This contact record needs a supported game version.':'Social actions are disabled in this channel. You can still remove names or change privacy.'}</p>}
    {tab==='privacy'?<>
      <h3>Share online presence</h3><div class="social-options">{(['contacts','hidden'] as const).map(v=><button class={`btn${social.presence===v?' primary':''}`} disabled={busy||!social.supported} onClick={()=>void act('privacy',{presence:v,whispers:social.whispers})}>{v==='contacts'?'Mutual friends':'Hidden'}</button>)}</div>
      <p class="pn-note">Only friends who have also added you can see your level, zone and channel. Hidden does not conceal your hero in the world or your existing party frame.</p>
      <h3>Who can whisper to you?</h3><div class="social-options">{(['all','contacts','off'] as const).map(v=><button class={`btn${social.whispers===v?' primary':''}`} disabled={busy||!social.supported} onClick={()=>void act('privacy',{presence:social.presence,whispers:v})}>{v==='all'?'Everyone':v==='contacts'?'Mutual friends & party':'Nobody'}</button>)}</div>
      <p class="pn-note">Blocked names cannot message or invite you. Muted names have their messages hidden. These lists are saved with this character; other characters have their own lists.</p>
      <h3>Who can inspect your equipped items?</h3><div class="social-options">{(['all','contacts','off'] as const).map(v=><button class={`btn${social.inspect===v?' primary':''}`} disabled={busy||!social.supported} onClick={()=>void act('privacy',{presence:social.presence,whispers:social.whispers,inspect:v})}>{v==='all'?'Everyone':v==='contacts'?'Mutual friends & party':'Nobody'}</button>)}</div>
      <p class="pn-note">Inspection shares equipped item details only. Your bag, stash, currency and quest history stay private.</p>
    </>:<>
      <p class="pn-note">{tab==='friends'?'Add a character name to keep it here. Add each other to share presence; unavailable includes offline, private and unconfirmed contacts.':tab==='blocked'?'Blocking hides messages and presence and prevents invitations in both directions. Leave an existing party separately.':'Muting hides incoming messages without preventing invitations. Unmute at any time.'}</p>
      <form class="party-invite" onSubmit={e=>{e.preventDefault();void act(tab==='friends'?'add':tab==='blocked'?'block':'mute',{name:name.trim()});}}><label>Character name<input value={name} maxLength={16} onInput={e=>setName(e.currentTarget.value)} autoComplete="off"/></label><button class="btn primary" disabled={busy||!social.enabled||!social.supported||!name.trim()||entries.length>=SOCIAL_LIMIT}>{tab==='friends'?'Add friend':tab==='blocked'?'Block':'Mute'}</button></form>
      <div class="social-list">{entries.slice(current*SOCIAL_PAGE_SIZE,(current+1)*SOCIAL_PAGE_SIZE).map(friend=><div class="social-row" key={friend.name}>
        <div><strong>{friend.name}</strong>{tab==='friends'&&<span>{friend.online?`Level ${friend.level} · ${ZONES[friend.zone??'']?.name??'Travelling'} · Channel ${friend.channel}`:'Unavailable'}</span>}</div>
        {tab==='friends'&&<><button class="btn tiny" disabled={busy||!social.enabled} onClick={()=>void run('party',{action:'invite',name:friend.name})}>Invite</button><button class="btn tiny" disabled={!social.enabled} onClick={()=>whisperTo(friend.name)}>Whisper</button><button class="btn tiny" disabled={!social.enabled} onClick={()=>openInspection(friend.name)}>Inspect</button></>}
        <button class="btn tiny" disabled={busy||!social.supported} onClick={()=>void act(tab==='friends'?'remove':tab==='blocked'?'unblock':'unmute',{name:friend.name})}>{tab==='friends'?'Remove':tab==='blocked'?'Unblock':'Unmute'}</button>
      </div>)}</div>
      {!entries.length&&<p>No names on this list.</p>}
      <div class="social-pages"><button class="btn tiny" disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><span>{current+1} / {pages} · {entries.length} / {SOCIAL_LIMIT} names</span><button class="btn tiny" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next</button></div>
    </>}
    <div class="social-options social-chat-links">{(['zone','world','party','trade','lfg'] as const).map(ch=><button class="btn tiny" onClick={()=>{togglePanel('social',false);ui.set({chatChannel:ch,chatTarget:'',chatOpen:true});}}>{ch==='lfg'?'LFG':ch} chat</button>)}</div>
    <p class="pn-note">Press Enter to chat. /w Name message whispers; /p message reaches your party. Trade chat is conversation only.</p>
  </PanelFrame>;
}
