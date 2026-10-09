import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { createCharacter } from '../../shared/src/character';
import type { S2C } from '../../shared/src/protocol';
import { Session } from '../src/net/session';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import { ensureDataDir, flushSaves } from '../src/persistence';
import { CommandReceipts, MAX_COMMAND_RECEIPTS } from '../src/net/commandReceipts';
import { MAX_MESSAGE_BYTES } from '../../shared/src/protocol';

assert.ok(process.env.DATA_DIR, 'Replay tests require isolated DATA_DIR');
ensureDataDir();
const codec = new Packr({ useRecords: false });
class FixtureSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  messages: S2C[] = [];
  send(bytes: Uint8Array, _options: unknown, callback?: () => void) { this.messages.push(codec.unpack(bytes) as S2C); callback?.(); }
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
  session.state = 'ready'; session.recompute();
  world.login(session, (you, zone) => ({ t: 'welcome', you, char: session.save, derived: session.derived, zone, time: Date.now(), world: world.infoFor(session) }));
  const near = (role: string) => {
    const npc = session.rec!.inst.map.town!.npcs.find(n => n.role === role)!;
    const player = (session.rec!.inst as Instance).players.find(p => p.link === session)!;
    player.x = player.mv.x = npc.approach[0]; player.y = player.mv.y = npc.approach[1];
  };
  const cmd = (id: number, op: string, a?: unknown) => {
    const start = socket.messages.length;
    socket.emit('message', codec.pack({ t: 'cmd', id, op, a }), true);
    return socket.messages.slice(start).find(m => m.t === 'res') as Extract<S2C, { t: 'res' }> | undefined;
  };
  return { session, socket, near, cmd, async close() { session.shutdown('Fixture complete'); await world.shutdown(); await flushSaves(); } };
}

test('duplicate fusion request spends and produces once; a new ID performs another intentional fusion', async () => {
  const f = await fixture();
  try {
    f.near('jeweler');
    const first = f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 });
    assert.ok(first?.ok, first?.err ?? 'fusion failed');
    const afterFirst = structuredClone({ gold: f.session.save.gold, gems: f.session.save.gems, cube: f.session.save.cube });
    const repeat = f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 });
    console.log(JSON.stringify({ firstGemCount: afterFirst.gems['ruby:2'], afterDuplicateGemCount: f.session.save.gems['ruby:2'], firstGold: afterFirst.gold, afterDuplicateGold: f.session.save.gold }));
    assert.deepEqual(repeat, first);
    assert.deepEqual({ gold: f.session.save.gold, gems: f.session.save.gems, cube: f.session.save.cube }, afterFirst);
    assert.ok(f.cmd(2, 'fuseGem', { gem: 'ruby', rank: 1 })?.ok);
    assert.equal(f.session.save.gems['ruby:2'], 2);
    assert.deepEqual(f.cmd(1, 'fuseGem', { rank: 1, gem: 'ruby' }), first, 'key order does not change intent');
    assert.match(f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 2 })!.err!, /different/);
    assert.match(f.cmd(1, 'salvageAll', { rarities: ['normal'] })!.err!, /different/);
    assert.equal(f.session.save.gems['ruby:2'], 2);
  } finally { await f.close(); }
});

test('failed service/debug attempts stay failed on replay, while new IDs revalidate current state', async () => {
  const f = await fixture(), oldDebug = process.env.ENABLE_DEBUG;
  try {
    f.near('blacksmith');
    const denied = f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 });
    assert.match(denied!.err!, /Stand beside/);
    f.near('jeweler');
    assert.deepEqual(f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 }), denied);
    assert.equal(f.session.save.gems['ruby:2'], undefined);
    assert.ok(f.cmd(2, 'fuseGem', { gem: 'ruby', rank: 1 })?.ok);
    process.env.ENABLE_DEBUG = '0';
    const debug = f.cmd(3, 'debug', { op: 'gold', n: 7 }), before = f.session.save.gold;
    assert.equal(debug?.ok, false);
    process.env.ENABLE_DEBUG = '1';
    assert.deepEqual(f.cmd(3, 'debug', { op: 'gold', n: 7 }), debug);
    assert.equal(f.session.save.gold, before);
    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(f.cmd(id, 'fuseGem', { gem: 'ruby', rank: 1 })?.ok, false);
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
      assert.ok(f.cmd(1, 'fuseGem', { gem: 'ruby', rank: 1 })?.ok);
      assert.equal(f.session.save.gems['ruby:2'], 1);
    }
  } finally { await one.close(); await two.close(); }
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
