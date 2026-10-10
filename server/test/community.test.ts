import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Community,REPORT_RETENTION_MS} from '../src/community';
import {Social} from '../src/social';
import {Parties} from '../src/party';
import {createCharacter} from '../../shared/src/character';
import {selectedTitle} from '../../shared/src/community';
import {CommandReceipts} from '../src/net/commandReceipts';
import type {Session} from '../src/net/session';
import type {S2C} from '../../shared/src/protocol';
assert(process.env.DATA_DIR,'Fresh isolated DATA_DIR required');

async function fixture(){
  const live=new Set<Session>(),messages=new Map<string,S2C[]>(),kicked:string[]=[];
  const parties=new Parties(()=>live),social=new Social(()=>live,parties);
  const directory=path.join(process.env.DATA_DIR!,randomUUID());
  const create=()=>new Community(()=>live,(a,b)=>social.blocked(a,b),s=>social.isEnabled(s),directory,(a,b)=>social.presenceVisible(a,b));
  let community=create();await community.init();social.community=community;
  const room={zoneId:'hearthmere',channel:1,members:live};
  const peers=['GuildA','GuildB','GuildC','GuildD'].map(name=>{const save=createCharacter(name,'warrior',105);messages.set(save.id,[]);const s={save,rec:room,changed(){},send(m:S2C){messages.get(save.id)!.push(m);},kick(){kicked.push(save.id);}} as unknown as Session;live.add(s);return s;});
  let now=Date.now();
  const cmd=(s:Session,action:string,args:Record<string,unknown>={})=>community.command(s,{action,...args},now+=1100);
  const join=async(a:Session,b:Session)=>{assert((await cmd(a,'invite',{name:b.save.name})).ok);assert((await cmd(b,'accept',{invite:community.view(b).invites[0].id})).ok);};
  return {live,peers,social,messages,directory,kicked,cmd,join,get community(){return community;},async reload(){await community.shutdown();community=create();await community.init();social.community=community;},ledger:async()=>JSON.parse(await fs.readFile(path.join(directory,'ledger.json'),'utf8'))};
}

test('guild membership, concurrent invitations, rank permissions and MOTD persist; blocked/hidden presence stays private',async()=>{
  const f=await fixture(),[a,b,c,d]=f.peers;
  assert((await f.cmd(a,'create',{name:'Cinder Watch'})).ok);await f.join(a,b);
  assert.equal(f.community.view(b).invites.length,0);
  assert(!(await f.cmd(b,'motd',{text:'not allowed'})).ok);
  assert((await f.cmd(a,'promote',{name:b.save.name})).ok);
  assert((await f.cmd(b,'motd',{text:'Gather at the gate.'})).ok);
  assert((await f.cmd(c,'create',{name:'Other Watch'})).ok);
  await f.cmd(a,'invite',{name:d.save.name});await f.cmd(c,'invite',{name:d.save.name});
  const invites=f.community.view(d).invites;
  const results=await Promise.all(invites.map(i=>f.cmd(d,'accept',{invite:i.id})));
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal((await f.ledger()).guilds.flatMap((g:any)=>g.members).filter((m:any)=>m.id===d.save.id).length,1);
  assert(!(await f.cmd(b,'kick',{name:a.save.name})).ok);assert(!(await f.cmd(a,'leave')).ok);
  assert.equal(f.community.view(a).guild!.members.find(m=>m.name===b.save.name)!.online,false);
  f.social.command(a,{action:'add',name:b.save.name});f.social.command(b,{action:'add',name:a.save.name});
  assert(f.community.view(a).guild!.members.find(m=>m.name===b.save.name)!.online);
  f.social.command(b,{action:'privacy',presence:'hidden',whispers:'contacts'});assert(!f.community.view(a).guild!.members.find(m=>m.name===b.save.name)!.online);
  await f.reload();assert.equal(f.community.view(a).guild!.motd,'Gather at the gate.');assert.equal(f.community.view(b).guild!.rank,'officer');
  assert((await f.cmd(a,'leader',{name:b.save.name})).ok);assert((await f.cmd(a,'leave')).ok);assert.equal(f.community.view(a).guild,null);
});

test('guild chat recipients, report evidence, deduplication and thirty-day retention',async()=>{
  const f=await fixture(),[a,b,c]=f.peers;await f.cmd(a,'create',{name:'Report Watch'});await f.join(a,b);
  assert(f.social.chat(a,'<script>example</script>','guild').ok);
  const message=f.messages.get(b.save.id)!.find(m=>m.t==='chat') as Extract<S2C,{t:'chat'}>;
  assert(!f.messages.get(c.save.id)!.some(m=>m.t==='chat'));
  const report={name:a.save.name,category:'harassment',text:'Fixture allegation',message:message.messageId};
  assert(!(await f.cmd(c,'report',report)).ok);assert(!(await f.cmd(b,'report',{...report,message:'forged'})).ok);
  const one=await f.cmd(b,'report',report),two=await f.cmd(b,'report',report);assert(one.ok);assert.deepEqual(one,two);
  assert.equal((await f.ledger()).reports[0].evidence.text,message.text);assert(f.community.canSpeak(a));
  f.social.command(b,{action:'mute',name:a.save.name});const count=f.messages.get(b.save.id)!.length;assert(f.social.chat(a,'muted','guild').ok);assert.equal(f.messages.get(b.save.id)!.length,count);
  await f.reload();assert.equal(f.community.view(b).reports.length,1);assert.equal(f.community.view(a).reports.length,0);
  await f.community.prune(Date.now()+REPORT_RETENTION_MS+60000);assert.equal((await f.ledger()).reports.length,0);
});

test('local inbox moderation is audited/idempotent, filter matches never punish, expiry preserves permanent sanctions',async()=>{
  const f=await fixture(),[a,b]=f.peers;await f.cmd(a,'report',{name:b.save.name,category:'spam',text:'Fixture report'});
  const owner=async(action:string,args:Record<string,unknown>={})=>f.community.owner(randomUUID(),{action,reason:'Disposable fixture',...args});
  assert(!(await owner('filter',{phrases:['   '],links:true})).ok);
  assert((await owner('filter',{phrases:['fixturephrase'],links:true})).ok);assert(!f.social.chat(a,'fixturephrase','zone').ok);assert(!f.social.chat(a,'https://example.com','zone').ok);assert(f.community.canSpeak(a));
  assert((await owner('mute',{target:a.save.name,minutes:10})).ok);assert(!f.social.chat(a,'hello','zone').ok);
  assert((await owner('unmute',{target:a.save.name})).ok);assert(f.social.chat(a,'hello','zone').ok);
  const id=randomUUID(),request={action:'ban',target:b.save.name,minutes:0,reason:'Fixture ban'};
  await fs.writeFile(path.join(f.directory,'owner-inbox',id+'.json'),JSON.stringify(request));await f.community.maintain();assert(f.kicked.includes(b.save.id));assert(f.community.banned(b.save.id));
  assert((await f.community.owner(id,request)).ok);assert.equal((await f.ledger()).audit.filter((r:any)=>r.id===id).length,1);
  assert((await owner('resolve',{target:f.community.view(a).reports[0].id})).ok);assert(f.community.view(a).reports[0].resolved);
  await f.reload();assert(f.community.banned(b.save.id));await f.community.prune(Date.now()+REPORT_RETENTION_MS+1);assert(f.community.banned(b.save.id));assert.equal((await f.ledger()).audit.length,0);
  assert((await owner('unban',{target:b.save.name})).ok);assert(!f.community.banned(b.save.id));
});

test('failed ledger replacement publishes no success/state, and asynchronous receipt replay executes once',async()=>{
  const f=await fixture(),[a]=f.peers;
  await fs.mkdir(path.join(f.directory,'ledger.json')); // known disposable target: rename must fail
  await assert.rejects(f.cmd(a,'create',{name:'Unsaved Watch'}));assert.equal(f.community.view(a).guild,null);
  const receipts=new CommandReceipts();let calls=0,release!:()=>void;const gate=new Promise<void>(r=>release=r);
  const execute=async()=>{calls++;await gate;return {t:'res' as const,id:1,ok:true};};
  const one=receipts.executeAsync(1,'community',{action:'create'},execute),two=receipts.executeAsync(1,'community',{action:'create'},execute);
  assert(!(await receipts.executeAsync(1,'community',{action:'leave'},execute)).ok);release();assert.deepEqual(await one,await two);assert.equal(calls,1);
});

test('titles require earned milestones and malformed title data is not displayed',async()=>{
  const f=await fixture(),[a]=f.peers;
  assert(!f.social.command(a,{action:'title',title:'signal'}).ok);assert(f.social.command(a,{action:'title',title:'traveller'}).ok);assert.equal(selectedTitle(a.save),'Wayfarer');
  a.save.quests={last_transmission:{revision:1,step:99,claimed:true}};assert(f.social.command(a,{action:'title',title:'signal'}).ok);assert.equal(selectedTitle(a.save),'Last Listener');
  assert(f.social.command(a,{action:'title',title:''}).ok);assert.equal(selectedTitle(a.save),undefined);
});

test('full guilds reject pending accepts; corrupt ledgers fail closed; shutdown drains the owner inbox write',async()=>{
  const f=await fixture(),[a,b]=f.peers;await f.cmd(a,'create',{name:'Capacity Watch'});
  const data=await f.ledger();data.guilds[0].members.push(...Array.from({length:79},(_,i)=>({id:`member${i}`,name:`Member${i}`,rank:'member'})));
  await fs.writeFile(path.join(f.directory,'ledger.json'),JSON.stringify(data));await f.reload();
  assert(!(await f.cmd(a,'invite',{name:b.save.name})).ok);
  const id=randomUUID();await fs.writeFile(path.join(f.directory,'owner-inbox',id+'.json'),JSON.stringify({action:'mute',target:b.save.name,minutes:10,reason:'Shutdown fixture'}));
  const maintenance=f.community.maintain();await f.community.shutdown();await maintenance;assert.equal((await f.ledger()).audit.at(-1).id,id);
  assert(!(await f.cmd(a,'leave')).ok);
  data.guilds[0].members[1].rank='leader';await fs.writeFile(path.join(f.directory,'ledger.json'),JSON.stringify(data));
  await assert.rejects(f.reload(),/Invalid guild ledger/);
});
