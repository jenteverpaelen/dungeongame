// Engine wave 3 primitives (docs/rework/depth/FOUNDATION.md §13): a slow of chosen strength, directional damage
// taken, below-X%-Life and movement-end triggers, the free bar cast, dual dots and grounds that carry a dot, the
// applying-skill filter on applyStatus procs, cheat death re-armed by a cast, no Fury decay, channel-fed stacks with
// movement speed, the generic genPct, and set reduction in the live runtime. Fixture data only; every number is a
// placeholder. Byte-identity of existing behaviour is checked by sim.ts, powerTemplates and the parity rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { MONSTERS } from '../../shared/src/data/monsters';
import { registerGroundDefs } from '../../shared/src/data/grounds';
import { CONTENT_DATA, validateEffects } from '../../shared/src/contentValidation';
import { describeEffect, type PowerEffect } from '../../shared/src/powers';
import { computeStats } from '../../shared/src/stats';
import { combatInteger } from '../../shared/src/combatBounds';
import type { ClassId } from '../../shared/src/types';
import type { PowerSource } from '../../shared/src/powerSources';
import { brainForTest } from './fixtures/wave2';
import { damagePlayer, defenseMult, makeDot, skillGain, strikeMob } from '../src/sim/damage';
import { addOwnedDot, getBuff, mobStatusFlags } from '../src/sim/effects';
import { updateGrounds } from '../src/sim/grounds';
import { Instance } from '../src/sim/instance';
import { createMob, updateMonsters, wakeMob } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { movePct, powerTick, strongestDot } from '../src/sim/powerActions';
import { conditionCount, ownMultiplier } from '../src/sim/powerRuntime';
import { applyStatus } from '../src/sim/status';
import { playerTick, processInputs } from '../src/sim/players';
import type { Mob, Player } from '../src/sim/types';
import type { Session } from '../src/net/session';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

/** A field instance with one level-70 player whose powers are `effects` (an extra source), as in engineWave2.test.ts. */
function world(classId: ClassId, effects: PowerEffect[], o: { slots?: (string | null)[] } = {}) {
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'wave3', channel: 0, seed: 43, theme: 'glade', level: 70, difficulty: 5 });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const save = createCharacter('Wave3', classId, 7); save.level = 70;
  if (o.slots) save.skills.slots = o.slots;
  const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed() {}, rec: { inst } } as unknown as Session;
  let center: { x: number; y: number } | undefined;
  for (let y = 600; y < inst.heightPx - 600 && !center; y += 160) for (let x = 600; x < inst.widthPx - 600; x += 160)
    if ([-350, 0, 350].every((dx) => [-250, 0, 250].every((dy) => inst.cw.isFree(x + dx, y + dy, 24)))) { center = { x, y }; break; }
  assert(center, 'free arena');
  s.entityId = inst.addPlayer(s, center);
  const p = inst.playerById(s.entityId)!;
  p.invulnMs = 0;
  const extra: PowerSource[] = [{ kind: 'passive', id: 'fx_wave3', roll: 1, effects }];
  p.ctx = buildCtx(save, computeStats(save), extra);
  const mob = (dx: number, dy: number, tier: 0 | 1 | 4 = 0) => createMob(inst, MONSTERS.bog_slime, 70, center!.x + dx, center!.y + dy, { tier, dormant: false, difficulty: 5 });
  return { inst, p, save, mob, center };
}
const strike = (skill: string) => ({ skill, coef: 1, el: 'physical' as const, pct: 0 });
const valid = (effects: PowerEffect[]) => { const out: string[] = []; validateEffects(CONTENT_DATA, effects, 'fx_wave3', undefined, (ok, at, msg) => { if (!ok) out.push(at + ': ' + msg); }); return out; };

// ─────────────── slow of chosen strength ───────────────

test('slow: chosen strength, the strongest wins, bosses ignore it, it slows movement only and counts as slowed', () => {
  const { inst, p, mob } = world('warrior', [{ kind: 'conditional', bucket: 'hit', pct: 20, when: { targetState: 'slowed' } }]);
  try {
    const a = mob(320, 0), b = mob(-320, 0), boss = mob(0, 240, 4);
    const slow = (m: Mob, pct: number, ms: number) => applyStatus(inst, p, m, { kind: 'slow', pct, ms, scope: null }, p.x, p.y, 'fx_slow');
    slow(a, 30, 1000);
    assert.equal(a.ps?.slowPct, 30); assert.equal(a.ps?.slowMs, 1000);
    slow(a, 20, 3000); assert.equal(a.ps?.slowPct, 30, 'a weaker slow does not replace a stronger one');
    slow(a, 50, 500); assert.equal(a.ps?.slowPct, 50, 'the strongest slow wins'); assert.equal(a.ps?.slowMs, 500);
    slow(boss, 50, 1000); assert(!boss.ps || boss.ps.slowMs <= 0, 'bosses ignore slows');
    assert.equal(conditionCount(p, { targetState: 'slowed' }, undefined, a), 1, 'a slowed enemy counts as slowed');
    assert.equal(conditionCount(p, { targetState: 'slowed' }, undefined, b), 0);
    assert.equal(a.chillMs ?? 0, 0, 'a slow is not a chill (attack speed untouched)');
    for (const m of [a, b]) wakeMob(inst, m, p); // both chase the player from mirrored spots: only the slow differs
    const ax = a.x, bx = b.x;
    for (let t = 0; t < 400; t += 50) updateMonsters(inst, 50);
    const da = Math.abs(a.x - ax), db = Math.abs(b.x - bx);
    assert(db > 10, `the unslowed enemy walked (${db.toFixed(1)})`);
    assert(Math.abs(da / db - 0.5) < 0.12, `the slowed enemy walked about half as far (${(da / db).toFixed(2)})`);
    for (let t = 0; t < 400; t += 50) updateMonsters(inst, 50);
    assert(a.ps!.slowMs <= 0, 'the slow ran out');
    assert.equal(conditionCount(p, { targetState: 'slowed' }, undefined, a), 0);
  } finally { inst.destroy(); }
  assert.deepEqual(valid([{ kind: 'proc', on: 'hit', applyStatus: { kind: 'slow', pct: 95, ms: 1000 } }]).length > 0, true, 'slow pct is capped at 90');
});

// ─────────────── directional damage taken ───────────────

test('directional damage taken: only attackers in front (or behind) of you, hazards never', () => {
  const { inst, p, mob } = world('warrior', [
    { kind: 'damageTaken', pct: -30, when: { targetInFront: 90 } },
    { kind: 'damageTaken', pct: -10, when: { targetBehind: 45 } },
  ]);
  try {
    p.mv.faceX = 1; p.mv.faceY = 0;
    const front = mob(80, 0), side = mob(0, 80), back = mob(-80, 0);
    const base = defenseMult(p, 70, false), raw = p.mhp * 0.05 / base;
    assert.equal(damagePlayer(inst, p, raw, 'physical', front, 70), combatInteger(raw * (base * 0.7)), 'in front: −30%');
    assert.equal(damagePlayer(inst, p, raw, 'physical', side, 70), combatInteger(raw * (base * 0.7)), '90° to the side: still within the half angle');
    assert.equal(damagePlayer(inst, p, raw, 'physical', back, 70), combatInteger(raw * (base * 0.9)), 'behind: −10% only');
    assert.equal(damagePlayer(inst, p, raw, 'physical', null, 70), combatInteger(raw * base), 'a hazard has no direction');
    p.mv.faceX = -1;
    assert.equal(damagePlayer(inst, p, raw, 'physical', back, 70), combatInteger(raw * (base * 0.7)), 'turning around swaps front and back');
    p.channel = { skill: 'ironplough', graceMs: 600, tickMs: 0, devilMs: 0, spunMs: 0, aim: 0 };
    assert.equal(damagePlayer(inst, p, raw, 'physical', front, 70), combatInteger(raw * (base * 0.7)), 'an aiming channel faces its aim, not the movement facing');
    p.channel = null;
  } finally { inst.destroy(); }
  assert(valid([{ kind: 'damageTaken', pct: -5, when: { targetInFront: 200 } }]).length > 0, 'half angle above 180 rejected');
});

// ─────────────── below-X%-Life trigger and the free bar cast ───────────────

test('lifeBelow: fires once when Life crosses the threshold and casts the longest-cooldown ready Buff skill for free', () => {
  const { inst, p, mob } = world('warrior', [
    { kind: 'proc', on: 'lifeBelow', lifePct: 35, castSkill: { tags: { anyOf: ['buff'] }, pick: 'longestCooldown' } },
    { kind: 'proc', on: 'lifeBelow', lifePct: 35, buff: { id: 'fx_low', ms: 60000 } },
  ], { slots: ['battle_rage', 'muster_standard', 'ground_stomp', null] });
  try {
    const m = mob(80, 0), base = defenseMult(p, 70, false);
    const low = () => { const had = !!getBuff(p, 'fx_low'); p.buffs = p.buffs.filter((b) => b.id !== 'fx_low'); return had; };
    p.hp = p.mhp * 0.5;
    damagePlayer(inst, p, p.mhp * 0.1 / base, 'physical', m, 70);
    assert(!low(), '40% Life: not below 35% yet');
    damagePlayer(inst, p, p.mhp * 0.1 / base, 'physical', m, 70);
    assert(low(), 'crossed below 35%');
    assert((p.readyAt.get('muster_standard') ?? 0) > inst.t, 'Muster Standard (the longest base cooldown among Buff skills) was cast and its cooldown started');
    assert(!p.readyAt.has('ground_stomp'), 'not a Buff skill');
    damagePlayer(inst, p, p.mhp * 0.02 / base, 'physical', m, 70);
    assert(!low(), 'already below: no new crossing');
    p.hp = p.mhp; damagePlayer(inst, p, p.mhp * 0.7 / base, 'physical', m, 70);
    assert(low(), 'healed above and crossed again');
  } finally { inst.destroy(); }
  assert(valid([{ kind: 'proc', on: 'hit', lifePct: 30, resource: 1 }]).length > 0, 'lifePct only on lifeBelow');
  assert(valid([{ kind: 'proc', on: 'lifeBelow', resource: 1 }]).length > 0, 'lifeBelow needs lifePct');
  assert(valid([{ kind: 'proc', on: 'lifeBelow', lifePct: 30, skills: ['cleave'], resource: 1 }]).length > 0, 'lifeBelow has no strike to filter');
  assert.match(describeEffect({ kind: 'proc', on: 'lifeBelow', lifePct: 35, castSkill: { tags: { anyOf: ['buff'] } } }), /35%/);
});

// ─────────────── movement-end trigger ───────────────

test('dashEnd: fires once when the dash ends, at the landing point', () => {
  const { inst, p, mob } = world('warrior', [
    { kind: 'proc', on: 'dashEnd', icdMs: 3000, strike: { id: 'fx_quake', coef: 1, radius: 120, at: 'self' }, applyStatus: { kind: 'stun', ms: 1000, radius: 120, at: 'self' } },
  ]);
  try {
    const far = mob(400, 0), near = mob(-40, 0);
    const hp = far.hp;
    p.inQ.push({ seq: 1, mx: 1, my: 0, dash: true } as never);
    let ticks = 0;
    while (ticks < 20) { processInputs(inst, p); ticks++; if (p.mv.dashMs <= 0) break; p.inQ.push({ seq: ticks + 1, mx: 1, my: 0, dash: false } as never); }
    assert(p.mv.dashMs <= 0 && ticks > 1, 'the dash ran out');
    const landed = Math.hypot(far.x - p.x, far.y - p.y) <= 120 + far.r;
    assert.equal(far.hp < hp, landed, 'the landing strike hit whoever is near the landing point');
    assert.equal(near.stunMs > 0, Math.hypot(near.x - p.x, near.y - p.y) <= 120 + near.r, 'stun around the landing point only');
    const after = far.hp;
    processInputs(inst, p);
    assert.equal(far.hp, after, 'no second trigger while standing');
  } finally { inst.destroy(); }
});

// ─────────────── dual dots, strongest dot, carried-dot grounds ───────────────

test('dual dots: a Bleed that also Burns (fire), the strongest dot, and a ground that carries it on kill', () => {
  const undo = registerGroundDefs([{ id: 'fx_cinder_pool', name: 'Placeholder Pool', radius: 80, durationMs: 2000, tick: { everyMs: 500, status: { kind: 'carriedDot', pct: 50 } } }]);
  const { inst, p, mob } = world('warrior', [
    { kind: 'dot', dot: 'bleed', alsoKind: 'burn', element: 'fire' },
    { kind: 'proc', on: 'kill', when: { any: [{ targetState: 'bleeding' }, { targetState: 'burning' }] }, ground: { def: 'fx_cinder_pool', at: 'target', carryDot: true } },
  ]);
  try {
    const a = mob(60, 0), b = mob(90, 0);
    addOwnedDot(p, a, makeDot(inst, p, strike('rend'), 'bleed', 4000, 500));
    addOwnedDot(p, a, makeDot(inst, p, { ...strike('fx_weak'), coef: 0.1 }, 'poison', 4000, 500));
    const d = a.dots.find((x) => x.kind === 'bleed')!;
    assert.equal(d.also, 'burn'); assert.equal(d.el, 'fire', 'the Bleed deals fire damage');
    assert.equal(conditionCount(p, { targetState: 'burning' }, undefined, a), 1, 'counts as burning');
    assert.equal(conditionCount(p, { targetState: 'bleeding' }, undefined, a), 1, 'and still as bleeding');
    assert.notEqual(mobStatusFlags(a) & mobStatusFlags({ ...a, dots: [{ ...d, kind: 'burn', also: undefined }] } as Mob), 0, 'clients see the burn flag');
    assert.equal(strongestDot(p, a)?.kind, 'bleed', 'the strongest dot is the Rend bleed (highest damage per second)');
    a.hp = 1; strikeMob(inst, p, a, strike('cleave'));
    assert(a.dead, 'killed');
    const pool = inst.grounds.find((g) => g.fx?.def.id === 'fx_cinder_pool');
    assert(pool?.fx?.dot && pool.fx.dot.kind === 'bleed', 'the pool carries the bleed');
    for (let t = 0; t < 600; t += 50) { inst.t += 50; updateGrounds(inst, 50); }
    const got = b.dots.find((x) => x.owner === p.id && x.kind === 'bleed');
    assert(got, 'an enemy standing in the pool caught the dot');
    assert.equal(got.perTick, d.perTick * 0.5, 'at 50% strength');
  } finally { inst.destroy(); undo(); }
  assert(valid([{ kind: 'proc', on: 'hit', applyStatus: { kind: 'carriedDot', pct: 50 } }]).length > 0, 'carriedDot only in grounds');
  assert(valid([{ kind: 'dot', dot: 'bleed', alsoKind: 'bleed' }]).length > 0, 'alsoKind must differ');
});

// ─────────────── applyStatus procs filtered by the applying skill ───────────────

test('applyStatus procs: filtered by the skill that applied the status', () => {
  const { inst, p, mob } = world('warrior', [{ kind: 'proc', on: 'applyStatus', status: ['stun'], skills: ['ground_stomp'], resource: 5 }]);
  try {
    const m = mob(60, 0); p.res = 0;
    applyStatus(inst, p, m, { kind: 'stun', ms: 500, scope: null }, p.x, p.y, 'cleave');
    assert.equal(p.res, 0, 'stun from another skill');
    m.stunMs = 0;
    applyStatus(inst, p, m, { kind: 'stun', ms: 500, scope: null }, p.x, p.y, 'ground_stomp');
    assert.equal(p.res, 5, 'stun from Ground Stomp');
    assert.equal(p.acting, undefined, 'the applying skill is restored afterwards');
  } finally { inst.destroy(); }
  assert.equal(valid([{ kind: 'proc', on: 'applyStatus', skills: ['ground_stomp'], resource: 1 }]).length, 0, 'now a valid filter');
});

// ─────────────── cheat death once per cast ───────────────

test('cheat death re-armed by a cast: once per Muster Standard, 1 Life and invulnerability', () => {
  const { inst, p, mob } = world('warrior', [
    { kind: 'cheatDeath', lifePct: 0, cooldownMs: Infinity, invulnMs: 2000, rearmOnCast: ['ground_stomp'] },
  ], { slots: ['ground_stomp', null, null, null] });
  try {
    const m = mob(60, 0), kill = () => damagePlayer(inst, p, p.mhp * 10, 'physical', m, 70);
    p.hp = 10; kill();
    assert.equal(p.deadMs, 0); assert.equal(p.hp, 1, '1 Life'); assert.equal(p.invulnMs, 2000);
    p.invulnMs = 0; inst.t += 600000; kill();
    assert(p.deadMs > 0, 'never again without the cast, however long you wait');
    p.deadMs = 0; p.hp = p.mhp; p.readyAt.delete('ground_stomp');
    assert.equal(brainForTest(inst, p)(0, 'ground_stomp'), null, 'cast Ground Stomp');
    p.invulnMs = 0; kill();
    assert.equal(p.deadMs, 0, 're-armed by the cast'); assert.equal(p.hp, 1);
  } finally { inst.destroy(); }
  assert.match(describeEffect({ kind: 'cheatDeath', lifePct: 0, cooldownMs: Infinity, invulnMs: 2000, rearmOnCast: ['muster_standard'] }), /1 Life/);
});

// ─────────────── no Fury decay, genPct ───────────────

test('rule noDecay: Fury stays out of combat; vars.genPct scales generated resource', () => {
  const plain = world('warrior', []), held = world('warrior', [{ kind: 'rule', rule: { id: 'noDecay' } }, { kind: 'skillMods', tags: { anyOf: ['primary'] }, mods: { vars: { genPct: -15 } } }]);
  try {
    for (const w of [plain, held]) { w.p.res = 50; w.p.sinceHitMs = 1e6; for (let i = 0; i < 40; i++) playerTick(w.inst, w.p, 50); }
    assert(plain.p.res < 50, 'Fury decays out of combat');
    assert.equal(held.p.res, 50, 'noDecay: it does not');
    plain.p.res = 0; held.p.res = 0;
    skillGain(plain.p, plain.p.ctx.modsOf('cleave'), 10); skillGain(held.p, held.p.ctx.modsOf('cleave'), 10);
    assert.equal(plain.p.res, 10, 'no genPct: exactly the amount');
    assert.equal(held.p.res, 8.5, 'genPct −15 on Primary skills');
    held.p.res = 0; skillGain(held.p, held.p.ctx.modsOf('rend'), 10);
    assert.equal(held.p.res, 10, 'not a Primary skill');
  } finally { plain.inst.destroy(); held.inst.destroy(); }
});

// ─────────────── channel-fed stacks with movement speed ───────────────

test('channel stacking: stacks each second of channelling with damage and movement speed, kept 1 s after the channel', () => {
  const { inst, p } = world('warrior', [{ kind: 'stacking', buff: 'fx_top', source: 'channel', per: 1000, max: 5, decayMs: 1000, stackDmg: 4, stackMoveSpeed: 3 }]);
  try {
    const ms0 = movePct(p);
    p.channel = { skill: 'whirlwind' } as Player['channel'];
    for (let i = 0; i < 20 * 3; i++) powerTick(inst, p, 50);
    assert.equal(getBuff(p, 'fx_top')?.st, 3, '3 s of channelling: 3 stacks');
    for (let i = 0; i < 20 * 4; i++) powerTick(inst, p, 50);
    assert.equal(getBuff(p, 'fx_top')?.st, 5, 'capped at 5');
    p.channel = null;
    assert.equal(p.live.mv, 15, '5 stacks × 3% movement speed');
    assert.equal(movePct(p), ms0 + 15, 'movement speed (MeState.ms, client prediction) includes it');
    assert.equal(ownMultiplier(p, 'cleave') >= 1, true);
    for (let i = 0; i < 10; i++) { inst.t += 50; powerTick(inst, p, 50); playerTick(inst, p, 50); }
    assert(getBuff(p, 'fx_top'), 'kept for a while after the channel');
    for (let i = 0; i < 14; i++) { inst.t += 50; powerTick(inst, p, 50); playerTick(inst, p, 50); }
    assert(!getBuff(p, 'fx_top'), 'gone 1 s after the channel');
    assert.equal(movePct(p), ms0, 'and the movement speed with it');
  } finally { inst.destroy(); }
  assert(valid([{ kind: 'stacking', buff: 'fx_x', source: 'channel', per: 1000, max: 5, decayMs: 1000, skills: ['whirlwind'] }]).length > 0, 'channel stacking takes no skill filter');
});

// ─────────────── set reduction in the live runtime ───────────────

test('setReduce in the runtime: 5 pieces + Journeyman\'s Ring give the 6-piece power, without the ring they do not', () => {
  const save = createCharacter('Sets', 'mage', 3); save.level = 70;
  const ctx = (sets: Record<string, number>, powers: Record<string, number>) => {
    const d = computeStats(save); d.sets = sets; d.powers = powers;
    return buildCtx(save, d);
  };
  const p = { ctx: ctx({ fallen_star: 6 }, {}) } as Player;
  const six = ownMultiplier(p, 'meteor');
  p.ctx = ctx({ fallen_star: 5 }, {}); const five = ownMultiplier(p, 'meteor');
  p.ctx = ctx({ fallen_star: 5 }, { journeymans_ring: 1 }); const ring = ownMultiplier(p, 'meteor');
  assert(six > five, 'the 6-piece power multiplies Meteor');
  assert.equal(ring, six, '5 + ring = 6 pieces');
});
