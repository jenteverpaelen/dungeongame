// Research-only action-boundary probe. No server, saves or live player data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PlayerLink } from '../server/src/contracts';
import type { Player } from '../server/src/sim/types';
import type { ClassId, CharacterSave } from '../shared/src/types';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-objective-credit-'));
process.env.DATA_DIR = path.join(root, 'data');
delete process.env.BACKUP_DIR;
await fs.mkdir(process.env.DATA_DIR);
// Runtime imports must follow isolation, including config's evaluation.
const shared = await import('../server/src/shared');
const { Instance } = await import('../server/src/sim/instance');
const { createMob, DUMMY_DEF } = await import('../server/src/sim/monsters');
const { killMob } = await import('../server/src/sim/kills');
const { spawnLoot, updateLoot } = await import('../server/src/sim/loot');
const { XP_SHARE_RANGE, XP_MULT } = await import('../server/src/config');
const { transferStash } = await import('../shared/src/stash');
type Sim = InstanceType<typeof Instance>;
const cases: object[] = [];
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const instances = new Set<Sim>();

function instance(rift = false, onRiftComplete?: () => void) {
  const original = Math.random;
  try {
    // Only seed the constructor's private loot RNG. Restore before any action.
    Math.random = () => 0.25;
    const inst = new Instance({ zoneId: rift ? 'rift' : 'whispering_glade', key: 'synthetic-credit',
      channel: 1, seed: 73, theme: 'glade', level: 20, difficulty: 0, onRiftComplete });
    instances.add(inst);
    return inst;
  } finally { Math.random = original; }
}

function player(inst: Sim, classId: ClassId, name: string) {
  const save = shared.createCharacter(name, classId, 73);
  save.level = 20; save.lastSeen = 1700000000000;
  let dirty = 0;
  const link: PlayerLink = { save, sessionId: name, derived: shared.computeStats(save),
    send() {}, markDirty() { dirty++; } };
  const id = inst.addPlayer(link);
  const p = inst.playerById(id)!;
  assert.ok(p);
  return { p, link, dirty: () => dirty };
}

function totalXp(save: CharacterSave) {
  let xp = save.xp;
  for (let level = 1; level < save.level; level++) xp += shared.xpToNext(level);
  for (let level = 0; level < save.paragon.level; level++) xp += shared.paragonXpToNext(level);
  return xp + save.paragon.xp;
}

function observed(p: Player) {
  return { kills: p.save.stats.kills, runtimeKills: p.kills, elites: p.save.stats.elites,
    xp: totalXp(p.save), rifts: p.save.stats.rifts, groundEntities: p.loot.size };
}

function killCases(classId: ClassId) {
  const definitions = [
    { name: 'near-witness', distance: 0, credit: true },
    { name: 'boundary-witness', distance: XP_SHARE_RANGE, credit: true },
    { name: 'outside-witness', distance: XP_SHARE_RANGE + 1, credit: false },
    { name: 'outside-killer', distance: XP_SHARE_RANGE + 1, killer: true, credit: true },
    { name: 'dead-near-killer', distance: 0, dead: true, killer: true, credit: false },
    { name: 'dead-far-killer', distance: XP_SHARE_RANGE + 1, dead: true, killer: true, credit: false },
    { name: 'departed-killer', distance: 0, departed: true, killer: true, credit: false },
    { name: 'dummy', distance: 0, dummy: true, killer: true, credit: false },
    { name: 'noReward', distance: 0, noReward: true, credit: true },
    { name: 'elite-loot-control', distance: 0, tier: 1 as const, credit: true },
    { name: 'elite-noReward', distance: 0, tier: 1 as const, noReward: true, credit: true },
  ];
  for (const def of definitions) {
    const inst = instance();
    try {
      const fixture = player(inst, classId, 'CreditProbe');
      const p = fixture.p, x = inst.map.entry.x, y = inst.map.entry.y;
      // Deliberate raw positions: not a movement/collision test.
      p.x = x + def.distance; p.y = y; p.deadMs = def.dead ? 1000 : 0;
      if (def.departed) inst.removePlayer(fixture.link);
      const mob = createMob(inst, def.dummy ? DUMMY_DEF : shared.MONSTERS.bog_slime, 20, x, y, { dummy: def.dummy, tier: def.tier });
      mob.noReward = !!def.noReward;
      const before = observed(p), dirtyBefore = fixture.dirty();
      killMob(inst, mob, def.killer ? p : null, 'physical', '');
      const after = observed(p), dirtyAfter = fixture.dirty();
      assert.equal(after.kills - before.kills, def.credit ? 1 : 0);
      assert.equal(after.runtimeKills - before.runtimeKills, def.credit ? 1 : 0);
      assert.equal(after.xp > before.xp, def.credit);
      assert.equal(dirtyAfter > dirtyBefore, def.credit);
      if (!def.credit || def.noReward) assert.equal(after.groundEntities, 0);
      if (def.tier && def.credit && !def.noReward) assert.ok(after.groundEntities > 0);
      assert.equal(inst.counters.kills, def.dummy ? 0 : 1);
      killMob(inst, mob, def.killer ? p : null, 'physical', '');
      assert.deepEqual(observed(p), after);
      assert.equal(fixture.dirty(), dirtyAfter);
      assert.equal(inst.counters.kills, def.dummy ? 0 : 1);
      cases.push({ kind: 'kill', classId, case: def.name, tier: def.tier ?? 0, distance: def.distance,
        creditedKills: after.kills - before.kills, xp: after.xp - before.xp,
        groundEntities: after.groundEntities, dirtyNotifications: dirtyAfter - dirtyBefore,
        worldDeaths: inst.counters.kills, duplicateUnchanged: true });
    } finally { inst.destroy(); instances.delete(inst); }
  }
}

function ownedItems(save: CharacterSave) {
  return [...save.inventory, ...save.stash, ...Object.values(save.equipment)].filter(item => item !== null && item !== undefined);
}

function pickupCase(classId: ClassId) {
  const inst = instance();
  try {
    const { p } = player(inst, classId, 'PickupProbe');
    const rng = new shared.Rng(101);
    p.save.inventory = Array.from({ length: shared.INVENTORY_SIZE }, () => shared.generateItem(rng, { ilvl: 20, classId, rarity: 'rare' }));
    const originals = new Map(ownedItems(p.save).map(item => [item.id, JSON.stringify(item)]));
    assert.equal(originals.size, ownedItems(p.save).length);
    const item = shared.generateItem(rng, { ilvl: 20, classId, rarity: 'legendary' });
    const itemBefore = JSON.stringify(item);
    const loot = spawnLoot(inst, p, { type: 'item', item }, p.x, p.y, false);
    updateLoot(inst, p, 500); // Arming consumes this update; pickup begins on the next.
    updateLoot(inst, p, 50);
    assert.ok(p.loot.has(loot));
    assert.equal(inst.counters.lootPicked, 0);
    assert.ok(!ownedItems(p.save).some(i => i.id === item.id));
    const deposit = p.save.inventory[0]!;
    assert.equal(transferStash(p.save, deposit.id, true), null);
    assert.equal(inst.counters.lootPicked, 0);
    updateLoot(inst, p, 50);
    assert.ok(!p.loot.has(loot));
    assert.equal(inst.counters.lootPicked, 1);
    assert.equal(p.save.inventory.filter(Boolean).length, shared.INVENTORY_SIZE);
    assert.equal(p.save.stash.filter(Boolean).length, 1);
    const state = JSON.stringify(p.save);
    for (let i = 0; i < 3; i++) updateLoot(inst, p, 50);
    assert.equal(JSON.stringify(p.save), state);
    assert.equal(inst.counters.lootPicked, 1);
    const finalItems = ownedItems(p.save);
    assert.equal(new Set(finalItems.map(i => i.id)).size, originals.size + 1);
    assert.equal(finalItems.length, originals.size + 1);
    for (const [id, body] of originals) assert.equal(JSON.stringify(finalItems.find(i => i.id === id)), body);
    assert.equal(JSON.stringify(finalItems.find(i => i.id === item.id)), itemBefore);
    cases.push({ kind: 'pickup', classId, initialBagSlots: shared.INVENTORY_SIZE,
      fullBagKeepsGroundItem: true, stashDoesNotCountAsPickup: true, acquiredOnce: true,
      preservedOriginalItems: originals.size, finalOwnedItems: finalItems.length, finalGroundEntities: p.loot.size });
  } finally { inst.destroy(); instances.delete(inst); }
}

function riftCase(classId: ClassId) {
  let completions = 0;
  const inst = instance(true, () => completions++);
  try {
    const definitions = [
      { name: 'NearAlive', distance: 0, dead: false, departed: false, kill: 1, rift: 1 },
      { name: 'FarAlive', distance: XP_SHARE_RANGE + 1, dead: false, departed: false, kill: 0, rift: 1 },
      { name: 'NearDead', distance: 0, dead: true, departed: false, kill: 0, rift: 1 },
      { name: 'Departed', distance: 0, dead: false, departed: true, kill: 0, rift: 0 },
    ];
    const members = definitions.map(def => {
      const fixture = player(inst, classId, def.name);
      fixture.p.x = inst.map.entry.x + def.distance;
      fixture.p.y = inst.map.entry.y;
      fixture.p.deadMs = def.dead ? 1000 : 0;
      if (def.departed) inst.removePlayer(fixture.link);
      return { def, fixture, before: observed(fixture.p) };
    });
    const mob = createMob(inst, shared.MONSTERS.gorgemaw, 20, inst.map.entry.x, inst.map.entry.y, { tier: 4 });
    assert.ok(inst.rift);
    inst.rift.phase = 'guardian'; inst.rift.guardian = mob.id;
    killMob(inst, mob, members[0].fixture.p, 'physical', '');
    const after = members.map(({ def, fixture, before }) => {
      const result = observed(fixture.p);
      assert.equal(result.kills - before.kills, def.kill);
      assert.equal(result.xp > before.xp, !!def.kill);
      assert.equal(result.rifts - before.rifts, def.rift);
      assert.equal(result.groundEntities > 0, !!def.rift);
      return { role: def.name, creditedKills: result.kills - before.kills,
        xp: result.xp - before.xp, completions: result.rifts - before.rifts,
        groundEntities: result.groundEntities };
    });
    const checkpoint = members.map(({ fixture }) => ({ state: observed(fixture.p), dirty: fixture.dirty() }));
    killMob(inst, mob, members[0].fixture.p, 'physical', '');
    inst.rift.onKill(mob, members[0].fixture.p);
    assert.deepEqual(members.map(({ fixture }) => ({ state: observed(fixture.p), dirty: fixture.dirty() })), checkpoint);
    assert.equal(completions, 1);
    assert.equal(inst.rift.phase, 'done');
    cases.push({ kind: 'rift', classId, members: after, callbacks: completions, duplicateUnchanged: true });
  } finally { inst.destroy(); instances.delete(inst); }
}

let failure: string | undefined;
try {
  for (const classId of shared.CLASS_IDS) { killCases(classId); pickupCase(classId); riftCase(classId); }
  assert.equal(cases.length, 39);
  assert.deepEqual(await fs.readdir(process.env.DATA_DIR), []);
} catch (error) {
  failure = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  for (const inst of instances) inst.destroy();
  const report = { pass: !failure, node: process.version, root, dataDir: process.env.DATA_DIR,
    scope: 'Synthetic actual-handler eligibility, not combat/pathfinding, persistence, party policy or human play.',
    range: XP_SHARE_RANGE, xpMultiplier: XP_MULT, observationHash: digest(cases), cases, failure };
  const output = path.join(root, 'observations.json');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ pass: report.pass, cases: cases.length, observationHash: report.observationHash, output, failure }, null, 2));
}
