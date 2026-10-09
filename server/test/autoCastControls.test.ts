import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, setSkillSlot } from '../../shared/src/character';
import { autoCastMode, normalizeAutoCast } from '../../shared/src/autoCast';
import { SKILLS } from '../../shared/src/data/skills';
import { ZONES } from '../../shared/src/data/zones';
import { computeStats } from '../../shared/src/stats';
import { SAVE_VERSION } from '../../shared/src/saveVersion';
import type { PlayerLink } from '../src/contracts';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { runCommand } from '../src/commands';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { playerBrain } from '../src/sim/brain';
import { processInputs } from '../src/sim/players';
import { getBuff } from '../src/sim/effects';
import { ensureDataDir, normalizeSave, saveCharacter, loadCharacter, flushSaves } from '../src/persistence';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
ensureDataDir();
function fixture(skill = 'magic_weapon') {
  const save = createCharacter('AutoCastFixture', SKILLS[skill].classId, 53);
  save.level = 70; save.skills.slots = [skill, null, null, null];
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'autocast', channel: 1, seed: 73, theme: ZONES.whispering_glade.theme });
  for (const mob of inst.mobs) inst.removeMob(mob);
  inst.addPlayer(link); const p = inst.players[0];
  p.debugInfiniteHp = true; p.res = p.mres; p.atkCdMs = 100000;
  inst.addMob(createMob(inst, DUMMY_DEF, 1, p.x + 50, p.y, { dummy: true }));
  const s = { save, changed() {} } as unknown as Session;
  const cmd = (a: Record<string, unknown>) => runCommand(s, {} as World, 'skillAutoCast', a);
  return { save, inst, p, cmd };
}

test('conditions validate exact slot/skill intent, preserve resources, and are idempotent', () => {
  const f = fixture();
  try {
    f.p.readyAt.set('magic_weapon', 3500);
    for (const args of [
      { slot: -1, skill: 'magic_weapon', mode: 'paused' }, { slot: 0.5, skill: 'magic_weapon', mode: 'paused' },
      { slot: 4, skill: 'magic_weapon', mode: 'paused' }, { slot: 1, skill: 'magic_weapon', mode: 'paused' },
      { slot: 0, skill: 'meteor', mode: 'paused' }, { slot: 0, skill: 'magic_weapon', mode: true },
      { slot: 0, skill: 'magic_weapon', mode: 'constructor' }, { slot: 0, skill: 'magic_weapon' },
    ]) { const before = structuredClone(f.save); assert.equal(f.cmd(args).ok, false); assert.deepEqual(f.save, before); }
    const beforeResource = f.p.res;
    assert(f.cmd({ slot: 0, skill: 'magic_weapon', mode: 'paused' }).ok);
    const once = structuredClone(f.save);
    assert(f.cmd({ slot: 0, skill: 'magic_weapon', mode: 'paused' }).ok); assert.deepEqual(f.save, once);
    assert.equal(f.p.res, beforeResource); assert.equal(f.p.readyAt.get('magic_weapon'), 3500);
  } finally { f.inst.destroy(); }
});

test('legacy behavior, malformed values and persistence preserve per-slot restrictions', async () => {
  const f = fixture();
  try {
    assert.equal(autoCastMode(f.save.skills, 0), 'auto');
    assert.deepEqual(normalizeAutoCast(undefined), ['auto','auto','auto','auto']);
    assert.deepEqual(normalizeAutoCast('auto'), ['paused','paused','paused','paused']);
    assert.deepEqual(normalizeAutoCast(['still', 17, null]), ['still','paused','paused','auto']);
    f.save.version = 2;
    f.save.skills.autoCast = ['still', 'paused', 'auto', 'paused'];
    const before = structuredClone(f.save);
    normalizeSave(f.save);
    assert.equal(f.save.version, SAVE_VERSION); assert.deepEqual(f.save.skills.autoCast, before.skills.autoCast);
    assert.deepEqual(f.save.equipment, before.equipment); assert.deepEqual(f.save.inventory, before.inventory);
    await saveCharacter(f.save); await flushSaves();
    assert.deepEqual((await loadCharacter(f.save.id))!.skills.autoCast, before.skills.autoCast);
    assert.equal(setSkillSlot(f.save, 1, 'magic_weapon'), null);
    assert.equal(f.save.skills.slots[1], 'magic_weapon'); assert.equal(autoCastMode(f.save.skills, 1), 'paused');
    assert.equal(autoCastMode(f.save.skills, 0), 'still', 'conditions belong to positions');
  } finally { f.inst.destroy(); }
});

test('paused skills retain their slot and effects, while automatic legacy skills still fire', () => {
  const f = fixture();
  try {
    const res = f.p.res;
    assert(f.cmd({ slot: 0, skill: 'magic_weapon', mode: 'paused' }).ok);
    playerBrain(f.inst, f.p, 50);
    assert(!getBuff(f.p, 'magic_weapon')); assert.equal(f.p.res, res);
    assert.equal(f.save.skills.slots[0], 'magic_weapon');
    assert(f.cmd({ slot: 0, skill: 'magic_weapon', mode: 'auto' }).ok);
    playerBrain(f.inst, f.p, 50); assert(getBuff(f.p, 'magic_weapon'));
    assert(f.p.res < res); const cd = f.p.readyAt.get('magic_weapon');
    assert(f.cmd({ slot: 0, skill: 'magic_weapon', mode: 'paused' }).ok);
    playerBrain(f.inst, f.p, 50); assert(getBuff(f.p, 'magic_weapon')); assert.equal(f.p.readyAt.get('magic_weapon'), cd);
  } finally { f.inst.destroy(); }
});

test('standing-still condition uses authoritative movement and preserves normal cooldown gating', () => {
  const f = fixture();
  try {
    assert(f.cmd({ slot: 0, skill: 'magic_weapon', mode: 'still' }).ok);
    f.p.lastIn = { mx: 1, my: 0 }; processInputs(f.inst, f.p); assert(f.p.moving);
    const res = f.p.res; playerBrain(f.inst, f.p, 50);
    assert(!getBuff(f.p, 'magic_weapon')); assert.equal(f.p.res, res);
    f.p.lastIn = { mx: 0, my: 0 }; processInputs(f.inst, f.p); assert(!f.p.moving);
    f.p.readyAt.set('magic_weapon', 1000); playerBrain(f.inst, f.p, 50); assert(!getBuff(f.p, 'magic_weapon'));
    f.inst.t = 1000; playerBrain(f.inst, f.p, 50); assert(getBuff(f.p, 'magic_weapon'));
  } finally { f.inst.destroy(); }
});

test('moving or pausing ends a channel through its normal recovery without spending another tick', () => {
  const f = fixture('whirlwind');
  try {
    assert(f.cmd({ slot: 0, skill: 'whirlwind', mode: 'still' }).ok);
    playerBrain(f.inst, f.p, 50); assert(f.p.channel);
    const res = f.p.res; f.p.moving = true; playerBrain(f.inst, f.p, 50);
    assert.equal(f.p.channel, null); assert.equal(f.p.res, res); assert.equal(f.p.readyAt.get('whirlwind'), 400);
    f.p.moving = false; playerBrain(f.inst, f.p, 50); assert.equal(f.p.channel, null);
    f.inst.t = 400; playerBrain(f.inst, f.p, 50); assert(f.p.channel);
    assert(f.cmd({ slot: 0, skill: 'whirlwind', mode: 'paused' }).ok);
    playerBrain(f.inst, f.p, 50); assert.equal(f.p.channel, null); assert.equal(f.p.res, res);
    assert.equal(f.p.readyAt.get('whirlwind'), 800);
  } finally { f.inst.destroy(); }
});

test('stationary condition cannot start during dash and does not bypass insufficient resources', () => {
  const f = fixture('whirlwind');
  try {
    f.save.skills.autoCast = ['still','auto','auto','auto'];
    f.p.mv.dashMs = 100; f.p.moving = false; playerBrain(f.inst, f.p, 50); assert.equal(f.p.channel, null);
    f.p.mv.dashMs = 0; f.p.res = 0; playerBrain(f.inst, f.p, 50); assert.equal(f.p.channel, null);
    f.p.res = 25; playerBrain(f.inst, f.p, 50); assert(f.p.channel);
  } finally { f.inst.destroy(); }
});
