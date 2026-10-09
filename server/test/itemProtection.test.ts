import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { computeStats } from '../../shared/src/stats';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import { salvageYield, salvageXp } from '../../shared/src/cube';
import { SAVE_VERSION } from '../../shared/src/saveVersion';
import type { CmdOp } from '../../shared/src/protocol';
import type { Rarity } from '../../shared/src/types';
import type { Session } from '../src/net/session';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import { runCommand } from '../src/commands';
import { saveCharacter, loadCharacter, normalizeSave, flushSaves } from '../src/persistence';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
let seq = 0;
async function fixture() {
  const world = new World(); await world.init();
  const save = createCharacter(`Protect${++seq}`, 'warrior', 47);
  save.level = 70; save.cube.level = 8; save.gold = 1e9;
  for (const k of Object.keys(save.materials) as (keyof typeof save.materials)[]) save.materials[k] = 10000;
  const s = { save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null,
    pendingEnchant: null, send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {},
    changed() { s.derived = computeStats(save); },
  } as unknown as Session;
  world.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: world.infoFor(s) }));
  const cmd = (op: CmdOp, a: Record<string, unknown>) => {
    const role = SERVICE_ROLE[op];
    if (role) {
      const n = s.rec!.inst.map.town!.npcs.find(n => n.role === role)!;
      const p = (s.rec!.inst as Instance).players.find(p => p.link === s)!;
      p.x = p.mv.x = n.approach[0]; p.y = p.mv.y = n.approach[1];
    }
    return runCommand(s, world, op, a);
  };
  const item = (rarity: Rarity) => {
    const it = generateItem(new Rng(83 + save.inventory.filter(Boolean).length), { classId: 'warrior', ilvl: 20, rarity,
      ...(rarity === 'legendary' ? { legendary: 'ouroboros_loop' } : { base: 'sword' }) });
    save.inventory[save.inventory.findIndex(i => !i)] = it; return it;
  };
  return { world, save, cmd, item };
}

test('protected items reject every destructive command before item or currency mutation', async () => {
  const f = await fixture();
  try {
    for (const [op, rarity] of [['destroy','normal'],['salvage','magic'],['transmute','rare'],['extract','legendary'],['reforge','legendary']] as const) {
      const it = f.item(rarity); assert(f.cmd('itemProtect', { itemId: it.id, protected: true }).ok);
      const before = structuredClone(f.save), r = f.cmd(op, { itemId: it.id });
      assert.equal(r.ok, false, op); assert.match(r.err!, /protected/); assert.deepEqual(f.save, before, op);
    }
  } finally { await f.world.shutdown(); }
});

test('bulk salvage conserves protected items and only rewards unprotected inputs', async () => {
  const f = await fixture();
  try {
    const kept = f.item('magic'), consumed = f.item('magic'); kept.protected = true;
    const before = structuredClone(f.save), r = f.cmd('salvageAll', { rarities: ['magic'] });
    assert(r.ok); assert.deepEqual(r.data, { count: 1, mats: salvageYield(consumed), xp: salvageXp(consumed), cubeLevels: 0 });
    assert.deepEqual(f.save.inventory.find(i => i?.id === kept.id), kept);
    assert(!f.save.inventory.some(i => i?.id === consumed.id));
    for (const k of Object.keys(f.save.materials) as (keyof typeof f.save.materials)[])
      assert.equal(f.save.materials[k] - before.materials[k], salvageYield(consumed)[k] ?? 0);
    assert.equal(f.cmd('salvageAll', { rarities: ['magic'] }).ok, false);
  } finally { await f.world.shutdown(); }
});

test('protection survives equipment, targeted upgrade, stash movement and disk reload; unprotect restores consumption', async () => {
  const f = await fixture();
  try {
    const it = f.item('rare'); assert(f.cmd('itemProtect', { itemId: it.id, protected: true }).ok);
    assert(f.cmd('equip', { itemId: it.id }).ok); assert.equal(f.save.equipment.mainhand!.protected, true);
    assert(f.cmd('upgrade', { itemId: it.id }).ok); assert.equal(f.save.equipment.mainhand!.protected, true);
    assert(f.cmd('unequip', { slot: 'mainhand' }).ok);
    assert(f.cmd('stashDeposit', { itemId: it.id }).ok);
    await saveCharacter(f.save); await flushSaves(); const loaded = await loadCharacter(f.save.id);
    assert.equal(loaded!.version, SAVE_VERSION); assert.equal(loaded!.stash.find(i => i?.id === it.id)!.protected, true);
    assert(f.cmd('itemProtect', { itemId: it.id, protected: false }).ok, 'stash items are addressable');
    assert(f.cmd('stashWithdraw', { itemId: it.id }).ok); assert(f.cmd('destroy', { itemId: it.id }).ok);
  } finally { await f.world.shutdown(); }
});

test('set-state retries are idempotent; invalid ownership/booleans fail; malformed saved flags fail safe', async () => {
  const f = await fixture();
  try {
    const it = f.item('normal');
    assert(f.cmd('itemProtect', { itemId: it.id, protected: true }).ok);
    assert(f.cmd('itemProtect', { itemId: it.id, protected: true }).ok); assert.equal(it.protected, true);
    for (const args of [{ itemId: 'someone-elses', protected: false }, { itemId: it.id, protected: 'false' }, { itemId: it.id }]) {
      const before = structuredClone(f.save); assert.equal(f.cmd('itemProtect', args).ok, false); assert.deepEqual(f.save, before);
    }
    const copy = structuredClone(f.save); copy.version = 1;
    (copy.inventory.find(i => i?.id === it.id) as unknown as {protected:unknown}).protected = 'invalid';
    assert.equal(normalizeSave(copy).inventory.find(i => i?.id === it.id)!.protected, true);
    f.save.stash[0] = { ...it }; const before = structuredClone(f.save);
    assert.equal(f.cmd('itemProtect', { itemId: it.id, protected: false }).ok, false); assert.deepEqual(f.save, before);
  } finally { await f.world.shutdown(); }
});
