// Mage wave (docs/rework/depth/MAGE.md, bible v2): data rules (tags, names, runes, trees) and the server behaviour of the
// M1 skills, the new runes and nodes, passives, sets and legendaries; plus the narrow engine additions the wave made
// (projectile hooks, "less" multipliers, generic-bucket element stacks, longer chills).
// Targets are stationary "posts" (a non-dummy copy of the training dummy: they take damage and can be frozen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { LEGENDARIES, SETS } from '../../shared/src/data/items';
import { SKILLS, skillTags, skillsForClass, type NodeDef, type SkillTag } from '../../shared/src/data/skills';
import { ZONES } from '../../shared/src/data/zones';
import { computeStats } from '../../shared/src/stats';
import { treeTotalRanks } from '../../shared/src/specialization';
import { validateContent, CONTENT_DATA } from '../../shared/src/contentValidation';
import { PASSIVES, setPassive } from '../../shared/src/passives';
import type { CharacterSave, DerivedStats } from '../../shared/src/types';
import type { PlayerLink } from '../src/contracts';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { ownMultiplier } from '../src/sim/powerRuntime';
import { chillMob, getBuff } from '../src/sim/effects';
import { spawnProj } from '../src/sim/projectiles';
import { castPrimary, castSkill, startChannel } from '../src/sim/skills';
import { spreadRime } from '../src/sim/skills/mageM1';
import type { Mob, Player } from '../src/sim/types';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

const POST = { ...DUMMY_DEF, id: 'mage_test_post', name: 'Post', hp: 40 };

interface Fx { inst: Instance; p: Player; save: CharacterSave; posts: Mob[]; tick: (n?: number) => void; events: Record<string, number>; setPowers: (powers: Record<string, number>, sets?: Record<string, number>) => void }

function fixture(opts: { primary?: string; slots?: (string | null)[]; runes?: Record<string, string>; nodes?: Record<string, Record<string, number>>; passives?: string[]; posts?: [number, number, number?][]; level?: number } = {}): Fx {
  const save = createCharacter('MageWave', 'mage', 61);
  save.level = opts.level ?? 70;
  save.skills.slots = opts.slots ?? [null, null, null, null];
  save.skills.autoCast = ['paused', 'paused', 'paused', 'paused'];
  if (opts.primary) save.skills.primary = opts.primary;
  save.skills.runes = { ...(opts.runes ?? {}) };
  save.skills.nodes = structuredClone(opts.nodes ?? {});
  opts.passives?.forEach((id, i) => assert.equal(setPassive(save, i, id), null, id));
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'mage', channel: 1, seed: 73, theme: ZONES.whispering_glade.theme });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeMob(m);
  inst.addPlayer(link);
  const p = inst.players[0];
  p.debugInfiniteHp = true; p.res = p.mres; p.atkCdMs = 1e9;
  const posts = (opts.posts ?? [[160, 0]]).map(([dx, dy, tier]) => createMob(inst, POST, 70, p.x + dx, p.y + dy, { tier: (tier ?? 0) as 0 }));
  for (const m of posts) { m.hp = m.mhp = 1e12; }
  const events: Record<string, number> = {};
  const emit = inst.emit.bind(inst);
  inst.emit = ((ev: { e: string; v?: string; sk?: string }, x: number, y: number, s: number) => {
    const k = `${ev.e}:${ev.v ?? ev.sk ?? ''}`;
    events[k] = (events[k] ?? 0) + 1;
    return emit(ev as Parameters<typeof emit>[0], x, y, s);
  }) as typeof inst.emit;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { p.atkCdMs = 1e9; inst.tick(); } };
  const setPowers = (powers: Record<string, number>, sets: Record<string, number> = {}) => {
    const base = computeStats(save);
    const d: DerivedStats = { ...base, powers, sets, chc: 0, weaponMin: 1000, weaponMax: 1000 };
    p.ctx = buildCtx(save, d);
  };
  setPowers({});
  return { inst, p, save, posts, tick, events, setPowers };
}
const dealt = (m: Mob) => m.mhp - m.hp;
const slot = (f: Fx, id: string) => f.p.ctx.slotted(id)!;

// ─────────────────────────── Data ───────────────────────────

test('mage data: bible v2 tags (ITEMS-SHARED §1.2), NAMES.md renames, categories, unlocks, rune levels, trees', () => {
  assert.deepEqual(validateContent(), []);
  const want: Record<string, SkillTag[]> = {
    magic_missile: ['primary', 'projectile', 'arcane'], rime_needles: ['primary', 'projectile', 'chill', 'cold'],
    meteor: ['spender', 'aerial', 'area', 'ground', 'burn', 'fire'], stormglass_orb: ['spender', 'projectile', 'area', 'lightning'],
    thrumming_ray: ['channel', 'spender', 'piercing', 'arcane'], black_hole: ['cooldown', 'area', 'ground', 'displace', 'arcane'],
    frost_nova: ['cooldown', 'area', 'chill', 'cold'], rimefield: ['cooldown', 'area', 'ground', 'chill', 'cold'],
    hydra: ['summon', 'projectile', 'fire'], cinderkin: ['summon', 'area', 'burn', 'fire'], magic_weapon: ['buff', 'arcane'], orrery: ['cooldown', 'summon', 'area', 'arcane'],
  };
  for (const [id, tags] of Object.entries(want)) assert.deepEqual([...skillTags(SKILLS[id])].sort(), [...tags].sort(), id);
  for (const [skill, rune, tag] of [['magic_missile', 'glacial_spike', 'chill'], ['magic_missile', 'static_thread', 'piercing'], ['meteor', 'comet', 'chill'], ['meteor', 'lodestone', 'displace'],
    ['black_hole', 'absolute_zero', 'chill'], ['hydra', 'frost_hydra', 'chill'], ['hydra', 'forked_tongues', 'piercing'], ['magic_weapon', 'ignite', 'burn'], ['magic_weapon', 'chilling_edge', 'chill'],
    ['rime_needles', 'arcane_thorns', 'piercing'], ['thrumming_ray', 'frostline', 'chill'], ['thrumming_ray', 'searing_thread', 'burn'], ['cinderkin', 'frostkin', 'chill'],
    ['cinderkin', 'lanternkin', 'projectile'], ['stormglass_orb', 'hailglass', 'chill'], ['orrery', 'comet_ring', 'aerial'], ['orrery', 'frozen_moons', 'chill']] as const)
    assert(skillTags(SKILLS[skill], rune).has(tag), `${skill}/${rune} +${tag}`);
  for (const [skill, rune, tag] of [['meteor', 'comet', 'burn'], ['rime_needles', 'arcane_thorns', 'chill'], ['cinderkin', 'frostkin', 'burn'], ['rimefield', 'static_frost', 'chill']] as const)
    assert(!skillTags(SKILLS[skill], rune).has(tag), `${skill}/${rune} −${tag}`);
  const rune = (s: string, r: string) => SKILLS[s].runes.find((x) => x.id === r)!.name;
  assert.deepEqual([rune('magic_missile', 'glacial_spike'), rune('meteor', 'star_pact'), rune('black_hole', 'spellsteal'), rune('frost_nova', 'bone_chill'), rune('hydra', 'arcane_hydra'),
    rune('hydra', 'frost_hydra'), rune('hydra', 'mammoth_hydra'), rune('magic_weapon', 'force_weapon')],
  ['Frost Spike', 'Heavy Sky', 'Starve the Light', 'Marrow Cold', 'Arcane Spit', 'Frost Spit', 'Elder Hydra', 'Deep Glyph']);
  assert(!/pairs perfectly/i.test(SKILLS.black_hole.desc), 'no recommended combination in skill text');
  const list = skillsForClass('mage');
  assert.deepEqual(list.map((s) => s.unlock), [1, 2, 4, 6, 9, 12, 16, 20, 26, 32, 40, 50]);
  assert.deepEqual(new Set(list.map((s) => s.category)), new Set(['Bolts', 'Celestial', 'Void and Storm', 'Frost', 'Conjuring']));
  for (const s of list) {
    const offsets = s.runes.map((r) => r.unlock - s.unlock);
    if (s.unlock <= 12) assert.deepEqual(offsets.slice(3), [14, 20], `${s.id} bible runes at +14 / +20`);
    else assert.deepEqual(offsets, [2, 5, 9, 14, 20].map((o) => Math.min(70, s.unlock + o) - s.unlock), `${s.id} runes at +2/5/9/14/20`);
    assert.equal(s.runes.length, 5);
    const nodes: NodeDef[] = s.nodes ?? [];
    assert(nodes.length >= 4, `${s.id} tree`);
    for (const n of nodes) {
      if (n.pos.row === 0) assert.equal(n.requires, undefined, `${s.id}.${n.id} open`);
      else { const above = nodes.find((x) => x.pos.col === n.pos.col && x.pos.row === 0)!; assert.deepEqual(n.requires, [{ node: above.id, rank: 2 }], `${s.id}.${n.id}`); }
    }
    assert(treeTotalRanks(s) >= 12, `${s.id} ${treeTotalRanks(s)} ranks`);
  }
  // Phase 2 (engine wave 3 slows and dashEnd): every tree has its six bible nodes, all 34 mage legendaries ship.
  for (const s of list) assert.equal(s.nodes!.length, 6, `${s.id} six nodes`);
  assert.equal(PASSIVES.filter((p) => p.classId === 'mage').length, 14);
  assert.equal(Object.values(LEGENDARIES).filter((l) => l.classes?.includes('mage')).length, 34);
  assert.equal(Object.values(SETS).filter((s) => s.classId === 'mage').length, 5);
  assert.deepEqual(SETS.hollowstar_choir.pieces.map((p) => p.base), ['head_circlet', 'shoulders_mantle', 'chest_robe', 'hands_wraps', 'waist_sash', 'wrists_bracers']);
});

test('no shipped mage text names a build (ITEMS-SHARED §0 rule 1)', () => {
  const labels = /\b(starfall build|hoarfrost build|hollowstar build|glass concord build|lantern garden build|build|meta)\b/i;
  const texts = [
    ...skillsForClass('mage').flatMap((s) => [s.desc, ...s.runes.map((r) => r.desc), ...(s.nodes ?? []).map((n) => n.text), ...s.tiers.map((t) => t.desc)]),
    ...Object.values(LEGENDARIES).filter((l) => l.classes?.includes('mage')).flatMap((l) => [l.name, l.power, l.flavor]),
    ...Object.values(SETS).filter((s) => s.classId === 'mage').flatMap((s) => [s.name, ...s.bonuses.map((b) => b.text), ...s.pieces.map((p) => p.name)]),
    ...PASSIVES.filter((p) => p.classId === 'mage').flatMap((p) => [p.name, p.text ?? '', p.note]),
  ];
  for (const t of texts) assert(!labels.test(t), t);
});

// ─────────────────────────── Engine additions ───────────────────────────

test('engine: projectile hooks replace the hit rule, tick each update and end once (a bounce carries the hook on)', () => {
  const f = fixture({ posts: [[200, 0]] });
  try {
    let hits = 0, ticks = 0, ends: string[] = [];
    const st = { skill: 'magic_missile', coef: 1, el: 'arcane' as const, pct: 0 };
    spawnProj(f.inst, { kind: 'missile', v: 'missile', owner: f.p, src: f.p.id, x: f.p.x, y: f.p.y, angle: 0, speed: 800, lifeMs: 800, r: 12, el: 'arcane', strike: st,
      hook: { hit: () => { hits++; }, tick: () => { ticks++; }, end: (_i, _p, why) => { ends.push(why); } } });
    f.tick(20);
    assert(hits > 0, 'the hook saw the hit (the projectile passes through: the hook did not end it)');
    assert(ticks > 3); assert.deepEqual(ends, ['life'], 'ended once, at the end of its life');
  } finally { f.inst.destroy(); }
});

test('engine: "less" multipliers (Conjurer’s Hearth), generic-bucket element stacks (Fallen Star 4), longer chills (Chill Margin)', () => {
  const f = fixture({ slots: ['hydra', 'meteor', null, null], passives: ['mage_conjurers_hearth'] });
  try {
    f.setPowers({});
    assert.equal(ownMultiplier(f.p, 'meteor'), 0.9, 'non-Summon skills deal 10% less');
    assert.equal(ownMultiplier(f.p, 'hydra'), 1);
    assert.equal(f.p.ctx.modsOf('hydra').mods.maxSummons, 1);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['meteor', null, null, null] });
  try {
    g.setPowers({}, { fallen_star: 4 });
    assert.equal(g.p.ctx.powers.hitTerms.length, 0, 'no per-hit multiplier any more');
    g.p.lastEle.fire = g.inst.t; g.p.lastEle.cold = g.inst.t;
    g.tick();
    assert.equal(getBuff(g.p, 'fallen_star')?.st, 2);
    assert.equal(g.p.live.dmg, 10, '+5 % per element in the generic bucket');
  } finally { g.inst.destroy(); }
  const h = fixture({ passives: ['mage_chill_margin'], posts: [[60, 0]] });
  try {
    chillMob(h.posts[0], 1000, h.inst, h.p);
    assert.equal(h.posts[0].chillMs, 1250, 'your Chills last 25% longer');
  } finally { h.inst.destroy(); }
});

// ─────────────────────────── M7 Rime Needles ───────────────────────────

test('Rime Needles: three chilling needles; six within 2 s freeze; Deep Chill four; Arcane Thorns pierce without chill; Icicle Fan and Glacier Spine', () => {
  const f = fixture({ primary: 'rime_needles', posts: [[120, 0]] });
  try {
    const m = f.posts[0];
    castPrimary(f.inst, f.p, m); f.tick(6);
    assert.equal(f.events['proj:needle'], 3);
    assert(m.chillMs > 0, 'chilled'); assert.equal(m.freezeMs, 0);
    castPrimary(f.inst, f.p, m); f.tick(6);
    assert(m.freezeMs > 0, 'six needles in two seconds freeze');
  } finally { f.inst.destroy(); }
  const g = fixture({ primary: 'rime_needles', runes: { rime_needles: 'deep_chill' }, posts: [[120, 0]] });
  try { castPrimary(g.inst, g.p, g.posts[0]); g.tick(6); castPrimary(g.inst, g.p, g.posts[0]); g.tick(3); assert(g.posts[0].freezeMs > 0, 'four needles freeze'); } finally { g.inst.destroy(); }
  const h = fixture({ primary: 'rime_needles', runes: { rime_needles: 'arcane_thorns' }, posts: [[100, 0], [160, 0]] });
  try {
    castPrimary(h.inst, h.p, h.posts[0]); h.tick(8);
    assert(dealt(h.posts[1]) > 0, 'pierces to the enemy behind'); assert.equal(h.posts[0].chillMs, 0, 'no chill');
  } finally { h.inst.destroy(); }
  const k = fixture({ primary: 'rime_needles', runes: { rime_needles: 'icicle_fan' } });
  try { castPrimary(k.inst, k.p, k.posts[0]); assert.equal(k.events['proj:needle'], 5); } finally { k.inst.destroy(); }
  const s = fixture({ primary: 'rime_needles', runes: { rime_needles: 'glacier_spine' }, posts: [[100, 0], [150, 0], [200, 0]] });
  try { castPrimary(s.inst, s.p, s.posts[0]); s.tick(10); assert.equal(s.events['proj:needle_spine'], 1); assert(s.posts.every((m) => dealt(m) > 0), 'pierces every enemy'); } finally { s.inst.destroy(); }
});

// ─────────────────────────── M8 Thrumming Ray ───────────────────────────

test('Thrumming Ray: pierces a line, ramps from 1× to 2.5× over 2 s; Steady Note tops out at 2×; Forked Signal two beams', () => {
  const run = (runes: Record<string, string> = {}, posts: [number, number][] = [[120, 0], [240, 0], [120, 140]]) => {
    const f = fixture({ slots: ['thrumming_ray', null, null, null], runes, posts });
    try {
      startChannel(f.inst, f.p, slot(f, 'thrumming_ray'), true);
      const per: number[] = [];
      let last = f.posts[0].hp;
      for (let i = 0; i < 60; i++) { f.p.res = f.p.mres; f.tick(); if (i % 5 === 4) { per.push(last - f.posts[0].hp); last = f.posts[0].hp; } }
      return { per, far: f.posts[1] ? dealt(f.posts[1]) : 0, off: f.posts[2] ? dealt(f.posts[2]) : 0, rays: f.events['aoe:ray'] ?? 0 };
    } finally { f.inst.destroy(); }
  };
  const plain = run();
  assert(plain.far > 0, 'the beam pierces to the enemy behind'); assert.equal(plain.off, 0, 'not the enemy off the line');
  // Strikes every 250 ms; per[1] is the strike at 0.5 s (ramp 1 + 1.5 × 0.25 = 1.375), the tail is at full 2.5×.
  const early = plain.per[1], late = plain.per[plain.per.length - 1];
  assert(Math.abs(late / early - 2.5 / 1.375) < 0.05, `ramp ${early} → ${late}`);
  for (let i = 2; i < plain.per.length; i++) assert(plain.per[i] >= plain.per[i - 1], 'never falls while held');
  const steady = run({ thrumming_ray: 'steady_note' });
  const r2 = steady.per[steady.per.length - 1] / steady.per[1];
  assert(Math.abs(r2 - 2 / 1.25) < 0.05, `Steady Note tops out at 2× (${r2})`);
  const fork = run({ thrumming_ray: 'forked_signal' }, [[120, 0]]);
  assert(fork.rays >= 2 * 11, `two beams per tick (${fork.rays})`);
});

// ─────────────────────────── M9 Cinderkin ───────────────────────────

test('Cinderkin: one cast coaxes three kin that claw and burst when their time ends; Bonfire Kin is one big kin; Eager Kin bursts on its first hit', () => {
  const f = fixture({ slots: ['cinderkin', null, null, null], posts: [[90, 0], [110, 20]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'cinderkin')));
    assert.equal(f.p.summons.filter((s) => s.type === 'cinderkin').length, 3);
    f.tick(40);
    assert(dealt(f.posts[0]) > 0, 'the kin claw');
    for (const s of f.p.summons) s.lifeMs = 1;
    f.tick(3);
    assert(f.events['aoe:kin_burst'] >= 3, `three bursts (${f.events['aoe:kin_burst']})`);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['cinderkin', null, null, null], runes: { cinderkin: 'bonfire_kin' } });
  try { assert(castSkill(g.inst, g.p, slot(g, 'cinderkin'))); assert.equal(g.p.summons.length, 1); assert(g.p.summons[0].big); } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['cinderkin', null, null, null], runes: { cinderkin: 'eager_kin' }, posts: [[70, 0]] });
  try {
    assert(castSkill(h.inst, h.p, slot(h, 'cinderkin')));
    h.tick(40);
    assert((h.events['aoe:kin_burst'] ?? 0) >= 1, 'burst on the first hit');
  } finally { h.inst.destroy(); }
});

// ─────────────────────────── M10 Rimefield ───────────────────────────

test('Rimefield: chills inside and freezes an enemy that stays 1.5 s; Cistern Staff after 0.75 s; Static Frost zaps instead of freezing', () => {
  const run = (powers: Record<string, number>, runes: Record<string, string> = {}) => {
    const f = fixture({ slots: ['rimefield', null, null, null], runes, posts: [[150, 0], [170, 30], [130, -30], [160, 50]] });
    try {
      f.setPowers(powers);
      assert(castSkill(f.inst, f.p, slot(f, 'rimefield')));
      const m = f.posts[0];
      let frozeAt = -1;
      for (let i = 0; i < 60 && frozeAt < 0; i++) { f.tick(); if (m.freezeMs > 0) frozeAt = i; }
      return { frozeAt, chill: m.chillMs, dealt: dealt(m), arcs: f.events['beam:arc'] ?? 0 };
    } finally { f.inst.destroy(); }
  };
  const plain = run({});
  assert(plain.frozeAt >= 28 && plain.frozeAt <= 36, `freezes after about 1.5 s (tick ${plain.frozeAt})`);
  assert(plain.dealt > 0);
  const quick = run({ cistern_staff: 175 });
  assert(quick.frozeAt >= 13 && quick.frozeAt <= 20, `Cistern Staff: about 0.75 s (tick ${quick.frozeAt})`);
  const stat = run({}, { rimefield: 'static_frost' });
  assert.equal(stat.frozeAt, -1, 'no freeze'); assert(stat.arcs > 0, 'zaps');
});

// ─────────────────────────── M11 Stormglass Orb ───────────────────────────

test('Stormglass Orb: zaps up to three nearby enemies every quarter second and shatters at the end; Prism Burst fires missiles', () => {
  const f = fixture({ slots: ['stormglass_orb', null, null, null], posts: [[200, 0], [220, 60], [220, -60], [240, 100]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'stormglass_orb')));
    f.tick(10);
    const zaps = f.events['beam:zap'] ?? 0;
    assert(zaps >= 3 && zaps % 3 === 0, `three targets per zap tick (${zaps})`);
    f.tick(50);
    assert.equal(f.events['aoe:glass_burst'], 1, 'shatters once');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['stormglass_orb', null, null, null], runes: { stormglass_orb: 'prism_burst' }, posts: [[200, 0], [260, 60]] });
  try { assert(castSkill(g.inst, g.p, slot(g, 'stormglass_orb'))); g.tick(60); assert(g.events['proj:missile'] >= 1, 'missiles from the shatter'); } finally { g.inst.destroy(); }
});

// ─────────────────────────── M12 Orrery ───────────────────────────

test('Orrery: five spheres orbit you and strike enemies they pass, and fire your Magic Missile; Armillary Staff adds two spheres', () => {
  const f = fixture({ slots: ['orrery', null, null, null], posts: [[130, 0], [-130, 0], [0, 130], [0, -130], [92, 92], [-92, -92]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'orrery')));
    f.tick(60);
    assert(f.posts.filter((m) => dealt(m) > 0).length >= 5, 'the spheres pass the enemies around you');
    assert(f.events['proj:missile'] >= 5, `sphere missiles (${f.events['proj:missile']})`);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['orrery', null, null, null] });
  try {
    g.setPowers({ armillary_staff: 175 });
    let n = 0;
    const emit = g.inst.emit.bind(g.inst);
    g.inst.emit = ((ev: { e: string; v?: string; n?: number }, x: number, y: number, s: number) => { if (ev.v === 'orrery') n = ev.n ?? 0; return emit(ev as Parameters<typeof emit>[0], x, y, s); }) as typeof g.inst.emit;
    assert(castSkill(g.inst, g.p, slot(g, 'orrery')));
    assert.equal(n, 7);
  } finally { g.inst.destroy(); }
});

// ─────────────────────────── Existing skills: new runes and nodes ───────────────────────────

test('existing skills: Volley of Glass shards, Static Thread chains, Fallen Star 2 at 60%, Collapse Bloom bolts, Cold Front, Mirror Frost, Arcane Ward', () => {
  const f = fixture({ runes: { magic_missile: 'volley_of_glass' }, posts: [[150, 0]] });
  try { castPrimary(f.inst, f.p, f.posts[0]); f.tick(8); assert.equal(f.events['proj:shard'], 3); } finally { f.inst.destroy(); }
  const g = fixture({ runes: { magic_missile: 'static_thread' }, posts: [[150, 0], [220, 40]] });
  try { castPrimary(g.inst, g.p, g.posts[0]); g.tick(8); assert(dealt(g.posts[1]) > 0 && g.events['beam:arc'] >= 1, 'chains'); } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['meteor', null, null, null], posts: [[200, 0], [200, 120]] });
  try {
    h.setPowers({}, { fallen_star: 2 });
    assert(castSkill(h.inst, h.p, slot(h, 'meteor')));
    assert.equal(h.events['tele:meteor'], 2, 'Aerial skills strike a second time');
  } finally { h.inst.destroy(); }
  const k = fixture({ slots: ['black_hole', null, null, null], runes: { black_hole: 'collapse_bloom' } });
  try { assert(castSkill(k.inst, k.p, slot(k, 'black_hole'))); k.tick(50); assert.equal(k.events['proj:missile'], 8, 'a ring of 8 bolts'); } finally { k.inst.destroy(); }
  const n = fixture({ slots: ['frost_nova', null, null, null], runes: { frost_nova: 'cold_front' }, posts: [[200, 0]] });
  try { assert(castSkill(n.inst, n.p, slot(n, 'frost_nova'))); assert.equal(n.events['aoe:nova_cone'], 1); assert(n.posts[0].freezeMs > 0, 'reaches 300 units'); } finally { n.inst.destroy(); }
  const m = fixture({ slots: ['frost_nova', null, null, null], runes: { frost_nova: 'mirror_frost' }, posts: [[60, 0]] });
  try { assert(castSkill(m.inst, m.p, slot(m, 'frost_nova'))); m.tick(35); assert.equal(m.events['aoe:nova'], 2, 'a second nova 1.5 s later'); } finally { m.inst.destroy(); }
  const w = fixture({ slots: ['magic_weapon', null, null, null], runes: { magic_weapon: 'arcane_ward' } });
  try {
    assert(castSkill(w.inst, w.p, slot(w, 'magic_weapon')));
    assert.equal(getBuff(w.p, 'magic_weapon')?.dmg, 5, 'the bonus is halved');
    assert(w.p.ctx.powers.defense?.takenTerms.some((t) => t.pct === -15), '15% less damage taken while active');
  } finally { w.inst.destroy(); }
});

test('nodes: Overflow, Arcane Fuel, Siphoning Void, Cold Return, Kin Tithe and Frozen Power read their ranks', () => {
  const f = fixture({ nodes: { magic_missile: { echo_cast: 2, overflow: 3 } }, posts: [[150, 0]] });
  try {
    f.setPowers({});
    f.p.res = f.p.mres; castPrimary(f.inst, f.p, f.posts[0]); f.tick(8);
    const full = dealt(f.posts[0]); f.posts[0].hp = f.posts[0].mhp;
    f.p.res = 0; castPrimary(f.inst, f.p, f.posts[0]); f.tick(8);
    const empty = dealt(f.posts[0]);
    assert(full / empty > 1.3 && full / empty < 1.6, `Overflow +45% at full Arcane Power (${full} / ${empty})`);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['black_hole', null, null, null], nodes: { black_hole: { siphoning_void: 3 } }, posts: [[200, 0], [210, 30], [190, -30], [220, 10]] });
  try { g.p.res = 0; assert(castSkill(g.inst, g.p, slot(g, 'black_hole'))); assert.equal(g.p.res, 12, '3 per enemy caught (4)'); } finally { g.inst.destroy(); }
});

// ─────────────────────────── Passives ───────────────────────────

test('passives: Astral Debt lets Spenders go into debt; Missile Choir adds missiles per 25 Arcane Power; Unbroken Ward is a first-hit template', () => {
  const f = fixture({ slots: ['meteor', null, null, null], passives: ['mage_astral_debt'], posts: [[200, 0]] });
  try {
    f.setPowers({});
    f.p.res = 10;
    f.p.manualCast = { slot: 0, skill: 'meteor' };
    f.tick();
    assert(f.p.res < 0, `in debt (${f.p.res})`);
  } finally { f.inst.destroy(); }
  const g = fixture({ passives: ['mage_missile_choir'], posts: [[150, 0]] });
  try { g.setPowers({}); g.p.res = 80; castPrimary(g.inst, g.p, g.posts[0]); assert.equal(g.events['proj:missile'], 1 + 3, 'three more at 80 Arcane Power'); } finally { g.inst.destroy(); }
  assert.deepEqual(PASSIVES.find((p) => p.id === 'mage_unbroken_ward')!.effects, [{ kind: 'firstHit', pct: -60, windowMs: 8000, resetOnStatus: ['freeze'] }]);
});

// ─────────────────────────── Sets and legendaries ───────────────────────────

test('sets: Glass Concord 2 adds a projectile (count cap 2 with the Spindle), Lantern Garden 2 a summon, Hoarfrost 4 frozen +20 %, Hollowstar 6 at full power', () => {
  const f = fixture({ slots: ['hydra', 'thrumming_ray', null, null] });
  try {
    f.setPowers({ thousand_missiles: 125 }, { glass_concord: 2 });
    assert.equal(f.p.ctx.modsOf('magic_missile').mods.projectiles, 2, 'item and set projectiles capped at +2 (Spindle +2 already)');
    assert.equal(f.p.ctx.modsOf('rime_needles').mods.projectiles, 1);
    f.setPowers({}, { lantern_garden: 2 });
    assert.equal(f.p.ctx.modsOf('hydra').mods.maxSummons, 1);
    f.setPowers({}, { hoarfrost_vigil: 4 });
    assert.equal(f.p.ctx.frozenMult, 1.2);
    f.setPowers({}, { hollowstar_choir: 6 });
    assert(Math.abs(ownMultiplier(f.p, 'thrumming_ray') - 1.15) < 1e-9, 'the 4-piece: Channel skills 15% more');
    f.p.buffs.push({ id: 'full_resonance', ms: 300 });
    assert(Math.abs(ownMultiplier(f.p, 'thrumming_ray') - 1.15 * 1.35) < 1e-9, '×1.35 at full channel power');
  } finally { f.inst.destroy(); }
});

test('legendaries: Snowglobe Pendant bursts on a freeze (once per 6 s); Winterbound Robe and Hornlistener Circlet are per-hit terms', () => {
  const f = fixture({ slots: ['frost_nova', null, null, null], posts: [[60, 0], [120, 30]] });
  try {
    f.setPowers({ snowglobe_pendant: 70 });
    assert(castSkill(f.inst, f.p, slot(f, 'frost_nova')));
    assert.equal(f.events['aoe:nova'], 2, 'the nova and one burst (internal cooldown)');
  } finally { f.inst.destroy(); }
  const g = fixture({});
  try {
    g.setPowers({ winterbound_robe: 30, hornlistener_circlet: 30 });
    assert.equal(g.p.ctx.powers.vulnTerms.length, 2);
  } finally { g.inst.destroy(); }
});

// ─────────────────────────── Phase 2 (engine wave 3: slows of chosen strength, dashEnd) ───────────────────────────

const slowOf = (m: Mob) => (m.ps && m.ps.slowMs > 0 ? m.ps.slowPct : 0);
const moveFactor = (m: Mob) => (m.chillMs > 0 ? 0.6 : 1) * (1 - slowOf(m) / 100);

test('phase 2: Deep Chill chills 60 % and the Rimefield 50 % (chill + movement slow); the rim and Lingering Pull slow further', () => {
  const f = fixture({ primary: 'rime_needles', runes: { rime_needles: 'deep_chill' }, posts: [[120, 0]] });
  try {
    castPrimary(f.inst, f.p, f.posts[0]); f.tick(6);
    assert(f.posts[0].chillMs > 0); assert(Math.abs(moveFactor(f.posts[0]) - 0.4) < 1e-9, `Deep Chill: movement ${moveFactor(f.posts[0])}`);
  } finally { f.inst.destroy(); }
  // A Rimefield of radius 200 placed directly: the centre post moves at 50 %, the rim post (outer quarter) at 50 % × (1 − 50 %).
  const e = fixture({ slots: ['rimefield', null, null, null], nodes: { rimefield: { wide_frost: 2, cold_snap_edge: 3 } }, posts: [[200, 0], [380, 0]] });
  try {
    spreadRime(e.inst, e.p, slot(e, 'rimefield'), e.p.x + 200, e.p.y, 200, false);
    e.tick(6);
    assert(Math.abs(moveFactor(e.posts[0]) - 0.5) < 1e-9, `inner: ${moveFactor(e.posts[0])}`);
    assert(Math.abs(moveFactor(e.posts[1]) - 0.25) < 1e-9, `rim: ${moveFactor(e.posts[1])}`);
  } finally { e.inst.destroy(); }
  const b = fixture({ slots: ['black_hole', null, null, null], nodes: { black_hole: { event_rim: 2, lingering_pull: 3 } }, posts: [[160, 0], [170, 20]] });
  try {
    assert(castSkill(b.inst, b.p, slot(b, 'black_hole')));
    b.tick(Math.ceil(SKILLS.black_hole.duration * 20) + 4);
    assert.equal(slowOf(b.posts[0]), 50, 'Lingering Pull rank 3: 50 % for 2 s after the collapse');
  } finally { b.inst.destroy(); }
});

test('phase 2: Absolute Field (frozen enemies inside take more from Rimefield and Rime Needles), Tidal Lock and Clockwinding', () => {
  const run = (nodes: Record<string, number>) => {
    const f = fixture({ slots: ['rimefield', null, null, null], nodes: { rimefield: { wide_frost: 2, cold_snap_edge: 2, ...nodes } }, posts: [[160, 0]] });
    try {
      assert(castSkill(f.inst, f.p, slot(f, 'rimefield')));
      f.tick(80); // freezes after 1.5 s inside, keeps ticking
      return dealt(f.posts[0]);
    } finally { f.inst.destroy(); }
  };
  const base = run({}), abs = run({ absolute_field: 3 });
  assert(abs > base * 1.05, `Absolute Field rank 3 adds damage while frozen (${abs} vs ${base})`);
  const o = fixture({ slots: ['orrery', null, null, null], nodes: { orrery: { brass_spheres: 2, tidal_lock: 3, clockwinding: 3 } }, posts: [[SKILLS.orrery.radius, 0], [-SKILLS.orrery.radius, 0]] });
  try {
    assert(castSkill(o.inst, o.p, slot(o, 'orrery')));
    o.p.attackSeq++; // the Orrery's own cast (the brain counts it after the cast)
    let slowed = false;
    for (let i = 0; i < 60 && !slowed; i++) { o.tick(); slowed = o.posts.some((m) => slowOf(m) === 30); }
    assert(slowed, 'Tidal Lock rank 3: spheres slow 30 %');
    for (let i = 0; i < 4; i++) o.p.attackSeq++; // four spells cast while it turns: +0.5 s each
    o.tick();
    assert.equal(o.events['aoe:orrery_extend'], 1, 'one extension event');
    o.tick(Math.ceil(SKILLS.orrery.duration * 20) + 30); // past the base duration plus 1.5 s: still turning
    const before = dealt(o.posts[0]) + dealt(o.posts[1]);
    o.tick(10);
    assert(dealt(o.posts[0]) + dealt(o.posts[1]) > before, 'spheres still hit 2 s after the base duration');
  } finally { o.inst.destroy(); }
});

test('phase 2: Rimewalker Slippers drop a half-size copy of the most recent Ground effect when a dash ends (once per 8 s)', () => {
  const f = fixture({ slots: ['rimefield', null, null, null], posts: [[160, 0], [-60, 0]] });
  try {
    f.setPowers({ rimewalker_slippers: 30 });
    assert(castSkill(f.inst, f.p, slot(f, 'rimefield')));
    assert.equal(f.events['aoe:rimefield'], 1);
    const rime = () => f.inst.grounds.filter((g) => g.fx?.def.id === 'rime_ground' && g.endT > f.inst.t);
    const r0 = rime()[0].r;
    f.p.mv.dashMs = 100; f.tick(4);
    assert.equal(f.events['aoe:rimefield'], 2, 'a copy where the dash ended');
    const rs = rime().map((g) => g.r).sort((a, b) => a - b);
    assert.equal(rs.length, 2); assert(Math.abs(rs[0] - r0 * 0.5) < 1e-6, `half size (${rs[0]} vs ${r0})`);
    assert(getBuff(f.p, 'rimewalker'), 'the recharge marker');
    f.p.mv.dashMs = 100; f.tick(4);
    assert.equal(f.events['aoe:rimefield'], 2, 'internal cooldown: no second copy');
    assert(ownMultiplier(f.p, 'rimefield') > ownMultiplier(f.p, 'frost_nova'), 'Ground effects deal more damage');
  } finally { f.inst.destroy(); }
});

test('Stormglass Orb is paced by the attack rate: an AP-positive loop (Static Charge on elites, two orbs) cannot cast it every tick', () => {
  const f = fixture({ primary: 'magic_missile', slots: ['stormglass_orb', null, null, null], nodes: { stormglass_orb: { heavier_glass: 1, static_charge: 3 } }, posts: [[150, 0, 1], [160, 30, 1], [140, -30, 1], [170, 10, 1], [150, 50, 1]] });
  try {
    f.save.skills.autoCast = ['auto', 'paused', 'paused', 'paused'];
    f.setPowers({ stormglass_prism: 171 }, { glass_concord: 2 });
    f.p.res = f.p.mres;
    let casts = 0, maxOrbs = 0;
    const emit = f.inst.emit.bind(f.inst);
    f.inst.emit = ((ev: { e: string; sk?: string }, x: number, y: number, s: number) => { if (ev.e === 'cast' && ev.sk === 'stormglass_orb') casts++; return emit(ev as Parameters<typeof emit>[0], x, y, s); }) as typeof f.inst.emit;
    for (let i = 0; i < 200; i++) { f.inst.tick(); maxOrbs = Math.max(maxOrbs, f.inst.projs.filter((pr) => pr.v === 'stormglass' && !pr.dead).length); }
    const aps = f.p.ctx.d.aps * (1 + f.p.live.ias / 100);
    assert(casts <= Math.ceil(10 * aps) + 1, `at most one cast per attack interval (${casts} casts, aps ${aps.toFixed(2)})`);
  } finally { f.inst.destroy(); }
});
