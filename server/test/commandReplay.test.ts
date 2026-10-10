import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { createCharacter } from '../../shared/src/character';
import type { S2C } from '../../shared/src/protocol';
import { Session } from '../src/net/session';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import { ensureDataDir, flushSaves, saveCharacter } from '../src/persistence';
import { DATA_DIR } from '../src/config';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { canEnchantAffix } from '../../shared/src/cube';
import { initializeCommandState } from '../src/net/persistedCommands';
import type { CommandRequest } from '../../shared/src/commandState';
import { CommandReceipts, MAX_COMMAND_RECEIPTS } from '../src/net/commandReceipts';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from '../../shared/src/protocol';

assert.ok(process.env.DATA_DIR, 'Replay tests require isolated DATA_DIR');
ensureDataDir();
const codec = new Packr({ useRecords: false });
class FixtureSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  messages: S2C[] = [];
  send(bytes: Uint8Array, _options: unknown, callback?: () => void) { this.messages.push(codec.unpack(bytes) as S2C); callback?.(); this.emit('sent',this.messages.at(-1)); }
  close() { this.readyState = WebSocket.CLOSED; this.emit('close'); }
  terminate() { this.close(); }
  ping() {}
}
let sequence = 0;
async function fixture() {
  const world = new World(); await world.init();
  const socket = new FixtureSocket(), session = new Session(socket as unknown as WebSocket, world);
  session.save = createCharacter(`Replay${++sequence}`, 'warrior', 73);
  session.save.level = 70; session.save.cube.level = 8; session.save.gold = 1e9;
  session.save.gems['ruby:1'] = 60;
  initializeCommandState(session.save);session.state = 'ready'; session.recompute();
  world.login(session, (you, zone) => ({ t: 'welcome', you, char: session.save, derived: session.derived, zone, time: Date.now(), world: world.infoFor(session) }));
  const near = (role: string) => {
    const npc = session.rec!.inst.map.town!.npcs.find(n => n.role === role)!;
    const player = (session.rec!.inst as Instance).players.find(p => p.link === session)!;
    player.x = player.mv.x = npc.approach[0]; player.y = player.mv.y = npc.approach[1];
  };
  const requests=new Map<number,CommandRequest>();
  const cmd = async (id: number, op: string, a?: unknown) => {
    if(!requests.has(id))requests.set(id,{epoch:session.save.commands!.epoch,sequence:session.save.commands!.sequence,token:id.toString(16).padStart(32,'0')});
    const response=new Promise<Extract<S2C,{t:'res'}>>((resolve,reject)=>{
      const timer=setTimeout(()=>{socket.off('sent',listener);reject(new Error('Fixture command timed out'));},8000);
      const listener=(m:S2C)=>{if(m.t==='res'&&m.id===id){clearTimeout(timer);socket.off('sent',listener);resolve(m);}};
      socket.on('sent',listener);
    });
    socket.emit('message', codec.pack({ t: 'cmd', id, op, a, r:requests.get(id) }), true);
    return response;
  };
  return { session, socket, near, cmd, requests, async close() { session.shutdown('Fixture complete'); await world.shutdown(); await flushSaves(); } };
}

test('duplicate fusion request spends and produces once; a new ID performs another intentional fusion', async () => {
  const f = await fixture();
  try {
    f.near('jeweler');
    const first = (await f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 }));
    assert.ok(first?.ok, first?.err ?? 'fusion failed');
    const afterFirst = structuredClone({ gold: f.session.save.gold, gems: f.session.save.gems, cube: f.session.save.cube });
    const repeat = (await f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 }));
    console.log(JSON.stringify({ firstGemCount: afterFirst.gems['ruby:2'], afterDuplicateGemCount: f.session.save.gems['ruby:2'], firstGold: afterFirst.gold, afterDuplicateGold: f.session.save.gold }));
    assert.deepEqual(repeat, first);
    assert.deepEqual({ gold: f.session.save.gold, gems: f.session.save.gems, cube: f.session.save.cube }, afterFirst);
    assert.ok((await f.cmd(2, 'fuseGem', { gem: 'ruby', rank: 1 }))?.ok);
    assert.equal(f.session.save.gems['ruby:2'], 2);
    assert.deepEqual((await f.cmd(1, 'fuseGem', { rank: 1, gem: 'ruby' })), first, 'key order does not change intent');
    assert.match((await f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 2 }))!.err!, /different/);
    assert.match((await f.cmd(1, 'salvageAll', { rarities: ['normal'] }))!.err!, /different/);
    assert.equal(f.session.save.gems['ruby:2'], 2);
  } finally { await f.close(); }
});

test('failed service/debug attempts stay failed on replay, while new IDs revalidate current state', async () => {
  const f = await fixture(), oldDebug = process.env.ENABLE_DEBUG;
  try {
    f.near('blacksmith');
    const denied = (await f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 }));
    assert.match(denied!.err!, /Stand beside/);
    f.near('jeweler');
    assert.deepEqual((await f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 })), denied);
    assert.equal(f.session.save.gems['ruby:2'], undefined);
    assert.ok((await f.cmd(2, 'fuseGem', { gem: 'ruby', rank: 1 }))?.ok);
    process.env.ENABLE_DEBUG = '0';
    const debug = (await f.cmd(3, 'debug', { op: 'gold', n: 7 })), before = f.session.save.gold;
    assert.equal(debug?.ok, false);
    process.env.ENABLE_DEBUG = '1';
    assert.deepEqual((await f.cmd(3, 'debug', { op: 'gold', n: 7 })), debug);
    assert.equal(f.session.save.gold, before);
    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal((await f.cmd(id, 'fuseGem', { gem: 'ruby', rank: 1 }))?.ok, false);
    assert.equal(f.session.save.gems['ruby:2'], 1);
  } finally {
    if (oldDebug === undefined) delete process.env.ENABLE_DEBUG; else process.env.ENABLE_DEBUG = oldDebug;
    await f.close();
  }
});

test('each connection owns its own ID history', async () => {
  const one = await fixture(), two = await fixture();
  try {
    for (const f of [one, two]) {
      f.near('jeweler');
      assert.ok((await f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 }))?.ok);
      assert.equal(f.session.save.gems['ruby:2'], 1);
    }
  } finally { await one.close(); await two.close(); }
});

test('concurrent packets wait for replacement; duplicate intent spends once and the next mutation runs after saving',async t=>{
  const f=await fixture();let release!:()=>void;
  const barrier=new Promise<void>(r=>{release=r;});let entered!:()=>void;const writing=new Promise<void>(r=>{entered=r;});
  const file=path.join(DATA_DIR,f.session.save.id+'.json');
  await saveCharacter(f.session.save);const original=await fs.readFile(file,'utf8');
  const rename=fs.rename,mock=t.mock.method(fs,'rename',async (src:Parameters<typeof fs.rename>[0],dst:Parameters<typeof fs.rename>[1])=>{
    if(dst===file){entered();await barrier;}return rename(src,dst);
  });
  try{
    f.near('jeweler');const before=f.socket.messages.length;
    const first=f.cmd(1,'fuseGem',{gem:'ruby',rank:1});await Promise.race([writing,first.then(r=>{throw new Error('Response before write gate: '+JSON.stringify(r));})]);
    const duplicate=f.cmd(1,'fuseGem',{rank:1,gem:'ruby'});
    f.requests.set(2,{...f.requests.get(1)!});const newIdRetry=f.cmd(2,'fuseGem',{gem:'ruby',rank:1});
    const concurrent=f.cmd(3,'fuseGem',{gem:'ruby',rank:1});
    assert.equal(f.session.save.gems['ruby:2'],1);
    assert(!f.socket.messages.slice(before).some(m=>m.t==='res'||m.t==='char'),'nothing confirmed while replacement is pending');
    assert.equal(await fs.readFile(file,'utf8'),original);
    release();const replies=await Promise.all([first,duplicate,newIdRetry,concurrent]);
    assert(replies.every(r=>r.ok));
    const disk=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(disk.gems['ruby:2'],2);assert.equal(disk.commands.sequence,2);
  }finally{release();mock.mock.restore();await f.close();}
});

test('real session login restores paid enchant choices; saved retry returns the same outcome and stale intent cannot pay again',async()=>{
  const f=await fixture();f.near('mystic');for(const k of Object.keys(f.session.save.materials))f.session.save.materials[k as keyof typeof f.session.save.materials]=10000;
  const item=generateItem(new Rng(21),{ilvl:70,classId:'warrior',rarity:'rare',base:f.session.save.equipment.mainhand!.base});
  f.session.save.inventory[0]=item;const affix=item.affixes.findIndex((_,i)=>canEnchantAffix(item,i));
  const first=await f.cmd(1,'enchantRoll',{itemId:item.id,affix});assert(first.ok,first.err??'Enchant roll failed');
  const expected=structuredClone(f.session.pendingEnchant),gold=f.session.save.gold,request=f.requests.get(1)!;
  const name=f.session.save.name;await f.close();
  const world=new World();await world.init();const socket=new FixtureSocket(),session=new Session(socket as unknown as WebSocket,world);
  const next=<T extends S2C['t']>(kind:T,id?:number)=>new Promise<Extract<S2C,{t:T}>>((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off('sent',listener);reject(new Error('Reconnect fixture timeout'));},8000);
    const listener=(m:S2C)=>{if(m.t===kind&&(id===undefined||(m as {id?:number}).id===id)){clearTimeout(timer);socket.off('sent',listener);resolve(m as Extract<S2C,{t:T}>);}};socket.on('sent',listener);
  });
  try{
    const welcome=next('welcome');socket.emit('message',codec.pack({t:'hello',name,classId:'warrior',v:PROTOCOL_VERSION}),true);await welcome;
    assert.deepEqual(session.pendingEnchant,expected);assert.equal(session.save.gold,gold);
    const replay=next('res',1);socket.emit('message',codec.pack({t:'cmd',id:1,op:'enchantRoll',a:{itemId:item.id,affix},r:request}),true);
    assert.deepEqual((await replay).data,first.data);assert.equal(session.save.gold,gold);
    const changed=next('res',2);socket.emit('message',codec.pack({t:'cmd',id:2,op:'enchantRoll',a:{itemId:item.id,affix:affix+1},r:request}),true);
    assert.match((await changed).err!,/different/);assert.equal(session.save.gold,gold);
    const npc=session.rec!.inst.map.town!.npcs.find(n=>n.role==='mystic')!,p=(session.rec!.inst as Instance).playerById(session.entityId)!;
    p.x=p.mv.x=npc.approach[0];p.y=p.mv.y=npc.approach[1];p.debugInfiniteHp=true;
    const pick=next('res',3);socket.emit('message',codec.pack({t:'cmd',id:3,op:'enchantPick',a:{itemId:item.id,choice:1},r:{epoch:request.epoch,sequence:session.save.commands!.sequence,token:'f'.repeat(32)}}),true);
    assert((await pick).ok);assert.equal(session.save.commands!.pendingEnchant,undefined);
    assert.deepEqual(session.save.inventory[0]!.affixes[affix],expected!.options[0]);
  }finally{session.shutdown('Reconnect fixture complete');await world.shutdown();await flushSaves();}
});

test('receipt snapshots survive later mutation and thrown handlers cannot execute twice', () => {
  const receipts = new CommandReceipts(), item = { affixes: [{ value: 12 }], sockets: ['ruby'] };
  const args = { nested: { b: [1, true, null], a: 'yes' } };
  let calls = 0;
  const result = receipts.execute(1, 'fixture', args, () => { calls++; return { t: 'res', id: 1, ok: true, data: item }; });
  item.affixes[0].value = 999; item.sockets.push('emerald');
  const repeat = () => receipts.execute(1, 'fixture', { nested: { a: 'yes', b: [1, true, null] } }, () => { throw new Error('Must not run'); });
  const cached = repeat();
  assert.deepEqual(cached.data, { affixes: [{ value: 12 }], sockets: ['ruby'] });
  (cached.data as typeof item).affixes[0].value = 88;
  assert.equal(((repeat().data as typeof item).affixes[0].value), 12);
  assert.equal(calls, 1); assert.equal(result.ok, true);
  const fail = () => receipts.execute(2, 'fixture', {}, () => { calls++; throw new Error('After possible partial mutation'); });
  assert.equal(fail().ok, false); assert.equal(fail().ok, false); assert.equal(calls, 2);
});

test('count/byte eviction and oversized results never reopen an older ID', () => {
  const receipts = new CommandReceipts();
  const run = (id: number, data?: unknown) => receipts.execute(id, 'fixture', {}, () => ({ t: 'res', id, ok: true, data }));
  for (let id = 1; id <= MAX_COMMAND_RECEIPTS + 1; id++) assert.ok(run(id).ok);
  assert.match(run(1).err!, /expired/);
  assert.ok(run(MAX_COMMAND_RECEIPTS + 1).ok);
  const large = 'a'.repeat(MAX_MESSAGE_BYTES / 2);
  assert.ok(run(MAX_COMMAND_RECEIPTS + 2, large).ok);
  assert.ok(run(MAX_COMMAND_RECEIPTS + 3, large).ok);
  assert.match(run(MAX_COMMAND_RECEIPTS + 2, large).err!, /expired/);
  const hugeId = MAX_COMMAND_RECEIPTS + 4;
  assert.ok(run(hugeId, 'a'.repeat(MAX_MESSAGE_BYTES)).ok);
  assert.match(run(hugeId).err!, /expired/);
});

test('invalid identifiers and ambiguous/non-JSON arguments cannot reach a mutating handler', () => {
  const receipts = new CommandReceipts();
  let calls = 0;
  const execute = () => { calls++; return { t: 'res' as const, id: 1, ok: true }; };
  for (const id of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(receipts.execute(id, 'fixture', {}, execute).ok, false);
  const circular: Record<string, unknown> = {}; circular.self = circular;
  for (const args of [{ n: NaN }, { n: Infinity }, { n: 1n }, { n: undefined }, new Date(), Buffer.from('binary'), circular]) {
    assert.equal(receipts.execute(1, 'fixture', args, execute).ok, false);
  }
  assert.equal(calls, 0);
  assert.ok(receipts.execute(1, 'fixture', {}, execute).ok, 'invalid envelopes have no completed receipt');
});
