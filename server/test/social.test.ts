import test from 'node:test';
import assert from 'node:assert/strict';
import {Social} from '../src/social';
import {Parties} from '../src/party';
import {Session} from '../src/net/session';
import {createCharacter} from '../../shared/src/character';
import {emptySocial,SOCIAL_LIMIT,validSocial} from '../../shared/src/social';
import {ensureDataDir,saveCharacter,loadCharacter,flushSaves} from '../src/persistence';
import {isPersistedCommand} from '../../shared/src/commandState';
import type {S2C} from '../../shared/src/protocol';
assert(process.env.DATA_DIR,'Fresh isolated DATA_DIR required');

function fixture(){
  const live=new Set<Session>(),messages=new Map<string,S2C[]>(),disabled=new Set<string>();
  const parties:Parties=new Parties(()=>live,undefined,(a,b)=>social.canInvite(a,b));
  const social:Social=new Social(()=>live,parties,disabled);
  const room={zoneId:'hearthmere',channel:1,members:live,inst:{partyStatus:()=>null}};
  const peers=['SocialA','SocialB','SocialC'].map(name=>{
    const save=createCharacter(name,'warrior',103);messages.set(save.id,[]);
    const p={save,rec:room,changed(){},send(m:S2C){messages.get(save.id)!.push(m);}} as unknown as Session;live.add(p);return p;
  });
  const cmd=(s:Session,action:string,name?:string)=>social.command(s,{action,name});
  return {live,parties,social,peers,messages,disabled,cmd};
}
test('friends require mutual presence consent; hiding/blocking suppresses location and offline never discloses last seen',()=>{
  const f=fixture(),[a,b]=f.peers;assert(f.cmd(a,'add',b.save.name).ok);assert(!f.social.view(a).friends[0].online);
  assert(f.cmd(b,'add',a.save.name).ok);assert(f.social.view(a).friends[0].online);
  assert(f.social.command(b,{action:'privacy',presence:'hidden',whispers:'contacts'}).ok);
  assert.deepEqual(f.social.view(a).friends,[{name:b.save.name,online:false}]);
  assert(f.social.command(b,{action:'privacy',presence:'contacts',whispers:'contacts'}).ok);
  assert(f.cmd(a,'block',b.save.name).ok);assert(!f.social.view(a).friends[0].online);assert(!f.social.view(b).friends[0].online);
  assert(f.cmd(a,'unblock',b.save.name).ok);f.live.delete(b);f.social.disconnected(b);assert.deepEqual(f.social.view(a).friends,[{name:b.save.name,online:false}]);
});
test('whisper privacy, party membership, block/mute, channels and text normalization select only allowed recipients',()=>{
  const f=fixture(),[a,b,c]=f.peers;
  assert(!f.social.chat(a,'private','whisper',b.save.name).ok);
  assert(f.cmd(a,'add',b.save.name).ok);assert(f.cmd(b,'add',a.save.name).ok);
  assert(f.social.chat(a,'<img src=x onerror=alert(1)>\u202e hello\nworld','whisper',b.save.name).ok);
  assert.equal(f.messages.get(c.save.id)!.filter(m=>m.t==='chat').length,0);
  const msg=f.messages.get(b.save.id)!.find(m=>m.t==='chat')!;assert.equal(msg.t,'chat');if(msg.t==='chat'){assert.equal(msg.ch,'whisper');assert.equal(msg.to,b.save.name);assert.equal(msg.text,'<img src=x onerror=alert(1)> hello world');}
  assert(f.cmd(b,'mute',a.save.name).ok);assert(!f.social.chat(a,'private','whisper',b.save.name).ok);
  const count=f.messages.get(b.save.id)!.length;assert(f.social.chat(a,'public','world').ok);assert.equal(f.messages.get(b.save.id)!.length,count);
  assert(f.cmd(b,'unmute',a.save.name).ok);
  assert(f.parties.command(a,{action:'invite',name:c.save.name}).ok);assert(f.parties.command(c,{action:'accept',invite:f.parties.view(c).incoming[0].id}).ok);
  assert(f.social.chat(a,'party whisper','whisper',c.save.name).ok);
  const before=f.messages.get(b.save.id)!.length;assert(f.social.chat(a,'group','party').ok);assert.equal(f.messages.get(b.save.id)!.length,before);
  assert(f.cmd(c,'block',a.save.name).ok);const blocked=f.messages.get(c.save.id)!.length;
  for(const channel of ['zone','world','party','trade','lfg'])assert(f.social.chat(a,'test',channel).ok);
  assert.equal(f.messages.get(c.save.id)!.length,blocked);assert(!f.social.chat(a,'test','guild').ok);
  assert(f.social.command(b,{action:'privacy',presence:'contacts',whispers:'off'}).ok);assert(!f.social.chat(a,'private','whisper',b.save.name).ok);
});
test('block cancels pending invitations and denies both invitation directions, including later accept',()=>{
  const f=fixture(),[a,b]=f.peers;assert(f.parties.command(a,{action:'invite',name:b.save.name}).ok);const id=f.parties.view(b).incoming[0].id;
  assert(f.cmd(b,'block',a.save.name).ok);assert(!f.parties.command(b,{action:'accept',invite:id}).ok);
  assert(!f.parties.command(a,{action:'invite',name:b.save.name},Date.now()+2000).ok);
  assert(f.parties.command(a,{action:'leave'}).ok);assert(!f.parties.command(b,{action:'invite',name:a.save.name}).ok);
});
test('contact persistence, limits, malformed/unknown state preservation, and disabled-channel escape controls',async()=>{
  const f=fixture(),[a,b]=f.peers;assert(isPersistedCommand('social'));
  assert(f.cmd(a,'add',b.save.name).ok);assert(!f.cmd(a,'add',b.save.name.toLowerCase()).ok);assert(!f.cmd(a,'add','../other').ok);
  assert(f.cmd(a,'block','OfflineName').ok);assert(f.cmd(a,'mute','MutedName').ok);
  ensureDataDir();await saveCharacter(a.save);await flushSaves();const loaded=await loadCharacter(a.save.id);assert.deepEqual(loaded!.social,a.save.social);
  a.save=loaded!;f.disabled.add('hearthmere#1');assert(!f.cmd(a,'add','NewName').ok);assert(f.cmd(a,'unblock','OfflineName').ok);assert(f.cmd(a,'remove',b.save.name).ok);
  f.disabled.clear();a.save.social={...emptySocial(),friends:Array.from({length:SOCIAL_LIMIT},(_,i)=>`Contact${i}`)};assert(validSocial(a.save.social));assert(!f.cmd(a,'add','Overflow').ok);
  (a.save.social as unknown as {revision:number}).revision=99;const original=JSON.stringify(a.save.social);assert(!f.cmd(a,'remove','Contact0').ok);assert(!f.social.chat(a,'hello').ok);assert.equal(JSON.stringify(a.save.social),original);
});
test('actual Session chat limiter shares its five-message budget across direct channels and slash commands',()=>{
  let sent=0,limited=0;
  const context={chatTokens:5,chatAt:Date.now(),world:{chat(){sent++;},systemMessage(){limited++;}},slash(){sent++;}};
  const call=(Session.prototype as unknown as {onChat:(text:unknown,ch?:unknown,to?:unknown)=>void}).onChat;
  for(let i=0;i<6;i++)call.call(context,i%2?'/p hello':'hello','whisper','SocialB');
  assert.equal(sent,5);assert.equal(limited,1);
});
