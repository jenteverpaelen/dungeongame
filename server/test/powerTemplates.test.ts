// Power templates (shared/src/powers.ts + server/src/sim/powerRuntime.ts).
// 1) 1:1 conversion: for every legendary (min / mid / max roll) and every set at 2/4/6 pieces, plus mixed kits, the
//    interpreter reproduces the pre-template hard-coded logic exactly (reference copied below from playerctx.ts @7846e60).
// 2) The new template vocabulary works (conditionals, procs, cap, dash, stats, node effects by rank).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, loadoutMods } from '../../shared/src/character';
import { LEGENDARIES, SETS } from '../../shared/src/data/items';
import { SKILLS, mergeMods, type SkillMods } from '../../shared/src/data/skills';
import { DASH } from '../../shared/src/constants';
import { computeStats } from '../../shared/src/stats';
import { OWN_BUCKET_CAP, describeEffect, powerText, powerTextIssues, type PowerEffect } from '../../shared/src/powers';
import { buildPowerRuntime, firePowerProcs, ownMultiplier, applyHitTerms, vulnTermsFactor, tagIndexFor } from '../src/sim/powerRuntime';
import { ITEM_COUNT_CAP } from '../../shared/src/powers';
import { matchesTags, skillTags } from '../../shared/src/data/skills';
import { PASSIVES, setPassive } from '../../shared/src/passives';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { buildCtx } from '../src/sim/playerctx';
import type { DerivedStats } from '../../shared/src/types';
import type { Mob, Player } from '../src/sim/types';
import type { Instance } from '../src/sim/instance';

// ─────────────── reference: the hard-coded logic before templates (verbatim semantics) ───────────────
const OLD_SKILL_EFFECT: Record<string, { skill: string; rolled: 'dmg' | 'cooldown'; mods: SkillMods }> = {
  faultcleaver: { skill: 'seismic_slam', rolled: 'dmg', mods: { cost: -40 } },
  rainspindle: { skill: 'rain_of_vengeance', rolled: 'cooldown', mods: { radius: 40 } },
  lanternroot: { skill: 'hydra', rolled: 'dmg', mods: { maxSummons: 1 } },
};
const ALT: Record<string, { skills: string[]; first: SkillMods; second: SkillMods; mult: number }> = {
  cinder_oath: { skills: ['cleave', 'rend'], first: { radius: 40 }, second: { cost: -40 }, mult: 127 },
  fault_warden: { skills: ['seismic_slam', 'ground_stomp'], first: { radius: 40 }, second: { cooldown: -30 }, mult: 22 },
  farwatch: { skills: ['hungering_arrow', 'multishot'], first: { pierce: 50 }, second: { cost: -40 }, mult: 30 },
  rainkeeper: { skills: ['rain_of_vengeance', 'cluster_arrow'], first: { radius: 40 }, second: { cooldown: -30 }, mult: 30 },
  glass_concord: { skills: ['magic_missile', 'black_hole'], first: { dmg: 40 }, second: { cooldown: -30 }, mult: 24 },
  lantern_garden: { skills: ['hydra', 'frost_nova'], first: { duration: 40 }, second: { cooldown: -30 }, mult: 24 },
};
function legacyExtraMods(pw: Record<string, number>, sets: Record<string, number>, skillId: string): SkillMods {
  const m: SkillMods = { flags: [] };
  const add = (k: 'dmg' | 'radius' | 'cost' | 'cooldown' | 'duration' | 'projectiles' | 'maxSummons', v: number) => { m[k] = (m[k] ?? 0) + v; };
  switch (skillId) {
    case 'whirlwind':
      if (pw.eternal_gyre) { add('cost', -pw.eternal_gyre); m.flags!.push('gyre'); }
      if (pw.ninefold_gale) m.flags!.push('dustDevils', 'ninefold');
      if ((sets.endless_storm ?? 0) >= 2) m.flags!.push('dustDevils');
      if ((sets.endless_storm ?? 0) >= 4) m.flags!.push('whirlRend', 'stormDR');
      break;
    case 'rend': if (pw.bloodwake) add('dmg', pw.bloodwake); break;
    case 'ground_stomp': if (pw.last_light) { add('dmg', pw.last_light); m.flags!.push('pull'); } break;
    case 'sentry':
      if (pw.sappers_pack) { add('maxSummons', 2); add('dmg', pw.sappers_pack); }
      if (pw.gearwright_heart) { add('cooldown', -pw.gearwright_heart); m.flags!.push('fastSentry'); }
      if ((sets.siegebreaker ?? 0) >= 2) { add('maxSummons', 1); add('cooldown', -30); }
      if ((sets.siegebreaker ?? 0) >= 4) m.flags!.push('sentryCasts');
      break;
    case 'multishot': if (pw.thunderhead) { m.element = 'lightning'; add('dmg', pw.thunderhead); } break;
    case 'hungering_arrow': if (pw.hunters_mark) m.flags!.push('huntersMark'); break;
    case 'meteor':
      if (pw.cindervane) { add('dmg', pw.cindervane); m.flags!.push('moltenDouble'); }
      if (pw.starfall_mantle) { add('cost', -pw.starfall_mantle); m.flags!.push('fastMeteor'); }
      if ((sets.fallen_star ?? 0) >= 2) m.flags!.push('secondMeteor');
      break;
    case 'black_hole': if (pw.void_heart) { add('radius', 30); m.flags!.push('voidHeart'); } break;
    case 'magic_missile': if (pw.thousand_missiles) { add('projectiles', 2); add('dmg', pw.thousand_missiles); } break;
  }
  let result = m;
  for (const [id, value] of Object.entries(pw)) {
    const e = OLD_SKILL_EFFECT[id];
    if (e?.skill === skillId) result = mergeMods(result, mergeMods(e.mods, { [e.rolled]: e.rolled === 'cooldown' ? -value : value }));
  }
  for (const [id, count] of Object.entries(sets)) {
    const a = ALT[id];
    if (!a || !a.skills.includes(skillId)) continue;
    if (count >= 2) result = mergeMods(result, a.first);
    if (count >= 4) result = mergeMods(result, a.second);
  }
  return result;
}
function legacyMult(sets: Record<string, number>, sentries: number, skillId: string): number {
  let authored = 1;
  for (const [id, count] of Object.entries(sets)) if (ALT[id] && count >= 6 && ALT[id].skills.includes(skillId)) authored *= ALT[id].mult;
  if (authored !== 1) return authored;
  switch (skillId) {
    case 'whirlwind': case 'dust_devil': return (sets.endless_storm ?? 0) >= 6 ? 51 : 1;
    case 'sentry': case 'multishot': case 'cluster_arrow': return (sets.siegebreaker ?? 0) >= 6 ? 1 + 2.5 * Math.min(4, sentries) : 1;
    case 'meteor': return (sets.fallen_star ?? 0) >= 6 ? 8 : 1;
  }
  return 1;
}

const STRIKES = [...Object.keys(SKILLS), 'dust_devil'];
const numeric = ['dmg', 'radius', 'cost', 'cooldown', 'duration', 'projectiles', 'pierce', 'gen', 'maxSummons'] as const;
function kits(): { powers: Record<string, number>; sets: Record<string, number>; label: string }[] {
  const out: { powers: Record<string, number>; sets: Record<string, number>; label: string }[] = [];
  for (const l of Object.values(LEGENDARIES)) for (const v of [l.range[0], (l.range[0] + l.range[1]) / 2, l.range[1], l.range[0] + (l.range[1] - l.range[0]) * 0.3719])
    out.push({ powers: { [l.id]: v }, sets: {}, label: `${l.id}=${v}` });
  for (const s of Object.values(SETS)) for (const n of [1, 2, 3, 4, 5, 6]) out.push({ powers: {}, sets: { [s.id]: n }, label: `${s.id}×${n}` });
  // Mixed kits: every class legendary of a class + its sets at 6 / 4+2.
  for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const pw = Object.fromEntries(Object.values(LEGENDARIES).filter((l) => !l.classes || l.classes.includes(classId)).map((l) => [l.id, l.range[0] + (l.range[1] - l.range[0]) * 0.6131]));
    const own = Object.values(SETS).filter((s) => s.classId === classId).map((s) => s.id);
    for (const id of own) out.push({ powers: pw, sets: { [id]: 6 }, label: `${classId} all + ${id}×6` });
    out.push({ powers: pw, sets: { [own[0]]: 4, [own[1]]: 2 }, label: `${classId} all + 4/2` });
    out.push({ powers: pw, sets: { [own[0]]: 2, [own[1]]: 2, [own[2]]: 2 }, label: `${classId} all + 2/2/2` });
  }
  return out;
}

test('every legendary and set: template mods, own-bucket multiplier, stun factor and dash equal the old code exactly', () => {
  let compared = 0;
  for (const kit of kits()) for (const classId of ['warrior', 'ranger', 'mage'] as const) {
    const save = createCharacter(`Equiv${classId}`, classId, 9); save.level = 70; save.equipment = {};
    for (const id of Object.keys(SKILLS)) if (SKILLS[id].classId === classId) { save.skills.tiers[id] = 2; save.skills.runes[id] = SKILLS[id].runes[1].id; }
    const base = computeStats(save);
    const d: DerivedStats = { ...base, powers: kit.powers, sets: kit.sets, dashCdMs: kit.powers.stridewind ? DASH.cooldownMs / 2 : DASH.cooldownMs };
    const ctx = buildCtx(save, d);
    for (const id of Object.keys(SKILLS)) {
      const now = ctx.modsOf(id).mods, then = mergeMods(loadoutMods(save, id), legacyExtraMods(kit.powers, kit.sets, id));
      for (const k of numeric) assert.equal(now[k], then[k], `${kit.label} ${id}.${k}`);
      assert.equal(now.element, then.element, `${kit.label} ${id}.element`);
      assert.deepEqual(new Set(now.flags), new Set(then.flags), `${kit.label} ${id}.flags`);
      compared++;
    }
    for (const sentries of [0, 1, 3, 5]) for (const id of STRIKES) {
      const p = { ctx, summons: Array.from({ length: sentries }, () => ({ type: 'sentry', dead: false })) } as unknown as Player;
      assert.equal(ownMultiplier(p, id), legacyMult(kit.sets, sentries, id), `${kit.label} mult ${id} @${sentries}`);
    }
    assert.equal(ctx.stunMult, 1 * (kit.powers.anvil_vambraces ? 1 + kit.powers.anvil_vambraces / 100 : 1), `${kit.label} stun`);
  }
  assert(compared > 3000, `compared ${compared}`);
});

test('legendary vars carry the rolled value the behaviour code reads (Ninefold Gale, Hunter’s Mark, Heart of the Void)', () => {
  for (const [power, skill, v] of [['ninefold_gale', 'whirlwind', 'dustDevilPct'], ['hunters_mark', 'hungering_arrow', 'markPct'], ['void_heart', 'black_hole', 'voidPct']] as const) {
    const rt = buildPowerRuntime([{ kind: 'legendary', id: power, roll: 173.25, effects: LEGENDARIES[power].effects }]);
    assert.equal(rt.mods.get(skill)?.vars?.[v], 173.25, power);
  }
});

test('stat templates reach the character sheet exactly like the old Witching Cord / Fists / Stridewind code', () => {
  const save = createCharacter('EquivStats', 'warrior', 2); save.level = 70;
  const plain = computeStats(save);
  const withPowers = (ids: string[]) => {
    const s = structuredClone(save);
    s.cube.equipped = ids.slice(0, 3).map((id) => id);
    return computeStats(s);
  };
  const d = withPowers(['witching_cord', 'mountain_fists', 'stridewind']);
  assert.equal(d.chd, plain.chd + LEGENDARIES.witching_cord.range[1]);
  assert.equal(d.area, plain.area + LEGENDARIES.mountain_fists.range[1]);
  assert.equal(d.ias, plain.ias + 7 + 15);
  assert.equal(d.dashCdMs, DASH.cooldownMs / 2);
  assert.equal(plain.dashCdMs, DASH.cooldownMs);
});

test('every authored legendary and set text is validated against its templates; generated text covers every kind', () => {
  for (const l of Object.values(LEGENDARIES)) assert.deepEqual(powerTextIssues(l.power, l.effects, true), [], l.id);
  for (const s of Object.values(SETS)) for (const b of s.bonuses) assert.deepEqual(powerTextIssues(b.text, b.effects ?? [], false), [], `${s.id} ${b.count}`);
  assert.match(powerTextIssues('Meteor deals {v}% increased damage.', LEGENDARIES.thousand_missiles.effects, true).join(), /mention 2/);
  assert.match(powerTextIssues('Meteor deals 10% increased damage.', LEGENDARIES.cindervane.effects, true).join(), /no \{v\}/);
  const samples: PowerEffect[] = [
    { kind: 'skillMods', skills: ['meteor'], mods: { radius: 20, element: 'cold' }, roll: { field: 'dmg' } },
    { kind: 'ownMult', skills: ['meteor', 'hydra'], mult: 3 },
    { kind: 'conditional', when: { channeling: 'whirlwind' }, bucket: 'hit', pct: 30 },
    { kind: 'conditional', when: { perSummon: 'sentry', max: 3 }, bucket: 'own', pct: { roll: 1 }, skills: ['sentry'] },
    { kind: 'stat', stat: 'chc', value: 5 },
    { kind: 'elementStacks', elements: ['fire', 'cold'], windowMs: 6000, perStack: 20 },
    { kind: 'elementCycle', elements: ['fire', 'cold'], periodMs: 3000, pct: 50, buffPrefix: 'cyc' },
    { kind: 'proc', on: 'crit', chance: 0.25, resource: 5 },
    { kind: 'dashCooldown', mult: 0.75 },
  ];
  for (const e of samples) {
    const text = describeEffect(e);
    assert(text.length > 10, e.kind);
    assert.deepEqual(powerTextIssues(text, [e], true), [], `${e.kind}: ${text}`);
  }
  assert(powerText(samples).length > 100);
});

// ─────────────── new vocabulary ───────────────
function fakePlayer(effects: PowerEffect[], roll = 1, extra: Partial<Player> = {}): Player {
  const powers = buildPowerRuntime([{ kind: 'passive', id: 'fx', roll, effects }]);
  return { ctx: { powers } as Player['ctx'], summons: [], buffs: [], live: { dmg: 0, chc: 0, chd: 0, ias: 0 }, readyAt: new Map(), res: 10, mres: 100,
    hp: 50, mhp: 100, channel: null, lastEle: {}, ouroIdx: 0, ...extra } as unknown as Player;
}
const inst = (rngValue = 0.5) => ({ t: 1000, rng: { next: () => rngValue } }) as unknown as Instance;

test('conditional own-bucket terms: channelling, buffs, life and per-summon scale the strike; the cap holds', () => {
  const p = fakePlayer([
    { kind: 'conditional', when: { channeling: 'whirlwind' }, bucket: 'own', pct: 100, skills: ['whirlwind'] },
    { kind: 'conditional', when: { lifeBelowPct: 60 }, bucket: 'own', pct: 50 },
    { kind: 'conditional', when: { perSummon: 'hydra', max: 2 }, bucket: 'own', pct: { roll: 10 }, skills: ['hydra'] },
  ], 3);
  assert.equal(ownMultiplier(p, 'whirlwind'), 1.5, 'not channelling: only the life term');
  p.channel = { skill: 'whirlwind', graceMs: 0, tickMs: 0, devilMs: 0, spunMs: 0 };
  assert.equal(ownMultiplier(p, 'whirlwind'), 2 * 1.5);
  p.summons = [{ type: 'hydra', dead: false }, { type: 'hydra', dead: false }, { type: 'hydra', dead: false }] as Player['summons'];
  assert.equal(ownMultiplier(p, 'hydra'), 1.5 * (1 + 0.3 * 2), 'perSummon capped at 2, pct = rank 3 × 10');
  const huge = fakePlayer([{ kind: 'ownMult', skills: ['meteor'], mult: 100 }, { kind: 'ownMult', skills: ['meteor'], mult: 100 }]);
  assert.equal(ownMultiplier(huge, 'meteor'), OWN_BUCKET_CAP);
});

test('per-hit conditions (element, buff) and target states (chilled, filtered stunned) multiply each hit', () => {
  const p = fakePlayer([
    { kind: 'conditional', when: { element: ['cold'] }, bucket: 'hit', pct: 20 },
    { kind: 'conditional', when: { buff: 'battle_rage' }, bucket: 'hit', pct: 10, skills: ['rend'] },
    { kind: 'conditional', when: { targetState: 'chilled' }, bucket: 'hit', pct: 25 },
    { kind: 'conditional', when: { targetState: 'stunned' }, bucket: 'hit', pct: 40, skills: ['meteor'] },
    { kind: 'conditional', when: { targetState: 'frozen' }, bucket: 'hit', pct: 30 },
  ]);
  assert.equal(applyHitTerms(inst(), p, 2, 'meteor', 'cold'), 2 * 1.2);
  assert.equal(applyHitTerms(inst(), p, 2, 'rend', 'fire'), 2);
  p.buffs.push({ id: 'battle_rage', ms: 1000 });
  assert.equal(applyHitTerms(inst(), p, 2, 'rend', 'fire'), 2 * 1.1);
  assert.equal(p.ctx.powers.frozenFactor, 1.3, 'unfiltered frozen folds into frozenMult');
  const mob = { stunMs: 100, freezeMs: 0, chillMs: 100, dots: [] } as unknown as Mob;
  assert.equal(vulnTermsFactor(p, mob, 'meteor'), 1.25 * 1.4);
  assert.equal(vulnTermsFactor(p, mob, 'hydra'), 1.25);
});

test('procs: chance uses the RNG only when authored; grants cooldown, resource and buffs (scaled by roll)', () => {
  const p = fakePlayer([
    { kind: 'proc', on: 'kill', resource: { roll: 2 }, buff: { id: 'fx_buff', ms: 2000, dmg: { roll: 5 } } },
    { kind: 'proc', on: 'crit', chance: 0.3, reduceCooldownsMs: 500 },
  ], 4);
  p.readyAt.set('meteor', 5000);
  let draws = 0;
  const counting = { t: 0, rng: { next: () => { draws++; return 0.2; } } } as unknown as Instance;
  firePowerProcs(counting, p, 'kill');
  assert.equal(draws, 0); assert.equal(p.res, 18); assert.deepEqual(p.buffs.find((b) => b.id === 'fx_buff'), { id: 'fx_buff', ms: 2000, dmg: 20 });
  firePowerProcs(counting, p, 'crit');
  assert.equal(draws, 1); assert.equal(p.readyAt.get('meteor'), 4500);
  firePowerProcs(inst(0.9), p, 'crit');
  assert.equal(p.readyAt.get('meteor'), 4500, 'failed chance');
  firePowerProcs(counting, p, 'dash'); assert.equal(draws, 1, 'no procs, no draws');
});

test('template passives join the same interpreter (slot order, after items) and leave stat passives untouched', async () => {
  const { installFixturePassives } = await import('../../shared/test/fixtures/depthContent');
  const { setPassive } = await import('../../shared/src/passives');
  const undo = installFixturePassives();
  try {
    const save = createCharacter('PassiveCtx', 'ranger', 5); save.level = 30; save.skills.slots = ['sentry', null, null, null];
    assert.equal(setPassive(save, 0, 'ranger_sentry'), null);
    assert.equal(setPassive(save, 1, 'fx_ranger_kennel'), null);
    const ctx = buildCtx(save);
    const p = { ctx, summons: [{ type: 'sentry', dead: false }, { type: 'sentry', dead: false }] } as unknown as Player;
    assert.equal(ownMultiplier(p, 'sentry'), 1 + 0.1 * 2);
    assert.equal(ownMultiplier(p, 'multishot'), 1);
    assert.equal(ctx.d.skillDmg.sentry, computeStats(save).skillDmg.sentry, 'stat passive unchanged');
  } finally { undo(); }
});

// ─────────────── content-bible vocabulary: skillMore, shared condition predicate, tags, count cap, per-legendary stat ───────────────
test('skillMore: unconditional own bucket (rolled), cast-time conditions with stacks, target conditions per hit', () => {
  const powers = buildPowerRuntime([{ kind: 'legendary', id: 'fx', roll: 30, effects: [
    { kind: 'skillMore', skills: ['meteor'], pct: { roll: 1 } },
    { kind: 'skillMore', skills: ['meteor'], pct: 6, when: { buffStacks: 'fx_stack', max: 5 } },
    { kind: 'skillMore', skills: ['meteor'], pct: 20, when: { standingStill: true } },
    { kind: 'skillMore', skills: ['meteor'], pct: 25, when: { targetState: 'immobilised' } },
    { kind: 'skillMore', skills: ['hydra'], pct: 10, when: { targetFartherThan: 300 } },
    { kind: 'skillMore', skills: ['hydra'], pct: 15, when: { targetLifeAbovePct: 75 } },
    { kind: 'skillMore', skills: ['black_hole'], pct: 40, when: { targetState: 'inBlackHole' } },
    { kind: 'skillMore', skills: ['frost_nova'], pct: 50, when: { inOwnGround: true } },
  ] }]);
  const p = { ctx: { powers }, summons: [], buffs: [{ id: 'fx_stack', ms: 1000, st: 7 }], moving: true, inOwnGround: false, x: 0, y: 0, hp: 1, mhp: 1 } as unknown as Player;
  const mut = p as unknown as { moving: boolean; inOwnGround: boolean };
  assert.equal(ownMultiplier(p, 'meteor'), 1.3 * (1 + 0.06 * 5), 'rolled 30% more and 5 capped stacks; moving');
  mut.moving = false;
  assert.equal(ownMultiplier(p, 'meteor'), 1.3 * (1 + 0.06 * 5) * 1.2);
  assert.equal(powers.watchGround, true);
  assert.equal(ownMultiplier(p, 'frost_nova'), 1); mut.inOwnGround = true; assert.equal(ownMultiplier(p, 'frost_nova'), 1.5);
  const mob = (o: Record<string, unknown>) => ({ stunMs: 0, freezeMs: 0, chillMs: 0, inHoleMs: 0, dots: [], x: 0, y: 0, hp: 100, mhp: 100, ...o }) as unknown as Mob;
  assert.equal(vulnTermsFactor(p, mob({ freezeMs: 10 }), 'meteor'), 1.25, 'immobilised = frozen or stunned');
  assert.equal(vulnTermsFactor(p, mob({}), 'meteor'), 1);
  assert.equal(vulnTermsFactor(p, mob({ x: 400, hp: 80 }), 'hydra'), 1.1 * 1.15);
  assert.equal(vulnTermsFactor(p, mob({ x: 100, hp: 70 }), 'hydra'), 1);
  assert.equal(vulnTermsFactor(p, mob({ inHoleMs: 150 }), 'black_hole'), 1.4);
});

test('tag queries resolve once per character (equipped runes re-derive the element) for skills, sets and conditions', () => {
  assert.deepEqual([...skillTags(SKILLS.cleave)].sort(), ['area', 'melee', 'physical', 'primary', 'strike'], 'v1 melee implies v2 strike');
  assert(skillTags(SKILLS.cleave, 'gathering_storm').has('lightning') && !skillTags(SKILLS.cleave, 'gathering_storm').has('physical'));
  assert(skillTags(SKILLS.whirlwind, 'dust_devils').has('summon'), 'rune tags join while equipped');
  assert(matchesTags(skillTags(SKILLS.multishot), { allOf: ['projectile', 'area'], noneOf: ['melee'] }));
  const effects: PowerEffect[] = [
    { kind: 'skillMore', tags: { anyOf: ['lightning'] }, pct: 30 },
    { kind: 'skillMods', tags: { allOf: ['melee', 'area'] }, mods: { radius: 10 } },
    { kind: 'conditional', when: { channeling: { anyOf: ['channel'] } }, bucket: 'own', pct: 20, tags: { anyOf: ['area'] } },
  ];
  const plain = buildPowerRuntime([{ kind: 'set', id: 'fx', roll: 1, effects }], tagIndexFor('warrior', {}));
  const storm = buildPowerRuntime([{ kind: 'set', id: 'fx', roll: 1, effects }], tagIndexFor('warrior', { cleave: 'gathering_storm' }));
  assert.equal(plain.ownStatic.get('cleave'), undefined);
  assert.equal(storm.ownStatic.get('cleave'), 1.3, 'Gathering Storm makes Cleave a lightning skill');
  assert.deepEqual([...plain.mods.keys()].sort(), ['cleave', 'cleave_rupture', 'dust_devil', 'ground_stomp', 'rend', 'whirlwind'], 'melee+area skills and their sub-strikes');
  const p = { ctx: { powers: plain }, summons: [], buffs: [], channel: { skill: 'whirlwind' } } as unknown as Player;
  assert.equal(ownMultiplier(p, 'rend'), 1.2, 'channelling a [channel] skill; Rend is an area skill');
  assert.equal(ownMultiplier(p, 'battle_rage'), 1, 'not an area skill');
});

test('count cap: extra summons / projectiles from items and sets are capped per skill; other sources are not counted', () => {
  const rt = buildPowerRuntime([
    { kind: 'set', id: 'siegebreaker:2', roll: 1, effects: [{ kind: 'skillMods', skills: ['sentry'], mods: { maxSummons: 1, cooldown: -30 } }] },
    { kind: 'legendary', id: 'sappers_pack', roll: 35, effects: LEGENDARIES.sappers_pack.effects },
    { kind: 'legendary', id: 'fx_more', roll: 1, effects: [{ kind: 'skillMods', skills: ['sentry', 'multishot'], mods: { maxSummons: 2, projectiles: 5 } }] },
    { kind: 'node', id: 'sentry:fx', roll: 1, effects: [{ kind: 'skillMods', skills: ['sentry'], mods: { maxSummons: 1 } }] },
  ]);
  assert.equal(rt.mods.get('sentry')?.maxSummons, ITEM_COUNT_CAP.maxSummons + 1, 'items capped at the constant, node on top');
  assert.equal(rt.mods.get('sentry')?.cooldown, -30);
  assert.equal(rt.mods.get('multishot')?.projectiles, ITEM_COUNT_CAP.projectiles);
  assert.deepEqual(ITEM_COUNT_CAP, { maxSummons: 3, projectiles: 2 }, 'non-binding for shipped items (largest today: 3 / 2)');
});

test('per-legendary stat while no set bonus is active (Patchwork Signet pattern) on the character sheet', () => {
  const fx = { id: 'fx_patchwork', classId: 'warrior' as const, name: 'Placeholder Patchwork', unlock: 10, note: 'x',
    effects: [{ kind: 'stat' as const, stat: 'dmgPct' as const, value: 2, perLegendary: { max: 3 }, noSetBonus: true }] };
  PASSIVES.push(fx);
  try {
    const save = createCharacter('Patchwork', 'warrior', 4); save.level = 70; save.equipment = {};
    assert.equal(setPassive(save, 0, fx.id), null);
    const rng = new Rng(5), leg = (id: string) => generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'legendary', legendary: id });
    assert.equal(computeStats(save).dmgPct, 0);
    save.equipment.mainhand = leg('bloodwake'); save.equipment.waist = leg('eternal_gyre');
    assert.equal(computeStats(save).dmgPct, 4);
    save.equipment.wrists = leg('anvil_vambraces'); save.equipment.offhand = leg('last_light');
    assert.equal(computeStats(save).dmgPct, 6, 'max 3 legendaries');
    save.equipment.head = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'set', set: 'endless_storm', base: 'head_horned' });
    save.equipment.shoulders = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'set', set: 'endless_storm', base: 'shoulders_spiked' });
    assert.equal(computeStats(save).sets.endless_storm, 2);
    assert.equal(computeStats(save).dmgPct, 0, 'a set bonus is active');
  } finally { PASSIVES.splice(PASSIVES.indexOf(fx), 1); }
});
