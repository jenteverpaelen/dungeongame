import test from 'node:test';
import assert from 'node:assert/strict';
import {Parties} from '../src/party';
import {createCharacter} from '../../shared/src/character';
import type {Session} from '../src/net/session';
import type {S2C} from '../../shared/src/protocol';
import {World} from '../src/world';
import {runCommand} from '../src/commands';
import {computeStats} from '../../shared/src/stats';
assert(process.env.DATA_DIR,'Fresh isolated DATA_DIR required');
function fixture(disabled=new Set<string>()){
  const live=new Set<Session>(),messages=new Map<string,S2C[]>();let now=100000;
  const parties=new Parties(()=>live,disabled);
  const peers=['Aster','Briar','Cairn','Dara','Ember','Fenn'].map((name,i)=>{
    const save=createCharacter(name,(['warrior','ranger','mage'] as const)[i%3],102);messages.set(save.id,[]);
    const s={save,sessionId:name,rec:{zoneId:'hearthmere',channel:1,inst:{partyStatus:()=>({hp:40,mhp:100,dead:false})}},send(m:S2C){messages.get(save.id)!.push(m);}} as unknown as Session;
    live.add(s);parties.connected(s,now);return s;
  });
  const cmd=(s:Session,action:string,args:Record<string,unknown>={})=>{now+=1100;return parties.command(s,{action,...args},now);};
  const invite=(from:Session,to:Session)=>{assert(cmd(from,'invite',{name:to.save.name}).ok);return parties.view(to,now).incoming.find(i=>i.from===from.save.name)!.id;};
  const accept=(from:Session,to:Session)=>{const i=invite(from,to);assert(cmd(to,'accept',{invite:i}).ok);};
  return {parties,peers,live,messages,cmd,invite,accept,now:()=>now,setNow:(n:number)=>now=n};
}

test('four-member capacity, consent, stale/foreign requests, leader changes and private view',()=>{
  const f=fixture(),[a,b,c,d,e]=f.peers;
  const i=f.invite(a,b);assert(!f.cmd(c,'accept',{invite:i}).ok);assert.equal(f.parties.view(b).members.length,0);
  assert(f.cmd(b,'decline',{invite:i}).ok);assert(!f.cmd(b,'accept',{invite:i}).ok);
  const cancelled=f.invite(a,b);assert(f.cmd(a,'cancel',{invite:cancelled}).ok);assert(!f.cmd(b,'accept',{invite:cancelled}).ok);
  f.accept(a,b);f.accept(a,c);f.accept(a,d);assert.equal(f.parties.view(a).members.length,4);
  assert(!f.cmd(a,'invite',{name:e.save.name}).ok);assert(!f.cmd(b,'invite',{name:e.save.name}).ok);
  const view=f.parties.view(a),keyB=view.members.find(m=>m.name===b.save.name)!.key;
  assert(!f.cmd(b,'kick',{member:view.you}).ok);assert(f.cmd(a,'leader',{member:keyB}).ok);
  assert(!f.cmd(a,'kick',{member:keyB}).ok);assert(f.cmd(b,'kick',{member:view.members.find(m=>m.name===c.save.name)!.key}).ok);
  assert.equal(f.parties.view(c).id,null);assert(f.cmd(a,'leave').ok);assert.equal(f.parties.view(a).id,null);
  const privateView=f.parties.view(b),saveIds=f.peers.map(p=>p.save.id);
  assert(!saveIds.includes(privateView.id!));
  for(const member of privateView.members){
    assert(!saveIds.includes(member.key));
    assert.deepEqual(Object.keys(member).sort(),['channel','classId','dead','hp','key','level','name','online','zone']);
  } // Legacy IDs derive from public names; assert the payload boundary, not secrecy of those names.
  assert.equal(f.parties.view(e).members.length,0);assert.equal(f.parties.view(b).members[0].hp,.4);
});

test('pending acceptance rechecks capacity, expiry and old leadership',()=>{
  const f=fixture(),[a,b,c,d,e]=f.peers;const ids=[b,c,d,e].map(p=>f.invite(a,p));
  for(let j=0;j<3;j++)assert(f.cmd([b,c,d][j],'accept',{invite:ids[j]}).ok);
  assert(!f.cmd(e,'accept',{invite:ids[3]}).ok);assert.equal(f.parties.view(a).members.length,4);
  const g=fixture(),[x,y,z]=g.peers;g.accept(x,y);const old=g.invite(x,z);
  assert(g.cmd(x,'leader',{member:g.parties.view(x).members.find(m=>m.name===y.save.name)!.key}).ok);assert(!g.cmd(z,'accept',{invite:old}).ok);
  const exp=g.invite(y,z);g.setNow(g.now()+60001);assert(!g.cmd(z,'accept',{invite:exp}).ok);
});

test('disconnect transfers leader, reserves bounded place, reconnect restores membership and expiry removes it',()=>{
  const f=fixture(),[a,b,c]=f.peers;f.accept(a,b);f.accept(a,c);const group=f.parties.view(a).id;
  f.live.delete(a);f.parties.disconnected(a,f.now());let view=f.parties.view(b);
  assert.equal(view.leader,view.you);assert.equal(view.members.find(m=>m.name===a.save.name)!.online,false);
  f.live.add(a);f.parties.connected(a,f.now()+1000);assert.equal(f.parties.view(a).id,group);assert.notEqual(f.parties.view(a).leader,f.parties.view(a).you);
  f.live.delete(a);f.parties.disconnected(a,f.now());f.parties.tick(f.now()+60001);assert.equal(f.parties.view(b).members.length,2);
  f.live.add(a);f.parties.connected(a,f.now()+60002);assert.equal(f.parties.view(a).id,null);
});

test('invite pacing, pending bounds and per-channel admission flag; leave still works',()=>{
  const f=fixture(),[a,b,c,d,e,z]=f.peers;f.invite(a,b);
  assert(!f.parties.command(a,{action:'invite',name:c.save.name},f.now()+1).ok);
  f.invite(a,c);f.invite(a,d);f.invite(a,e);assert(!f.cmd(a,'invite',{name:z.save.name}).ok);
  const disabled=new Set<string>(),g=fixture(disabled),[x,y]=g.peers;g.accept(x,y);disabled.add('hearthmere#1');
  assert(!g.cmd(x,'invite',{name:g.peers[2].save.name}).ok);assert(g.cmd(y,'leave').ok);assert(g.cmd(x,'leave').ok);
  assert(!g.parties.view(x).enabled);
});

test('actual World login, command routing, zone transfer, private health frames and logout use party membership',async()=>{
  const world=new World();await world.init();const peers:Session[]=[];
  try{
    for(const name of ['PartyWorldA','PartyWorldB']){
      const save=createCharacter(name,'warrior',102);
      const s={save,derived:computeStats(save),sessionId:name,rec:null,homeTown:null,hold:null,send(){},sendRaw(){},markDirty(){},saveNow(){},autosave(){},shutdown(){},changed(){},kick(){}} as unknown as Session;
      peers.push(s);world.login(s,(you,zone)=>({t:'welcome',you,char:save,derived:s.derived,zone,time:0,world:world.infoFor(s)}));
    }
    const [a,b]=peers;assert(runCommand(a,world,'party',{action:'invite',name:b.save.name}).ok);
    assert(runCommand(b,world,'party',{action:'accept',invite:world.parties.view(b).incoming[0].id}).ok);
    assert.equal(world.parties.view(a).members.length,2);assert.equal(world.parties.view(a).members[1].hp,1);
    assert(world.channel(b,2).ok);world.parties.tick();assert.equal(world.parties.view(a).members[1].channel,2);
    world.logout(a);assert.equal(world.parties.view(b).leader,world.parties.view(b).you);
  }finally{for(const s of peers)if(s.rec)world.logout(s);await world.shutdown();}
});

test('public directory joins revalidate capacity and disappear on leadership changes or unlisting',()=>{
  const f=fixture(),[a,b,c,d,e]=f.peers;
  assert(f.cmd(a,'list',{activity:'story'}).ok);const group=f.parties.directory(b).entries[0].id;
  assert(f.cmd(b,'join',{group}).ok);assert(f.cmd(c,'join',{group}).ok);assert(f.cmd(d,'join',{group}).ok);
  assert.equal(f.parties.directory(e).total,0);assert(!f.cmd(e,'join',{group}).ok);
  assert(!f.cmd(b,'list',{activity:'rifts'}).ok);assert(f.cmd(d,'leave').ok);assert.equal(f.parties.directory(e).total,1);
  assert(f.cmd(a,'leader',{member:f.parties.view(b).you}).ok);assert.equal(f.parties.directory(e).total,0);assert(!f.cmd(e,'join',{group}).ok);
  assert(f.cmd(b,'list',{activity:'rifts'}).ok);f.live.delete(b);f.parties.disconnected(b,f.now());assert.equal(f.parties.directory(e).total,0);
  assert(f.cmd(a,'list',{activity:'exploration'}).ok);assert(f.cmd(a,'unlist').ok);assert.equal(f.parties.directory(e).total,0);
});
