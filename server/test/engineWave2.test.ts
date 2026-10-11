// Engine wave 2 primitives (docs/rework/depth/FOUNDATION.md §11): procs, defensive templates, conditions, sub-strike
// tags, the data-driven ground framework, projectile rules, monster statuses, rule changes / tag grants, Inscriptions
// and the parity-harness variants. Fixture data only (shared/test/fixtures/depthContent.ts); every number is a
// placeholder. Byte-identity of existing behaviour is checked elsewhere (sim.ts, powerTemplates, parity).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { MONSTERS } from '../../shared/src/data/monsters';
import { ITEM_COUNT_CAP, ITEM_COUNT_CAP_BIBLE, USE_BIBLE_COUNT_CAP, type PowerEffect } from '../../shared/src/powers';
import { allPowerSources, type PowerSource } from '../../shared/src/powerSources';
import { computeStats } from '../../shared/src/stats';
import { validateContent, CONTENT_DATA } from '../../shared/src/contentValidation';
import { combatInteger } from '../../shared/src/combatBounds';
import type { ClassId, Item } from '../../shared/src/types';
import { installFixtureGrounds, installFixtureInscriptions } from '../../shared/test/fixtures/depthContent';
import { registerGroundDefs } from '../../shared/src/data/grounds';
import { brainForTest } from './fixtures/wave2';
import { damagePlayer, defenseMult, strikeMob, vulnerability } from '../src/sim/damage';
import { addBuff, addDot, addOwnedDot, freezeMob, getBuff, shotBlockedAt, stunMob, stunPlayer, tickBuffs } from '../src/sim/effects';
import { placeGround } from '../src/sim/groundFx';
import { updateGrounds } from '../src/sim/grounds';
import { Instance } from '../src/sim/instance';
import { createMob, updateMonsters } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { channelMoveFactor, debtFloor, debtRegenFactor, onKillStacking, powerTick } from '../src/sim/powerActions';
import { baseTagIndex, buildPowerRuntime, firePowerProcs, ownMultiplier, resolveStatus, tagIndexFor, updateOwnGround, vulnTermsFactor } from '../src/sim/powerRuntime';
import { clearHostileProjectiles, flownStrike, spawnProj, updateProjectiles } from '../src/sim/projectiles';
import { applyStatus } from '../src/sim/status';
import { playerTick } from '../src/sim/players';
import type { Mob, Player } from '../src/sim/types';
import type { Session } from '../src/net/session';
import { classCoverage, kitLegal, kitSave, planKit, profileOf, runEncounter, searchKit, slotCandidates } from './parity/harness';
import { SETS } from '../../shared/src/data/items';
import { specPointsForLevel } from '../../shared/src/specialization';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

/** A field instance with one level-70 player whose powers are `effects` (as an extra source) and helpers. */
function world(classId: ClassId, effects: PowerEffect[], o: { slots?: (string | null)[] } = {}) {
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'wave2', channel: 0, seed: 41, theme: 'glade', level: 70, difficulty: 5 });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const save = createCharacter('Wave2', classId, 7); save.level = 70;
  if (o.slots) save.skills.slots = o.slots;
  const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed() {}, rec: { inst } } as unknown as Session;
  let center: { x: number; y: number } | undefined;
  for (let y = 600; y < inst.heightPx - 600 && !center; y += 160) for (let x = 600; x < inst.widthPx - 600; x += 160)
    if ([-250, 0, 250].every((dx) => [-250, 0, 250].every((dy) => inst.cw.isFree(x + dx, y + dy, 24)))) { center = { x, y }; break; }
  assert(center, 'free arena');
  s.entityId = inst.addPlayer(s, center);
  const p = inst.playerById(s.entityId)!;
  p.invulnMs = 0;
  const extra: PowerSource[] = [{ kind: 'passive', id: 'fx_wave2', roll: 1, effects }];
  p.ctx = buildCtx(save, computeStats(save), extra);
  const mob = (dx: number, dy: number, tier: 0 | 1 | 4 = 0) => createMob(inst, MONSTERS.bog_slime, 70, center!.x + dx, center!.y + dy, { tier, dormant: false, difficulty: 5 });
  const move = (m: Mob, dx: number, dy: number) => { m.x = center!.x + dx; m.y = center!.y + dy; inst.mobHash.update(m); };
  const advance = (ms: number) => { for (let t = 0; t < ms; t += 50) { inst.t += 50; updateGrounds(inst, 50); } };
  return { inst, p, save, s, mob, move, advance, center };
}
const strike = (skill: string) => ({ skill, coef: 1, el: 'physical' as const, pct: 0 });

// ─────────────── 1. Procs ───────────────

test('procs: strike action hits an area, filters by tag and skill, internal cooldown, proc hits do not chain', () => {
  const { inst, p, mob } = world('warrior', [
    { kind: 'proc', on: 'hit', tags: { anyOf: ['area'] }, icdMs: 1000, resource: 1, strike: { id: 'fx_burst', coef: 1, radius: 150, tags: ['area'] } },
    { kind: 'proc', on: 'hit', skills: ['rend'], resource: 50 },
  ]);
  try {
    const a = mob(60, 0), b = mob(130, 0);
    p.res = 0;
    const bHp = b.hp;
    strikeMob(inst, p, a, strike('cleave'));
    assert.equal(p.res, 1, 'one proc: the proc strike\'s own hits trigger no hit procs');
    assert(b.hp < bHp, 'the proc strike hit the second enemy');
    strikeMob(inst, p, a, strike('cleave'));
    assert.equal(p.res, 1, 'internal cooldown');
    inst.t += 1000;
    strikeMob(inst, p, a, strike('cleave'));
    assert.equal(p.res, 2, 'ready again');
    strikeMob(inst, p, a, strike('rend'));
    assert.equal(p.res, 52, 'skill filter: rend only (area proc still on cooldown)');
    strikeMob(inst, p, a, strike('battle_rage'));
    assert.equal(p.res, 52, 'not an area skill, not rend');
  } finally { inst.destroy(); }
});

test('procs: summon, ground and status actions; kill / elite kill / cast / applyStatus triggers', () => {
  const undo = installFixtureGrounds();
  const { inst, p, mob } = world('warrior', [
    { kind: 'proc', on: 'cast', skills: ['whirlwind'], summon: { type: 'dust_devil', skill: 'whirlwind', lifeMs: 3000, at: 'self', max: 2 } },
    { kind: 'proc', on: 'kill', ground: { def: 'fx_tremor' } },
    { kind: 'proc', on: 'eliteKill', applyStatus: { kind: 'weaken', pct: 30, ms: 4000, radius: 400 } },
    { kind: 'proc', on: 'applyStatus', status: ['stun'], icdMs: 200, resource: 2 },
    { kind: 'proc', on: 'dash', clearProjectiles: { range: 200, halfAngleDeg: 60 } },
  ]);
  try {
    for (let i = 0; i < 3; i++) firePowerProcs(inst, p, 'cast', { skill: 'whirlwind' });
    firePowerProcs(inst, p, 'cast', { skill: 'rend' });
    assert.equal(p.summons.filter((s) => s.type === 'dust_devil' && !s.dead).length, 2, 'max 2: the oldest retires');
    const a = mob(60, 0), b = mob(200, 0), c = mob(-60, 0, 1);
    a.hp = 1;
    strikeMob(inst, p, a, strike('cleave'));
    assert(a.dead && inst.grounds.some((g) => g.fx?.def.id === 'fx_tremor' && Math.abs(g.x - a.x) < 1), 'kill placed the ground at the enemy');
    c.hp = 1;
    strikeMob(inst, p, c, strike('cleave'));
    assert(b.ps && b.ps.weakenMs === 4000 && b.ps.weakenPct === 30, 'elite kill weakened enemies around it');
    p.res = 0;
    stunMob(b, 1000, inst, p); stunMob(b, 1000, inst, p);
    assert.equal(p.res, 2, 'applyStatus proc with a 200 ms internal cooldown');
    inst.t += 200; stunMob(b, 1000, inst, p);
    assert.equal(p.res, 4);
    stunMob(b, 1000); assert.equal(p.res, 4, 'statuses from unknown sources do not report');
    p.mv.faceX = 1; p.mv.faceY = 0;
    const front = spawnProj(inst, { kind: 'mob', v: 'seed', mob: b, src: b.id, x: p.x + 100, y: p.y, angle: Math.PI, speed: 100, lifeMs: 2000, r: 8, el: 'physical', dmg: 1 });
    const back = spawnProj(inst, { kind: 'mob', v: 'seed', mob: b, src: b.id, x: p.x - 100, y: p.y, angle: 0, speed: 100, lifeMs: 2000, r: 8, el: 'physical', dmg: 1 });
    firePowerProcs(inst, p, 'dash');
    assert(front.dead && !back.dead, 'dash proc cleared the hostile projectile in front only');
  } finally { inst.destroy(); undo(); }
});

test('procs: a big hit (minHitPct) grants damage reduction once per internal cooldown', () => {
  const { inst, p } = world('warrior', [{ kind: 'proc', on: 'takeDamage', minHitPct: 25, icdMs: 20000, buff: { id: 'fx_second_skin', ms: 2000, dr: 50 } }]);
  try {
    const base = defenseMult(p, 70, false), raw = (pct: number) => p.mhp * pct / 100 / base;
    damagePlayer(inst, p, raw(10), 'physical', null, 70);
    assert(!getBuff(p, 'fx_second_skin'), 'a small hit does not trigger');
    p.hp = p.mhp;
    damagePlayer(inst, p, raw(30), 'physical', null, 70);
    assert(getBuff(p, 'fx_second_skin') && p.live.dr === 0.5, 'big hit: 50% damage reduction buff');
    p.hp = p.mhp;
    const halved = damagePlayer(inst, p, raw(20), 'physical', null, 70);
    assert.equal(halved, combatInteger(raw(20) * base * 0.5));
  } finally { inst.destroy(); }
});

// ─────────────── 2. Defensive templates ───────────────

test('defensive templates: damage taken (static, vs elites), first-hit window reset by freezing, cheat death, control immunity', () => {
  const { inst, p, mob } = world('warrior', [
    { kind: 'damageTaken', pct: -20 },
    { kind: 'damageTaken', pct: -50, when: { targetElite: true } },
    { kind: 'firstHit', pct: -60, windowMs: 8000, resetOnStatus: ['freeze'] },
    { kind: 'cheatDeath', lifePct: 40, cooldownMs: 90000, resetCooldowns: ['ground_stomp'] },
    { kind: 'controlImmunity', when: { buff: 'fx_root' } },
  ]);
  try {
    const base = defenseMult(p, 70, false), raw = p.mhp * 0.1 / base, m = mob(80, 0), e = mob(-80, 0, 1);
    const exp = (dm: number, f: number) => combatInteger(raw * (dm * f));
    assert.equal(damagePlayer(inst, p, raw, 'physical', null, 70), exp(base, 0.8 * 0.4), 'first hit −60%');
    assert.equal(damagePlayer(inst, p, raw, 'physical', null, 70), exp(base, 0.8), 'window spent');
    freezeMob(m, 1000, 0, 0, inst, p);
    assert.equal(damagePlayer(inst, p, raw, 'physical', null, 70), exp(base, 0.8 * 0.4), 'freezing reopened the window');
    p.hp = p.mhp;
    assert.equal(damagePlayer(inst, p, raw, 'physical', e, 70), exp(defenseMult(p, e.level, true), 0.8 * 0.5), 'elite attacker: −50% more');
    p.readyAt.set('ground_stomp', 1e9); p.hp = 5;
    damagePlayer(inst, p, raw, 'physical', null, 70);
    assert.equal(p.deadMs, 0); assert.equal(p.hp, p.mhp * 40 / 100); assert(!p.readyAt.has('ground_stomp'), 'cheat death reset Ground Stomp');
    p.hp = 5; damagePlayer(inst, p, raw, 'physical', null, 70);
    assert(p.deadMs > 0, 'cheat death is on cooldown');
  } finally { inst.destroy(); }
  const w = world('warrior', [{ kind: 'controlImmunity', when: { buff: 'fx_root' } }]);
  try {
    stunPlayer(w.p, 500); assert(w.p.stunMs > 0); w.p.stunMs = 0;
    addBuff(w.p, { id: 'fx_root', ms: 3000 }); powerTick(w.inst, w.p, 50);
    stunPlayer(w.p, 500); assert.equal(w.p.stunMs, 0, 'immune while the condition holds');
    w.p.buffs.length = 0; powerTick(w.inst, w.p, 50);
    addBuff(w.p, { id: 'fx_iron', ms: 3000, cci: true });
    stunPlayer(w.p, 500); assert.equal(w.p.stunMs, 0, 'a ccImmune buff alone also protects');
  } finally { w.inst.destroy(); }
});

test('defensive templates: per-legendary damage taken (Patchwork style) honours noSetBonus', () => {
  const effects: PowerEffect[] = [{ kind: 'damageTaken', pct: -3, perLegendary: { max: 10 }, noSetBonus: true }];
  const src: PowerSource[] = [{ kind: 'legendary', id: 'fx_patch', roll: 1, effects }];
  assert(Math.abs(buildPowerRuntime(src, baseTagIndex(), { legendaries: 4, setBonus: false }).defense!.takenStatic - 0.88) < 1e-12);
  assert(Math.abs(buildPowerRuntime(src, baseTagIndex(), { legendaries: 14, setBonus: false }).defense!.takenStatic - 0.7) < 1e-12, 'capped at 10');
  assert.equal(buildPowerRuntime(src, baseTagIndex(), { legendaries: 4, setBonus: true }).defense, null, 'a set bonus switches it off');
});

// ─────────────── 3. Conditions ───────────────

test('conditions: all / any, elite, controlled within N ms, standing still N ms, debt', () => {
  const { inst, p, mob } = world('mage', [
    { kind: 'conditional', bucket: 'own', pct: 10, skills: ['hydra'], when: { all: [{ perSummon: 'hydra', max: 3 }, { standingStill: true }] } },
    { kind: 'conditional', bucket: 'own', pct: 50, skills: ['meteor'], when: { any: [{ inDebt: true }, { standingStillMs: 1000 }] } },
    { kind: 'skillMore', tags: { anyOf: ['area'] }, pct: 40, when: { targetControlledWithinMs: 1500 } },
    { kind: 'conditional', bucket: 'hit', pct: 25, when: { targetElite: true } },
  ]);
  try {
    p.summons = [{ type: 'hydra', dead: false }, { type: 'hydra', dead: false }] as Player['summons'];
    p.moving = false;
    assert.equal(ownMultiplier(p, 'hydra'), 1 + 0.1 * 2, 'all: scaling child × holding child');
    p.moving = true; assert.equal(ownMultiplier(p, 'hydra'), 1);
    assert.equal(ownMultiplier(p, 'meteor'), 1);
    p.res = -1; assert.equal(ownMultiplier(p, 'meteor'), 1.5, 'any: in debt'); p.res = 10;
    p.moving = false; for (let i = 0; i < 20; i++) powerTick(inst, p, 50);
    assert.equal(ownMultiplier(p, 'meteor'), 1.5, 'any: standing still for 1 s');
    const m = mob(100, 0), e = mob(-100, 0, 1);
    assert.equal(vulnTermsFactor(p, m, 'meteor'), 1);
    assert.equal(vulnTermsFactor(p, e, 'meteor'), 1.25, 'elite');
    stunMob(m, 500);
    assert.equal(vulnTermsFactor(p, m, 'meteor'), 1.4, 'controlled now');
    assert.equal(vulnTermsFactor(p, m, 'magic_missile'), 1, 'skillMore scoped to area skills');
    for (let t = 0; t < 1500; t += 50) updateMonsters(inst, 50);
    assert(m.stunMs <= 0 && (m.ctrlAgo ?? Infinity) > 0 && (m.ctrlAgo ?? Infinity) <= 1500 && vulnTermsFactor(p, m, 'meteor') === 1.4, 'within 1.5 s after the stun ended');
    for (let t = 0; t < 1000; t += 50) updateMonsters(inst, 50);
    assert.equal(vulnTermsFactor(p, m, 'meteor'), 1, 'too long ago');
  } finally { inst.destroy(); }
});

test('conditions: stacks from distance moved (decay all) and from kills (decay one), resource debt', () => {
  const { inst, p } = world('warrior', [
    { kind: 'stacking', buff: 'fx_stride', source: 'distance', per: 100, max: 5, decayMs: 2000, stackDmg: 2 },
    { kind: 'stacking', buff: 'fx_reap', source: 'kills', per: 1, max: 3, decay: 'one', decayMs: 1000, stackIas: 5, skills: ['cleave'] },
    { kind: 'resourceDebt', max: 50, skills: ['seismic_slam'], regenPct: -50 },
  ]);
  try {
    powerTick(inst, p, 50);
    p.x += 125; powerTick(inst, p, 50); p.x += 125; powerTick(inst, p, 50);
    assert.equal(getBuff(p, 'fx_stride')?.st, 2); assert.equal(p.live.dmg, 4, '250 units = 2 stacks × 2%');
    p.x += 1000; powerTick(inst, p, 50);
    assert.equal(getBuff(p, 'fx_stride')?.st, 2, 'a teleport-sized jump is not movement');
    tickBuffs(p, 2000); assert(!getBuff(p, 'fx_stride'), 'decay all: the buff runs out');
    for (let i = 0; i < 4; i++) onKillStacking(inst, p, 'cleave');
    onKillStacking(inst, p, 'rend');
    assert.equal(getBuff(p, 'fx_reap')?.st, 3, 'capped at 3; Rend kills do not count');
    inst.t += 1000; powerTick(inst, p, 50);
    assert.equal(getBuff(p, 'fx_reap')?.st, 2, 'decay one'); assert.equal(p.live.ias, 10);
    assert.equal(debtFloor(p, 'seismic_slam'), -50); assert.equal(debtFloor(p, 'rend'), 0); assert.equal(debtRegenFactor(p), 0.5);
  } finally { inst.destroy(); }
});

// ─────────────── 4. Sub-strike tags ───────────────

test('sub-strikes, proc strikes and grounds carry their own tags (plus their owner\'s)', () => {
  const undo = installFixtureGrounds();
  try {
    const idx = tagIndexFor('warrior', {});
    const devil = idx.get('dust_devil')!;
    assert(devil.has('summon') && devil.has('area') && devil.has('channel'), 'Dust Devils: summon + their owner Whirlwind\'s tags');
    assert(!idx.get('whirlwind')!.has('summon'));
    const rt = buildPowerRuntime([{ kind: 'legendary', id: 'fx', roll: 1, effects: [
      { kind: 'skillMore', tags: { anyOf: ['summon'] }, pct: 30 },
      { kind: 'proc', on: 'kill', strike: { id: 'fx_nova', coef: 1, radius: 100, tags: ['area'], element: 'cold' } },
      { kind: 'skillMore', tags: { allOf: ['area', 'cold'] }, pct: 20 },
      { kind: 'skillMore', tags: { allOf: ['ground', 'stun'] }, pct: 10 },
    ] }], idx);
    assert.equal(rt.ownStatic.get('dust_devil'), 1.3); assert.equal(rt.ownStatic.get('whirlwind'), undefined, 'Dust Devils from an item count as summons; Whirlwind does not');
    assert.equal(rt.ownStatic.get('fx_nova'), 1.2, 'proc strike tags');
    assert(idx.get('fx_crack')!.has('ground') && idx.get('fx_crack')!.has('stun'), 'ground: own tags + ground + its owner (Ground Stomp)');
    assert(idx.get('fx_cinder')!.has('burn') && idx.get('fx_cinder')!.has('fire'));
  } finally { undo(); }
});

// ─────────────── 5. Ground framework ───────────────

test('grounds as data: rime (tick + freeze after 1.5 s inside), faultline (stun on cross, once per 3 s), crack, furrow, limits, own-ground test', () => {
  const undo = installFixtureGrounds();
  const { inst, p, mob, move, advance, center } = world('warrior', [{ kind: 'conditional', bucket: 'own', pct: 10, when: { inOwnGround: true } }]);
  try {
    const m = mob(120, 0), hp0 = m.hp;
    placeGround(inst, p, 'fx_rime', m.x, m.y, 0);
    advance(1000);
    assert(m.chillMs > 0 && m.hp < hp0 && m.freezeMs <= 0, 'ticks chill and damage; no freeze yet');
    advance(600);
    assert(m.freezeMs > 0, 'frozen after 1.5 s inside');
    // The bible faultline lasts as long as its re-arm time; a test-local line shows the re-arm rule itself.
    const undoLine = registerGroundDefs([{ id: 'fx_line_test', name: 'Line', shape: 'line', lineLength: 200, radius: 20, durationMs: 10000, onEnter: { status: { kind: 'stun', ms: 1000 }, againAfterMs: 1000 } }]);
    const n = mob(-400, 0); move(n, -300, 0);
    placeGround(inst, p, 'fx_line_test', center.x - 400, center.y, 0);
    advance(50); assert(n.stunMs > 0, 'stunned when the line appears under it'); n.stunMs = 0;
    advance(100); assert.equal(n.stunMs, 0, 'standing on it does not re-stun');
    move(n, -300, 200); advance(50); move(n, -300, 0); advance(50);
    assert.equal(n.stunMs, 0, 'crossing again within the re-arm time: no stun');
    move(n, -300, 200); advance(1000); move(n, -300, 0); advance(50);
    assert(n.stunMs > 0, 'crossing again after it re-armed');
    undoLine();
    assert(validateContent().every((e) => !e.startsWith('grounds.fx_faultline')), 'the bible faultline (3 s, once per 3 s) validates');
    const k = mob(0, 300), k0 = k.hp;
    placeGround(inst, p, 'fx_crack', center.x - 100, center.y + 300, 0);
    advance(50); const k1 = k.hp; advance(200);
    assert(k1 < k0 && k.hp === k1, 'crack: enemies entering take one hit');
    const f = mob(150, -300), d0 = Math.hypot(f.x - p.x, f.y - p.y);
    placeGround(inst, p, 'fx_furrow', center.x + 50, center.y - 300, 0);
    advance(50);
    assert(Math.hypot(f.x - p.x, f.y - p.y) < d0, 'furrow pulls toward the owner');
    for (let i = 0; i < 4; i++) placeGround(inst, p, 'fx_cinder', center.x, center.y + 500, 0);
    assert.equal(inst.grounds.filter((g) => g.fx?.def.id === 'fx_cinder' && g.endT > 0).length, 3, 'maxPerOwner');
    assert.equal(p.ctx.powers.watchGround, true);
    for (const g of inst.grounds) g.endT = 0;
    inst.t += 50; updateGrounds(inst, 50);
    updateOwnGround(inst, p); assert.equal(p.inOwnGround, false);
    placeGround(inst, p, 'fx_tremor', p.x, p.y, 0);
    updateOwnGround(inst, p); assert.equal(p.inOwnGround, true, 'owner standing in it');
    assert.equal(placeGround(inst, p, 'fx_unknown', p.x, p.y, 0), null);
  } finally { inst.destroy(); undo(); }
});

// ─────────────── 6. Projectiles ───────────────

test('projectile rules: distance flown, wall bounce, retarget, homing to marked enemies; deflection', () => {
  const { inst, p, mob, center } = world('ranger', [
    { kind: 'projectile', skills: ['fx_shot'], distBonus: { pct: 20, atUnits: 400 }, bounces: 1, bounceScale: 0.5, retarget: true },
    { kind: 'projectile', skills: ['fx_seek'], seekMarked: { turn: 6, range: 500 } },
    { kind: 'deflect', range: 200, halfAngleDeg: 60 },
  ]);
  try {
    const st = { skill: 'fx_shot', coef: 1, el: 'physical' as const, pct: 0 };
    const a = spawnProj(inst, { kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y, angle: Math.PI / 2, speed: 400, lifeMs: 300, r: 6, el: 'physical', strike: st });
    assert(a.rule && a.seek, 'rule attached; retarget makes it seek');
    updateProjectiles(inst, 50); updateProjectiles(inst, 50);
    assert(Math.abs((a.flown ?? 0) - 40) < 1e-6, 'distance flown');
    a.flown = 200; assert(Math.abs(flownStrike(a).mult! - 1.1) < 1e-12, 'half way: +10%');
    a.flown = 900; assert(Math.abs(flownStrike(a).mult! - 1.2) < 1e-12, 'full bonus at 400 units');
    let wall: { ang: number } | null = null;
    for (let i = 0; i < 64 && !wall; i++) { const ang = i / 64 * Math.PI * 2; for (let d = 300; d <= 900; d += 10) if (shotBlockedAt(inst, center.x + Math.cos(ang) * d, center.y + Math.sin(ang) * d)) { wall = { ang }; break; } }
    assert(wall, 'a wall near the arena');
    const b = spawnProj(inst, { kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y, angle: wall.ang, speed: 600, lifeMs: 3000, r: 6, el: 'physical', strike: st });
    let next = null;
    for (let t = 0; t < 3000 && !next; t += 50) { updateProjectiles(inst, 50); next = inst.projs.find((q) => q !== b && q.rule && q.bounces === 0 && !q.dead) ?? null; }
    assert(b.dead && next, 'bounced: the continuation has no bounces left');
    assert.equal(next!.strike!.coef, 0.5, 'bounceScale');
    const m = mob(0, -250); m.markMs = 3000;
    const c = spawnProj(inst, { kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y, angle: 0, speed: 600, lifeMs: 800, r: 6, el: 'physical', strike: { ...st, skill: 'fx_seek' } });
    assert.equal(c.homing, m.id); assert.equal(c.turn, 6);
    p.mv.faceX = 1; p.mv.faceY = 0;
    const h = spawnProj(inst, { kind: 'spark', v: 'spark', mob: m, src: m.id, x: p.x + 120, y: p.y + 10, angle: Math.PI, speed: 50, lifeMs: 2000, r: 8, el: 'lightning', dmg: 1 });
    powerTick(inst, p, 50);
    assert(h.dead, 'deflect cleared the hostile projectile in front');
    const far = spawnProj(inst, { kind: 'spark', v: 'spark', mob: m, src: m.id, x: p.x + 500, y: p.y, angle: Math.PI, speed: 1, lifeMs: 2000, r: 8, el: 'lightning', dmg: 1 });
    assert.equal(clearHostileProjectiles(inst, p.x, p.y, 0, Math.PI / 3, 200), 0); assert(!far.dead);
  } finally { inst.destroy(); }
});

// ─────────────── 7. Monster statuses ───────────────

test('monster statuses: bleed stacks and carry-over, freeze build-up, weaken, taunt, scoped vulnerability', () => {
  const { inst, p, mob, center } = world('warrior', [{ kind: 'dot', dot: 'bleed', stacks: 3, strengthPct: 70 }, { kind: 'dot', dot: 'burn', carryPct: 100, skills: ['fx_ember'] }]);
  try {
    const m = mob(100, 0);
    const bleed = () => ({ kind: 'bleed' as const, owner: p.id, skill: 'rend', perTick: 10, el: 'physical' as const, tickMs: 500, nextMs: 500, leftMs: 3000, durMs: 3000 });
    for (let i = 0; i < 4; i++) addOwnedDot(p, m, bleed());
    assert.equal(m.dots.filter((d) => d.kind === 'bleed').length, 3, 'three separate instances');
    assert(m.dots.every((d) => Math.abs(d.perTick - 7) < 1e-9), '70% strength');
    const burn = (left: number) => ({ kind: 'burn' as const, owner: p.id, skill: 'fx_ember', perTick: 10, el: 'fire' as const, tickMs: 500, nextMs: 500, leftMs: left, durMs: left });
    addOwnedDot(p, m, burn(2000)); addOwnedDot(p, m, burn(3000));
    const b = m.dots.find((d) => d.kind === 'burn')!;
    assert(Math.abs(b.perTick - (10 + 40 / 6)) < 1e-9, 'the remaining 4 ticks × 10 carried into the new 6-tick burn');
    const legacy = mob(-100, 0);
    addDot(legacy, burn(3000)); addDot(legacy, { ...burn(1000), perTick: 5 });
    assert.equal(legacy.dots[0].perTick, 10, 'without rules the legacy refresh keeps the stronger dot');
    const fb = resolveStatus({ kind: 'freezeBuild', pct: 20, ms: 1500, windowMs: 2000 }, p.ctx.powers.index);
    const f = mob(0, 120);
    for (let i = 0; i < 4; i++) applyStatus(inst, p, f, fb, p.x, p.y, 'fx');
    assert.equal(f.freezeMs, 0);
    applyStatus(inst, p, f, fb, p.x, p.y, 'fx'); assert(f.freezeMs > 0, '5 × 20 within 2 s freezes');
    const g = mob(0, -120);
    for (let i = 0; i < 4; i++) applyStatus(inst, p, g, fb, p.x, p.y, 'fx');
    inst.t += 2100; applyStatus(inst, p, g, fb, p.x, p.y, 'fx');
    assert.equal(g.freezeMs, 0, 'old build-up expired');
    const w = mob(60, 60);
    applyStatus(inst, p, w, resolveStatus({ kind: 'weaken', pct: 30, ms: 4000 }, p.ctx.powers.index), p.x, p.y, 'fx');
    const base = defenseMult(p, 70, false), raw = p.mhp * 0.1 / base;
    assert.equal(damagePlayer(inst, p, raw, 'physical', w, 70), combatInteger(raw * 0.7 * defenseMult(p, w.level, false)), 'weakened attacker deals 30% less');
    const v = mob(-60, -60);
    applyStatus(inst, p, v, resolveStatus({ kind: 'vulnerable', pct: 20, ms: 3000, skills: ['seismic_slam'] }, p.ctx.powers.index), p.x, p.y, 'fx');
    applyStatus(inst, p, v, resolveStatus({ kind: 'vulnerable', pct: 10, ms: 3000, exceptSource: true }, p.ctx.powers.index), p.x, p.y, 'whirlwind');
    assert(Math.abs(vulnerability(p, v, 'seismic_slam') - 1.2 * 1.1) < 1e-12);
    assert(Math.abs(vulnerability(p, v, 'rend') - 1.1) < 1e-12);
    assert.equal(vulnerability(p, v, 'whirlwind'), 1, 'exceptSource: the applying skill does not benefit');
    const t = mob(200, 0);
    t.state = 'chase'; t.target = p.id;
    const point = { x: center.x + 200, y: center.y + 250 };
    applyStatus(inst, p, t, resolveStatus({ kind: 'taunt', ms: 2000 }, p.ctx.powers.index), point.x, point.y, 'fx');
    const d0 = Math.hypot(t.x - point.x, t.y - point.y);
    for (let i = 0; i < 10; i++) updateMonsters(inst, 50);
    assert(Math.hypot(t.x - point.x, t.y - point.y) < d0 - 20, 'taunted: walks to the taunt point');
    const boss = mob(-200, 0, 4);
    applyStatus(inst, p, boss, resolveStatus({ kind: 'taunt', ms: 2000 }, p.ctx.powers.index), point.x, point.y, 'fx');
    assert(!boss.ps || boss.ps.tauntMs === 0, 'bosses ignore taunts (ccFactor)');
  } finally { inst.destroy(); }
});

// ─────────────── 8. Rule changes, tag grants, Inscriptions ───────────────

test('tagGrant: one fixed order — grants read the ungranted index together, sub-strikes inherit, fromSlot copies a skill', () => {
  const idx = tagIndexFor('ranger', {});
  const rt = buildPowerRuntime([{ kind: 'inscription', id: 'fx', roll: 1, effects: [
    { kind: 'tagGrant', tags: { anyOf: ['summon'] }, add: ['mark'] },
    { kind: 'tagGrant', tags: { anyOf: ['mark'] }, add: ['trap'] },
    { kind: 'tagGrant', tags: { anyOf: ['primary'] }, fromSlot: 0 },
    { kind: 'skillMore', tags: { anyOf: ['spender'] }, pct: 10 },
  ] }], idx, { legendaries: 0, setBonus: false, slots: ['multishot', null, null, null] });
  assert(rt.index.get('sentry')!.has('mark') && !rt.index.get('sentry')!.has('trap'), 'no chaining between grants');
  assert(rt.index.get('hungering_arrow')!.has('spender'), 'the primary gained slot 1 (Multishot: Spender · Projectile · Piercing) tags');
  assert.equal(rt.ownStatic.get('hungering_arrow'), 1.1, 'later tag-keyed effects see the grant');
  const w = buildPowerRuntime([{ kind: 'inscription', id: 'fx', roll: 1, effects: [{ kind: 'tagGrant', skills: ['whirlwind'], add: ['burn'] }] }], tagIndexFor('warrior', {}));
  assert(w.index.get('dust_devil')!.has('burn'), 'sub-strikes inherit their owner\'s grants');
});

test('rule changes: charges, spend refund, buff upkeep, grounds follow, counts-as, channel movement', () => {
  const undo = installFixtureGrounds();
  const { inst, p, mob } = world('warrior', [
    { kind: 'rule', tags: { anyOf: ['cooldown'] }, rule: { id: 'charges', extra: 1 } },
    { kind: 'rule', tags: { anyOf: ['spender'] }, rule: { id: 'spendRefund', pct: 30, minHits: 5 } },
    { kind: 'rule', skills: ['battle_rage'], rule: { id: 'buffUpkeep', everyMs: 10000 } },
    { kind: 'rule', rule: { id: 'groundsFollow', scale: 0.5 } },
    { kind: 'rule', rule: { id: 'countsAs', state: 'chilled', as: 'stunned' } },
    { kind: 'conditional', bucket: 'hit', pct: 35, when: { targetState: 'stunned' } },
    { kind: 'skillMods', skills: ['whirlwind'], mods: { vars: { channelMovePct: -60 } } },
    { kind: 'rule', skills: ['whirlwind'], rule: { id: 'channelMove', pct: 80 } },
  ], { slots: ['ground_stomp', 'seismic_slam', 'battle_rage', 'whirlwind'] });
  try {
    for (let i = 0; i < 6; i++) mob(70 + (i % 3) * 25, (i < 3 ? -1 : 1) * 20);
    const cast = brainForTest(inst, p);
    assert.equal(cast(0, 'ground_stomp'), null, 'first charge');
    const cd = p.readyAt.get('ground_stomp')! - inst.t;
    assert.equal(cast(0, 'ground_stomp'), null, 'second charge');
    assert(Math.abs(p.readyAt.get('ground_stomp')! - inst.t - 2 * cd) < 1e-6, 'recharge clock two cooldowns ahead');
    assert.match(cast(0, 'ground_stomp') ?? '', /cooldown/, 'no third charge');
    p.mv.faceX = 1; p.mv.faceY = 0; p.res = 31;
    assert.equal(cast(1, 'seismic_slam'), null);
    assert.equal(p.res, 10, '31 − 30 + 30% refund after hitting 5+ enemies');
    p.res = 100; p.sinceHitMs = 0;
    addBuff(p, { id: 'battle_rage', ms: 60, dmg: 10 });
    powerTick(inst, p, 50);
    assert.equal(getBuff(p, 'battle_rage')!.ms, 10000); assert(p.res < 100, 're-costed in combat');
    getBuff(p, 'battle_rage')!.ms = 60; p.sinceHitMs = 1e9; p.sinceHurtMs = 1e9;
    powerTick(inst, p, 50); assert.equal(getBuff(p, 'battle_rage')!.ms, 60, 'out of combat it runs out');
    const g = placeGround(inst, p, 'fx_tremor', p.x + 300, p.y, 0)!;
    assert.equal(g.r, 60, 'half size'); p.x += 40; p.mv.x = p.x;
    inst.t += 50; updateGrounds(inst, 50);
    assert(Math.abs(g.x - p.x) < 1e-9 && Math.abs(g.y - p.y) < 1e-9, 'follows the owner');
    assert.equal(p.ctx.powers.stunFactor, 1, 'an aliased stunned condition is not folded');
    const c = mob(-80, 0); c.chillMs = 1000;
    assert.equal(vulnTermsFactor(p, c, 'cleave'), 1.35, 'chilled counts as stunned');
    assert.equal(channelMoveFactor(p, 'whirlwind'), 0.8, 'the 60% channel slow raised to 80%');
  } finally { inst.destroy(); undo(); }
});

test('Inscriptions: only one is active (first equipped in slot order); fixtures validate, broken data does not', () => {
  const undoI = installFixtureInscriptions(), undoG = installFixtureGrounds();
  try {
    const save = createCharacter('Fabled', 'ranger', 3);
    const fabled = (id: string) => ({ inscription: id } as unknown as Item);
    save.equipment = { shoulders: fabled('fx_cooldown_charge'), head: fabled('fx_aerial_projectile') } as typeof save.equipment;
    const ids = (s = save) => allPowerSources(s, {}, {}).filter((x) => x.kind === 'inscription').map((x) => x.id);
    assert.deepEqual(ids(), ['inscription:fx_aerial_projectile'], 'head comes before shoulders');
    save.equipment = { shoulders: fabled('fx_cooldown_charge'), head: fabled('fx_missing') } as typeof save.equipment;
    assert.deepEqual(ids(), ['inscription:fx_cooldown_charge'], 'unknown ids are skipped');
    assert.deepEqual(validateContent().filter((e) => e.startsWith('grounds.') || e.startsWith('inscriptions.')), []);
    const broken = validateContent({ ...CONTENT_DATA,
      grounds: { ...CONTENT_DATA.grounds, fx_bad: { id: 'fx_bad', name: 'Bad', radius: 0, durationMs: 100, shape: 'line' } },
      inscriptions: { ...CONTENT_DATA.inscriptions, fx_mult: { id: 'fx_mult', name: 'X', group: 'jewelry', text: 'Skills deal 10% more damage.', effects: [{ kind: 'skillMore', tags: { anyOf: ['area'] }, pct: 10 }] } },
      legendaries: { ...CONTENT_DATA.legendaries, fx_proc: { ...CONTENT_DATA.legendaries[Object.keys(CONTENT_DATA.legendaries)[0]], id: 'fx_proc',
        effects: [{ kind: 'proc', on: 'hit', minHitPct: 30, applyStatus: { kind: 'stun' } }, { kind: 'rule', rule: { id: 'charges', extra: 0 } }] } },
    });
    for (const want of ['grounds.fx_bad', 'inscriptions.fx_mult.effects[0]', 'legendaries.fx_proc.effects[0]', 'legendaries.fx_proc.effects[1]'])
      assert(broken.some((e) => e.startsWith(want)), `${want} rejected:\n${broken.join('\n')}`);
  } finally { undoI(); undoG(); }
});

// ─────────────── 9. Harness variants, search, count cap flag ───────────────

test('harness: dash and life variants, item-pool search, class coverage; the bible count cap sits behind a flag', () => {
  const { inst, p } = world('warrior', [{ kind: 'conditional', bucket: 'own', pct: 20, when: { lifeBelowPct: 50 } }]);
  try {
    p.debugInfiniteHp = true; p.debugPinLifePct = 40; p.sinceHurtMs = 0;
    playerTick(inst, p, 50);
    assert.equal(p.hp, p.mhp * 40 / 100); assert.equal(ownMultiplier(p, 'cleave'), 1.2, 'pinned life satisfies a life threshold');
  } finally { inst.destroy(); }
  const spec = planKit(profileOf(Object.values(SETS).find((s) => s.classId === 'warrior')!), 'set');
  const r = runEncounter(kitSave(spec, 101), 0, 101, { dash: true });
  assert((r.dashes ?? 0) > 0, 'the dash variant dashes toward the pack');
  const slots = (['head', 'shoulders', 'chest', 'hands', 'legs', 'feet'] as const).filter((s) => slotCandidates('warrior', s).some((c) => 'legendary' in c)).slice(0, 2);
  assert(slots.length > 0, 'warrior armour legendaries exist');
  const target = new Map(slots.map((s) => [s, slotCandidates('warrior', s).find((c) => 'legendary' in c)!]));
  const score = (k: typeof spec) => [...target].filter(([s, c]) => JSON.stringify(k.equipment[s]) !== JSON.stringify(c)).length;
  const res = searchKit(spec, { score, restarts: 3, seed: 5, slots: [...slots] });
  assert.equal(res.score, 0, 'coordinate ascent reaches the optimum of a separable score'); assert(kitLegal(res.best));
  assert.deepEqual(classCoverage({ a: 100, b: 120, c: 200 }), { within: ['a', 'b'], total: 3, share: 2 / 3 });
  assert.equal(USE_BIBLE_COUNT_CAP, false);
  assert.deepEqual(ITEM_COUNT_CAP, { maxSummons: 3, projectiles: 2 }, 'today\'s value by default');
  assert.deepEqual(ITEM_COUNT_CAP_BIBLE, { maxSummons: 2, projectiles: 2 });
  const owner = { source: 'separate', perLevel: 1, fromLevel: 21, treeRankCap: 10 } as const;
  assert.deepEqual([specPointsForLevel(70, owner), specPointsForLevel(20, owner)], [50, 0], "the owner's economy (50 points at L70 from L21) is one switch away");
});
