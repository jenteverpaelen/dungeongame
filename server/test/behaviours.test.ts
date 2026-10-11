// Monster behaviour toolkit (F-MON-02): enrage (life threshold or timer) and summon (warning, cap, interruption,
// no-reward minions) run from data on any monster; the Rift Guardian uses the same runners with its old numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS, computeStats, createCharacter, type GameEvent, type MonsterDef, type S2C } from '../src/shared';
import { Instance } from '../src/sim/instance';
import { createMob } from '../src/sim/monsters';
import { BOSS_ADDS, BOSS_ENRAGE, attackCooldownMul } from '../src/sim/behaviours';
import type { PlayerLink } from '../src/contracts';
import type { Mob } from '../src/sim/types';

assert.ok(process.env.DATA_DIR, 'Use an isolated DATA_DIR');

function arena(def: MonsterDef) {
  const save = createCharacter('Toolkit', 'warrior', 5); save.level = 20; save.skills.slots = [null, null, null, null];
  const events: GameEvent[] = [];
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: 'toolkit', markDirty() {}, send(msg: S2C) { if (msg.t === 's') events.push(...(msg.ev ?? [])); } };
  const inst = new Instance({ zoneId: 'ashen_hollow', key: 'toolkit', channel: 1, seed: 11, theme: 'ashen' });
  inst.spawner.tick = () => {}; // only the monsters under test
  inst.addPlayer(link);
  const p = inst.players[0]; p.debugInfiniteHp = true;
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  let x = p.x + 120, y = p.y;
  for (let a = 0; a < 64 && !inst.cw.isFree(x, y, 40); a++) { x = p.x + Math.cos(a) * 120; y = p.y + Math.sin(a) * 120; }
  const m = createMob(inst, def, 20, x, y);
  m.mhp = m.hp = 1e12; // the hero's auto-attacks must not decide the test
  m.state = 'chase'; m.target = p.id;
  const run = (ms: number) => { for (let t = 0; t < ms / 50; t++) inst.tick(); };
  return { inst, p, m, run, events };
}
const withBehaviours = (b: MonsterDef['behaviours']): MonsterDef => ({ ...MONSTERS.bonewalker, id: 'bonewalker', behaviours: b });
const minionsOf = (inst: Instance, m: Mob) => inst.mobs.filter((q) => !q.dead && q.summonedBy === m.id);

test('enrage below a life threshold happens once and speeds up movement and attacks', () => {
  const a = arena(withBehaviours([{ kind: 'enrage', belowPct: 50, speedMul: 1.5, cooldownMul: 0.5 }]));
  try {
    const speed = a.m.speed;
    a.run(500);
    assert.equal(a.m.bh?.enraged, false); assert.equal(attackCooldownMul(a.m), 1);
    a.m.hp = a.m.mhp * 0.4;
    a.run(200);
    assert.equal(a.m.bh?.enraged, true); assert.equal(a.m.speed, speed * 1.5); assert.equal(attackCooldownMul(a.m), 0.5);
    assert.ok(a.events.some((e) => e.e === 'aoe' && e.v === 'nova' && 's' in e && e.s === a.m.id), 'a visible cue at the monster');
    a.run(2000);
    assert.equal(a.m.speed, speed * 1.5, 'never stacks');
    // The next attack after the enrage waits cooldown × 0.5.
    let seen = -1;
    for (let t = 0; t < 200 && seen < 0; t++) { a.inst.tick(); if (a.m.state === 'recover') seen = a.m.atkCdMs; }
    assert.ok(seen > 0 && seen <= a.m.cooldownMs * 0.5 + 1, `cooldown after enrage ${seen} vs ${a.m.cooldownMs}`);
  } finally { a.inst.destroy(); }
});

test('an enrage timer fires after the set time in combat', () => {
  const a = arena(withBehaviours([{ kind: 'enrage', afterMs: 3000, speedMul: 1.2, cooldownMul: 0.8 }]));
  try {
    a.run(2500); assert.equal(a.m.bh?.enraged, false);
    a.run(1000); assert.equal(a.m.bh?.enraged, true);
  } finally { a.inst.destroy(); }
});

test('summon warns at each spot, respects the alive cap, and its minions give no reward', () => {
  const a = arena(withBehaviours([{ kind: 'summon', firstMs: 500, everyMs: 2500, count: 3, maxAlive: 4, telegraphMs: 800, ring: 70 }]));
  try {
    a.run(600);
    const warnings = a.events.filter((e) => e.e === 'tele' && e.v === 'slam');
    assert.ok(warnings.length >= 1 && warnings.length <= 3, `warnings first (${warnings.length})`);
    assert.equal(minionsOf(a.inst, a.m).length, 0, 'nothing appears during the warning');
    a.run(900);
    const first = minionsOf(a.inst, a.m);
    assert.equal(first.length, warnings.length, 'one monster per warned spot');
    assert.ok(first.every((q) => q.noReward && q.target === a.p.id && q.state !== 'idle'), 'no-reward minions fighting the hero');
    for (const q of first) q.mhp = q.hp = 1e12;
    a.run(6000);
    assert.ok(minionsOf(a.inst, a.m).length <= 4, `cap of 4 (${minionsOf(a.inst, a.m).length})`);
    assert.equal(minionsOf(a.inst, a.m).length, 4, 'the cap is reached, never exceeded');
  } finally { a.inst.destroy(); }
});

test('killing the summoner during the warning stops the call', () => {
  const a = arena(withBehaviours([{ kind: 'summon', firstMs: 300, everyMs: 5000, count: 4, maxAlive: 8, telegraphMs: 1000, ring: 70 }]));
  try {
    a.run(400);
    assert.ok(a.events.some((e) => e.e === 'tele' && e.v === 'slam'));
    a.m.dead = true; a.inst.removeEntity(a.m.id);
    a.run(1500);
    assert.equal(a.inst.mobs.filter((q) => !q.dead).length, 0, 'no minions after the summoner died');
  } finally { a.inst.destroy(); }
});

test('the Rift Guardian runs through the same toolkit with its original numbers', () => {
  assert.deepEqual([BOSS_ENRAGE.belowPct, BOSS_ENRAGE.speedMul, BOSS_ENRAGE.cooldownMul, BOSS_ENRAGE.announce], [30, 1.3, 0.8, true]);
  assert.deepEqual([BOSS_ADDS.count, BOSS_ADDS.ring, BOSS_ADDS.telegraphMs, BOSS_ADDS.reward, BOSS_ADDS.firstMs], [6, 70, 0, true, 7000]);
  const a = arena(MONSTERS.vexis);
  try {
    a.m.tier = 4; a.m.boss = { ringMs: 1e9, addsMs: 300, enraged: false, slamCount: 0 };
    a.run(500);
    const adds = minionsOf(a.inst, a.m);
    assert.ok(adds.length > 0 && adds.length <= 6, `guardian adds (${adds.length})`);
    assert.ok(adds.every((q) => !q.noReward), 'guardian adds stay rewarded as before');
    a.m.hp = a.m.mhp * 0.2; const speed = a.m.speed;
    a.run(1500);
    assert.equal(a.m.boss.enraged, true); assert.equal(a.m.speed, speed * 1.3); assert.equal(attackCooldownMul(a.m), 0.8);
  } finally { a.inst.destroy(); }
});
