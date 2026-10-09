import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { ZONES } from '../../shared/src/data/zones';
import { T_FLOOR, T_WALL } from '../../shared/src/mapgen';
import { TARGET_PRIORITIES, normalizeTargetPriority, type TargetPriority } from '../../shared/src/targetPriority';
import type { ClassId } from '../../shared/src/types';
import type { EliteTier } from '../../shared/src/items';
import type { PlayerLink } from '../src/contracts';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { runCommand } from '../src/commands';
import { ensureDataDir, normalizeSave, saveCharacter, loadCharacter, flushSaves } from '../src/persistence';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { pickTarget, playerBrain } from '../src/sim/brain';
import { spawnSummon, updateSummons } from '../src/sim/summons';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
ensureDataDir();

function fixture(classId: ClassId = 'mage') {
  const save = createCharacter('TargetFixture', classId, 84);
  save.level = 70; save.skills.slots = [null, null, null, null];
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'target-priority', channel: 1, seed: 84, theme: ZONES.whispering_glade.theme });
  for (const m of [...inst.mobs]) inst.removeMob(m);
  inst.map.tiles.fill(T_FLOOR); // Controlled line-of-sight fixture, not an authored-map claim.
  inst.addPlayer(link); const p = inst.players[0];
  p.x = 1024; p.y = 1024; p.debugInfiniteHp = true;
  const mob = (dx: number, dy = 0, tier: EliteTier = 0, radius = 22) =>
    createMob(inst, { ...DUMMY_DEF, radius }, 1, p.x + dx, p.y + dy, { dummy: true, tier });
  const choose = (mode?: TargetPriority, range = 500, los = false) => pickTarget(inst, p.x, p.y, range, los, mode);
  const refreshes: boolean[] = [];
  const session = { save, changed(refresh: boolean) { refreshes.push(refresh); } } as unknown as Session;
  const cmd = (mode: unknown) => runCommand(session, {} as World, 'targetPriority', { mode });
  return { save, inst, p, mob, choose, cmd, refreshes };
}

test('default retains nearby elite bias and nearest can explicitly opt out', () => {
  const f = fixture();
  try {
    const near = f.mob(100), elite = f.mob(120, 0, 1);
    assert.equal(f.choose(), elite); assert.equal(f.choose('default'), elite);
    assert.equal(f.choose('nearest'), near);
    elite.x = f.p.x + 132; f.inst.mobHash.update(elite);
    assert.equal(f.choose(), near, 'outside nearest + 30 window');
    assert.equal(f.choose('elites'), elite, 'explicit preference can pick a farther legal elite');
    near.x = f.p.x + 322; elite.x = f.p.x + 382;
    f.inst.mobHash.update(near); f.inst.mobHash.update(elite);
    assert.equal(f.choose(), elite, 'relative 1.2 window remains inclusive');
  } finally { f.inst.destroy(); }
});

test('elites first includes champion, rare, boss and goblin but not ordinary pack minions', () => {
  const f = fixture();
  try {
    const ordinary = f.mob(80), minion = f.mob(100, 0, 3);
    for (const tier of [1, 2, 4, 5] as const) {
      const elite = f.mob(220, 0, tier);
      assert.equal(f.choose('elites'), elite);
      f.inst.removeMob(elite);
    }
    assert.equal(f.choose('elites'), ordinary);
    ordinary.dead = true;
    assert.equal(f.choose('elites'), minion);
    minion.dead = true;
    assert.equal(f.choose('elites'), null);
  } finally { f.inst.destroy(); }
});

test('lowest life compares remaining fraction, with body-distance ties', () => {
  const f = fixture();
  try {
    const near = f.mob(100), far = f.mob(220, 0, 2);
    near.mhp = 100; near.hp = 20; far.mhp = 1000; far.hp = 100;
    assert.equal(f.choose('lowestLife'), far, '10% takes priority over smaller absolute 20 HP');
    far.hp = 200;
    assert.equal(f.choose('lowestLife'), near);
    const large = f.mob(125, 0, 0, 60); large.mhp = 100; large.hp = 20;
    assert.equal(f.choose('lowestLife'), large, '65-unit body distance beats 78');
    assert.equal(f.choose('nearest'), large);
  } finally { f.inst.destroy(); }
});

test('all modes retain body-inclusive range, dead filtering and caller line-of-sight rules', () => {
  const f = fixture();
  try {
    const visible = f.mob(-300), blocked = f.mob(200, 0, 4);
    blocked.hp = 1;
    f.inst.map.tiles[16 * f.inst.map.w + 18] = T_WALL;
    const out = f.mob(501 + 22, 0, 2); out.hp = 0.01;
    for (const mode of TARGET_PRIORITIES) assert.equal(f.choose(mode, 500, true), visible, mode);
    assert.equal(f.choose('elites', 500, false), blocked, 'unchanged caller can opt out of LOS');
    blocked.dead = true; visible.dead = true;
    for (const mode of TARGET_PRIORITIES) assert.equal(f.choose(mode, 500, false), null);
    out.x = f.p.x + 500 + out.r; f.inst.mobHash.update(out);
    for (const mode of TARGET_PRIORITIES) assert.equal(f.choose(mode, 500, false), out, 'body touching range is eligible');
  } finally { f.inst.destroy(); }
});

test('actual primary casts follow the saved choice without bypassing attack cooldown', () => {
  const f = fixture();
  try {
    const near = f.mob(-100), elite = f.mob(250, 0, 2);
    assert(f.cmd('elites').ok); playerBrain(f.inst, f.p, 50);
    const cast = f.inst.events.map(r => r.ev).find(e => e.e === 'cast');
    assert(cast?.e === 'cast'); assert.equal(cast.tx, elite.x);
    f.inst.events.length = 0; assert(f.cmd('nearest').ok);
    playerBrain(f.inst, f.p, 50); assert.equal(f.inst.events.filter(r => r.ev.e === 'cast').length, 0);
    f.p.atkCdMs = 0; playerBrain(f.inst, f.p, 50);
    const next = f.inst.events.map(r => r.ev).find(e => e.e === 'cast');
    assert(next?.e === 'cast'); assert.equal(next.tx, near.x);
  } finally { f.inst.destroy(); }
});

test('Sentry and Hydra use owner preference for each fresh shot', () => {
  for (const type of ['sentry', 'hydra'] as const) {
    const f = fixture(type === 'sentry' ? 'ranger' : 'mage');
    try {
      const near = f.mob(-100), elite = f.mob(250, 0, 2);
      const summon = spawnSummon(f.inst, f.p, type, type, f.p.x, f.p.y, 10000);
      assert(f.cmd('elites').ok); summon.fireMs = 0; updateSummons(f.inst, 50);
      assert.equal(f.inst.projs.at(-1)!.homing, elite.id);
      assert(f.cmd('nearest').ok); summon.fireMs = 0; updateSummons(f.inst, 50);
      assert.equal(f.inst.projs.at(-1)!.homing, near.id);
    } finally { f.inst.destroy(); }
  }
});

test('Companion keeps its held target and applies a new preference on reacquisition', () => {
  const f = fixture('ranger');
  try {
    const near = f.mob(-100), elite = f.mob(250, 0, 2);
    const companion = spawnSummon(f.inst, f.p, 'wolf', 'companion', f.p.x, f.p.y, Infinity);
    assert(f.cmd('nearest').ok); updateSummons(f.inst, 50); assert.equal(companion.targetId, near.id);
    assert(f.cmd('elites').ok); updateSummons(f.inst, 50); assert.equal(companion.targetId, near.id);
    near.dead = true; updateSummons(f.inst, 50); assert.equal(companion.targetId, elite.id);
  } finally { f.inst.destroy(); }
});

test('strict commands, defaults and save/reload preserve preferences without refreshing combat or consuming items', async () => {
  const f = fixture();
  try {
    f.p.res = 17; f.p.atkCdMs = 765; f.p.readyAt.set('meteor', 9876);
    f.save.skills.autoCast = ['still', 'paused', 'auto', 'paused'];
    const before = structuredClone(f.save);
    for (const mode of [undefined, null, true, 1, ['elites'], {}, 'constructor', 'ELITES']) {
      assert.equal(f.cmd(mode).ok, false); assert.deepEqual(f.save, before);
      assert.equal(normalizeTargetPriority(mode), 'default');
    }
    assert.equal(f.refreshes.length, 0);
    for (const mode of TARGET_PRIORITIES) {
      assert(f.cmd(mode).ok); const once = structuredClone(f.save);
      assert(f.cmd(mode).ok); assert.deepEqual(f.save, once);
      normalizeSave(f.save); await saveCharacter(f.save); await flushSaves();
      const loaded = (await loadCharacter(f.save.id))!;
      assert.equal(loaded.skills.targetPriority, mode);
      assert.deepEqual(loaded.skills.autoCast, before.skills.autoCast);
      assert.deepEqual(loaded.equipment, before.equipment); assert.deepEqual(loaded.inventory, before.inventory);
    }
    assert(f.refreshes.every(refresh => refresh === false));
    assert.equal(f.p.res, 17); assert.equal(f.p.atkCdMs, 765); assert.equal(f.p.readyAt.get('meteor'), 9876);
    assert.equal(f.save.gold, before.gold); assert.deepEqual(f.save.materials, before.materials);
  } finally { f.inst.destroy(); }
});
