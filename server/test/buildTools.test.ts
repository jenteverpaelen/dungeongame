// Build tools M1 (docs/rework/depth/BUILD-TOOLS.md): the damage sheet's numbers are the combat code's own, the
// bench measures per skill, loadouts and build codes apply only what the character may use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buySkillTier, createCharacter, resetSkillPoints, setPrimarySkill, setSkillRune, setSkillSlot } from '../../shared/src/character';
import { BUILD_CODE_RE, buildCodeRegistryProblems, buildToSetup, decodeBuild, encodeBuild } from '../../shared/src/buildCode';
import { LEGENDARIES } from '../../shared/src/data/items';
import { Rng } from '../../shared/src/math';
import { applySetup, captureSetup, validLoadoutState } from '../../shared/src/loadouts';
import { passivesForClass, setPassive } from '../../shared/src/passives';
import { buySkillNode } from '../../shared/src/specialization';
import { applyBuildCommand, loadoutCommand } from '../src/buildTools';
import { SKILLS, skillsForClass } from '../../shared/src/data/skills';
import { computeStats } from '../../shared/src/stats';
import { powerSourceName } from '../../shared/src/powerSourceNames';
import type { ClassId } from '../../shared/src/types';
import type { PowerEffect } from '../../shared/src/powers';
import type { PowerSource } from '../../shared/src/powerSources';
import { buildSheet, skillSheet } from '../src/sim/breakdown';
import { expectedDamage, makeDot, strikeMob } from '../src/sim/damage';
import { addBuff, addOwnedDot } from '../src/sim/effects';
import { benchCommand, benchView, newBench } from '../src/sim/bench';
import { createMob, DUMMY_DEF, updateMonsters } from '../src/sim/monsters';
import { playerTick } from '../src/sim/players';
import { Instance } from '../src/sim/instance';
import { buildCtx, skillCooldownMs, skillCost, skillRadius } from '../src/sim/playerctx';
import { strikeOf } from '../src/sim/skills/common';
import type { Session } from '../src/net/session';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
const skillsForClassIds = (c: ClassId) => skillsForClass(c).map((s) => s.id);

function world(classId: ClassId, effects: PowerEffect[] = [], o: { slots?: (string | null)[]; level?: number; runes?: Record<string, string>; tiers?: Record<string, number>; nodes?: Record<string, Record<string, number>> } = {}) {
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'bt', channel: 0, seed: 47, theme: 'glade', level: 70, difficulty: 5 });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const save = createCharacter('Builder', classId, 9); save.level = o.level ?? 70;
  if (o.slots) save.skills.slots = o.slots;
  if (o.runes) save.skills.runes = o.runes;
  if (o.tiers) save.skills.tiers = o.tiers;
  if (o.nodes) save.skills.nodes = o.nodes;
  const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed() {}, rec: { inst } } as unknown as Session;
  s.entityId = inst.addPlayer(s);
  const p = inst.playerById(s.entityId)!;
  const extra: PowerSource[] = effects.length ? [{ kind: 'legendary', id: 'faultcleaver', roll: 1, effects }] : [];
  p.ctx = buildCtx(save, computeStats(save), extra);
  return { inst, p, save, s };
}

test('sheet: the factors multiply back to expectedDamage, final cost / cooldown / radius are the playerctx values', () => {
  const { inst, p } = world('warrior', [
    { kind: 'skillMods', skills: ['whirlwind'], mods: { dmg: 40 } },
    { kind: 'ownMult', skills: ['whirlwind'], mult: 1.5 },
    { kind: 'conditional', when: { channeling: true }, bucket: 'own', pct: 20, skills: ['whirlwind'] },
    { kind: 'conditional', when: { targetState: 'stunned' }, bucket: 'hit', pct: 30 },
  ], { slots: ['whirlwind', 'ground_stomp', 'ironplough', null], runes: { whirlwind: 'dust_devils' }, tiers: { whirlwind: 2, ironplough: 1 } });
  try {
    addBuff(p, { id: 'fx_bt_rage', ms: 5000, dmg: 15 });
    const sheet = buildSheet(inst, p);
    assert.deepEqual(sheet.skills.map((x) => x.id), [p.ctx.primary.def.id, 'whirlwind', 'ground_stomp', 'ironplough']);
    for (const sk of sheet.skills) {
      const rt = p.ctx.modsOf(sk.id);
      const f = sk.factors;
      const product = sk.weaponAvg * f.coef * f.mainStat * f.skill * f.element * f.generic * f.own * f.hit * f.crit;
      assert(Math.abs(product - sk.perHit) <= Math.max(1, sk.perHit * 1e-3), `${sk.id}: factors ${product} vs perHit ${sk.perHit}`);
      assert.equal(sk.perHit, Math.round(expectedDamage(inst, p, strikeOf(p, rt))), `${sk.id}: the real expectedDamage`);
      assert.equal(sk.cost, +skillCost(p, rt).toFixed(2));
      assert.equal(sk.cooldownMs, Math.round(skillCooldownMs(p, rt)));
      assert.equal(sk.radius, Math.round(skillRadius(rt)));
    }
    const ww = sheet.skills.find((x) => x.id === 'whirlwind')!;
    const skillParts = ww.parts.skill.reduce((n, x) => n + x.value, 0);
    assert(Math.abs((ww.factors.skill - 1) * 100 - skillParts) < 1e-6, `skill bucket parts add up (${skillParts} vs ${(ww.factors.skill - 1) * 100})`);
    assert(ww.parts.skill.some((x) => x.src === 'legendary:faultcleaver' && x.value === 40), 'the power template is named');
    const plough = sheet.skills.find((x) => x.id === 'ironplough')!;
    assert(plough.parts.skill.some((x) => x.src === 'tier:1' && x.value === 25), 'a bought tier with damage is listed (Sharpened Share +25%)');
    assert.equal(ww.factors.own, 1.5, 'own bucket: the static ×1.5 (not channelling now)');
    const own = ww.conds.find((c) => c.bucket === 'own');
    assert(own && !own.holds && own.pct === 20, 'the conditional own term is listed and does not hold now');
    assert(ww.parts.generic.some((x) => x.src === 'buff:fx_bt_rage' && x.value === 15), 'buff damage listed');
    assert.equal(ww.vs.stunned, +p.ctx.stunMult.toFixed(4), 'stunned enemies: the folded factor');
    assert(ww.vs.parts.some((x) => x.src === 'legendary:faultcleaver'), 'with its source');
    assert(ww.tags.includes('channel') && ww.tags.includes('area'), 'final tags');
    assert.equal(powerSourceName('legendary:faultcleaver'), 'Faultcleaver');
    assert.equal(powerSourceName('set:set:cinder_oath:6'), 'Cinder Oath (6)');
    assert.equal(powerSourceName('node:ironplough:brace'), 'Ironplough: Brace');
    assert.equal(skillSheet(inst, p, 'meteor'), null, 'another class’s skill');
  } finally { inst.destroy(); }
});

test('sheet: reading it changes nothing (no element-stack bookkeeping, no RNG draw)', () => {
  const { inst, p } = world('mage', [{ kind: 'elementStacks', elements: ['fire', 'cold', 'lightning'], windowMs: 6000, perStack: 10 }], { slots: ['meteor', null, null, null] });
  try {
    const rngBefore = JSON.stringify(inst.rng), ele = JSON.stringify(p.lastEle);
    buildSheet(inst, p);
    assert.equal(JSON.stringify(p.lastEle), ele, 'element stacks only read');
    assert.equal(JSON.stringify(inst.rng), rngBefore, 'no random draw');
  } finally { inst.destroy(); }
});

test('sheet: every skill of every class — perHit is the combat code’s expectedDamage, factors multiply back', () => {
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    const { inst, p } = world(cls);
    try {
      for (const sk of skillsForClassIds(cls)) {
        const s = skillSheet(inst, p, sk)!;
        assert(s, `${cls} ${sk}`);
        assert.equal(s.perHit, Math.round(expectedDamage(inst, p, strikeOf(p, p.ctx.modsOf(sk)))), `${sk} perHit`);
        const f = s.factors, product = s.weaponAvg * f.coef * f.mainStat * f.skill * f.element * f.generic * f.own * f.hit * f.crit;
        assert(Math.abs(product - s.perHit) <= Math.max(1, s.perHit * 1e-3), `${sk}: ${product} vs ${s.perHit}`);
      }
    } finally { inst.destroy(); }
  }
});

test('bench: per-skill split sums to the total, starts at the first hit, ends at its length; start needs town and a dummy', () => {
  const { inst, p } = world('warrior', [], { slots: ['rend', null, null, null] });
  try {
    assert.deepEqual(benchCommand(inst, p, 'start', 60), { ok: false, err: 'The training dummies are in Hearthmere' });
    const dummy = createMob(inst, DUMMY_DEF, 70, p.x + 60, p.y, { dummy: true });
    p.bench = newBench(30_000);
    assert.equal(benchView(p)!.state, 'armed');
    for (let i = 0; i < 20; i++) { inst.t += 50; playerTick(inst, p, 50); }
    assert.equal(benchView(p)!.elapsedS, 0, 'the clock waits for the first hit');
    strikeMob(inst, p, dummy, { skill: 'cleave', coef: 1, el: 'physical', pct: 0 });
    strikeMob(inst, p, dummy, { skill: 'rend', coef: 2, el: 'physical', pct: 0 });
    addOwnedDot(p, dummy, makeDot(inst, p, { skill: 'rend', coef: 1, el: 'physical', pct: 0 }, 'bleed', 4000, 500));
    for (let i = 0; i < 40; i++) { inst.t += 50; playerTick(inst, p, 50); updateMonsters(inst, 50); }
    const v = benchView(p)!;
    assert.equal(v.state, 'running');
    assert.equal(v.skills.reduce((n, s) => n + s.total, 0), v.total, 'the split sums to the total');
    assert.deepEqual(v.skills.map((s) => s.id).sort(), ['cleave', 'rend']);
    assert(v.dotShare > 0 && v.hits === 2, 'two hits plus bleed ticks');
    assert(dummy.hp >= 1 && !dummy.dead, 'dummies never die');
    for (let i = 0; i < 30 * 20; i++) { inst.t += 50; playerTick(inst, p, 50); }
    assert.equal(benchView(p)!.state, 'done'); assert.equal(benchView(p)!.elapsedS, 30);
    const frozen = benchView(p)!.total;
    strikeMob(inst, p, dummy, { skill: 'cleave', coef: 1, el: 'physical', pct: 0 });
    assert.equal(benchView(p)!.total, frozen, 'a finished test records nothing more');
    assert.deepEqual(benchCommand(inst, p, 'reset', 0), { ok: true, view: null });
  } finally { inst.destroy(); }
});

test('loadouts: save, change everything, apply → the same skill state and the same derived stats; town only; locked parts skipped', () => {
  const save = createCharacter('Loadouts', 'warrior', 21); save.level = 70; save.skillPoints = 69;
  assert.equal(setSkillSlot(save, 0, 'ironplough'), null); assert.equal(setSkillSlot(save, 1, 'muster_standard'), null);
  assert.equal(setSkillRune(save, 'ironplough', SKILLS.ironplough.runes[2].id), null);
  assert.equal(buySkillTier(save, 'ironplough'), null); assert.equal(buySkillTier(save, 'ironplough'), null);
  assert.equal(buySkillNode(save, 'ironplough', 'broad_share'), null); assert.equal(buySkillNode(save, 'ironplough', 'broad_share'), null);
  assert.equal(buySkillNode(save, 'ironplough', 'sod_burst'), null);
  assert.equal(setPassive(save, 0, 'warrior_bellwether'), null);
  const want = JSON.stringify({ skills: save.skills, passives: save.passives, points: save.skillPoints });
  const stats = JSON.stringify(computeStats(save));
  const s = { save, rec: { kind: 'field' }, changed() {} } as unknown as Session;
  assert.deepEqual(loadoutCommand(s, { action: 'save', index: 0, name: '  Plough  ' }), { ok: true });
  assert.equal(save.loadouts!.sets[0]!.name, 'Plough');
  resetSkillPoints(save); setSkillSlot(save, 0, 'whirlwind'); setSkillSlot(save, 1, null); setSkillRune(save, 'ironplough', null); setPassive(save, 0, null);
  assert.notEqual(JSON.stringify({ skills: save.skills, passives: save.passives, points: save.skillPoints }), want);
  assert.match(loadoutCommand(s, { action: 'apply', index: 0 }).err ?? '', /Hearthmere/, 'only in town');
  (s.rec as { kind: string }).kind = 'town';
  const r = loadoutCommand(s, { action: 'apply', index: 0 });
  assert.deepEqual(r, { ok: true, data: { skipped: [] } });
  assert.equal(JSON.stringify({ skills: save.skills, passives: save.passives, points: save.skillPoints }), want, 'identical skill state');
  assert.equal(JSON.stringify(computeStats(save)), stats, 'identical derived stats');
  // A level-20 hero applying it: what it may not use is reported, the rest applies.
  const low = createCharacter('Low', 'warrior', 22); low.level = 20; low.skillPoints = 19;
  const skipped = applySetup(low, save.loadouts!.sets[0]!);
  assert(skipped.some((x) => /Ironplough/.test(x)), `locked parts reported: ${skipped.join('; ')}`);
  assert.equal(low.skills.slots.includes('ironplough'), false);
  assert.equal(validLoadoutState(save.loadouts, 'warrior'), true);
  assert.equal(validLoadoutState({ revision: 1, sets: [{ name: 'x', primary: 'meteor' }] }, 'warrior'), false);
});

test('build codes: lossless round trip for random legal builds of every class, ≤ 160 characters, damage rejected, registry complete', () => {
  const rng = new Rng(77);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rng.next() * a.length)];
  assert.deepEqual(buildCodeRegistryProblems(), []);
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) for (let k = 0; k < 25; k++) {
    const save = createCharacter(`Code${k}`, cls, 100 + k); save.level = 70; save.skillPoints = 69;
    const skills = skillsForClass(cls).filter((s) => s.kind !== 'primary');
    const primaries = skillsForClass(cls).filter((s) => s.kind === 'primary');
    setPrimarySkill(save, pick(primaries).id);
    for (let i = 0; i < 4; i++) setSkillSlot(save, i, rng.next() < 0.15 ? null : pick(skills).id);
    for (const id of [save.skills.primary, ...save.skills.slots]) if (id) {
      const def = SKILLS[id];
      if (rng.next() < 0.7) setSkillRune(save, id, pick(def.runes).id);
      for (let t = Math.floor(rng.next() * 4); t > 0; t--) buySkillTier(save, id);
      for (let n = 0; n < 12; n++) { const node = def.nodes?.length ? pick(def.nodes) : null; if (node) buySkillNode(save, id, node.id); }
    }
    const ps = passivesForClass(cls);
    for (let i = 0; i < 4; i++) setPassive(save, i, rng.next() < 0.2 ? null : pick(ps).id);
    const legs = Object.values(LEGENDARIES).filter((l) => !l.classes || l.classes.includes(cls));
    save.cube.equipped = [pick(legs).id, rng.next() < 0.5 ? pick(legs).id : null, null];
    for (const slot of ['head', 'chest', 'hands', 'legs', 'feet', 'shoulders', 'waist', 'wrists', 'neck', 'ring1', 'ring2'] as const) {
      const l = pick(legs);
      save.equipment[slot] = { id: `${slot}${k}`, rarity: 'legendary', legendary: { power: l.id, value: 1, min: 1, max: 1 } } as never;
    }
    const code = encodeBuild(save);
    assert(code.length <= 160, `${cls} build code is ${code.length} characters`);
    assert.match(code, BUILD_CODE_RE);
    const d = decodeBuild(code);
    assert(d.ok, `${cls} decodes`);
    const want = captureSetup(save), got = buildToSetup(d.build);
    const bar = [...new Set([want.primary, ...want.slots.filter((s): s is string => !!s)])];
    assert.equal(got.primary, want.primary); assert.deepEqual(got.slots, want.slots); assert.deepEqual(got.passives, want.passives);
    for (const id of bar) {
      assert.equal(got.runes[id] ?? null, want.runes[id] ?? null, `${id} rune`);
      assert.equal(got.tiers[id] ?? 0, want.tiers[id] ?? 0, `${id} tier`);
      assert.deepEqual(got.nodes[id] ?? {}, want.nodes[id] ?? {}, `${id} nodes`);
    }
    assert.deepEqual(d.build.cube, save.cube.equipped);
    assert.equal(d.build.gear.length, 11);
    assert.deepEqual(d.unknown, []);
    const broken = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
    assert.equal(decodeBuild(broken).ok, false, 'one changed character is rejected');
  }
  assert.equal(decodeBuild('HF1.notacode').ok, false);
  assert.equal(decodeBuild('hello').ok, false);
});

test('applyBuild: same class, in town; skills only — gear never changes; another class is refused', () => {
  const src = createCharacter('Src', 'warrior', 31); src.level = 70; src.skillPoints = 69;
  setSkillSlot(src, 0, 'rend'); setSkillRune(src, 'rend', SKILLS.rend.runes[0].id); buySkillTier(src, 'rend'); setPassive(src, 0, 'warrior_open_veins');
  src.equipment.head = { id: 'x', rarity: 'legendary', legendary: { power: 'faultcleaver', value: 1, min: 1, max: 1 } } as never;
  const code = encodeBuild(src);
  const dst = createCharacter('Dst', 'warrior', 32); dst.level = 70; dst.skillPoints = 69;
  const gear = JSON.stringify(dst.equipment);
  const s = { save: dst, rec: { kind: 'field' }, changed() {} } as unknown as Session;
  assert.match(applyBuildCommand(s, { code }).err ?? '', /Hearthmere/);
  (s.rec as { kind: string }).kind = 'town';
  assert.deepEqual(applyBuildCommand(s, { code }), { ok: true, data: { skipped: [] } });
  assert.equal(dst.skills.slots[0], 'rend'); assert.equal(dst.skills.runes.rend, SKILLS.rend.runes[0].id); assert.equal(dst.skills.tiers.rend, 1);
  assert.equal(dst.passives?.slots[0], 'warrior_open_veins');
  assert.equal(JSON.stringify(dst.equipment), gear, 'gear is shown in the code, never granted');
  const mage = createCharacter('Mage', 'mage', 33); mage.level = 70;
  assert.match(applyBuildCommand({ save: mage, rec: { kind: 'town' }, changed() {} } as unknown as Session, { code }).err ?? '', /another class/);
  assert.match(applyBuildCommand(s, { code: code.slice(0, -2) + 'zz' }).err ?? '', /damaged/);
});
