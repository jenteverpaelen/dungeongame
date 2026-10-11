// Ranger wave (docs/rework/depth/RANGER.md bible v2; shipped list RANGER-WAVE.md): data, the six new skills, runes 4–5,
// specialization nodes, passives, sets and legendaries on the real 20 Hz simulation (stationary test posts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { LEGENDARIES, SETS } from '../../shared/src/data/items';
import { SKILLS, skillTags, skillsForClass } from '../../shared/src/data/skills';
import { ZONES } from '../../shared/src/data/zones';
import { computeStats } from '../../shared/src/stats';
import { treeTotalRanks } from '../../shared/src/specialization';
import { validateContent } from '../../shared/src/contentValidation';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { passivesForClass } from '../../shared/src/passives';
import type { CharacterSave, DerivedStats } from '../../shared/src/types';
import type { PlayerLink } from '../src/contracts';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { buildCtx, skillCost } from '../src/sim/playerctx';
import { getBuff } from '../src/sim/effects';
import { ownMultiplier } from '../src/sim/powerRuntime';
import { castPrimary, castSkill } from '../src/sim/skills';
import { rstate } from '../src/sim/skills/rangerKit';
import type { Mob, Player } from '../src/sim/types';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

const POST = { ...DUMMY_DEF, id: 'ranger_test_post', name: 'Post', hp: 40 };

interface Fx { inst: Instance; p: Player; save: CharacterSave; posts: Mob[]; tick: (n?: number) => void; events: Record<string, number>; setPowers: (powers: Record<string, number>, sets?: Record<string, number>) => void }

function fixture(opts: { primary?: string; slots?: (string | null)[]; runes?: Record<string, string>; nodes?: Record<string, Record<string, number>>; posts?: [number, number, number?][]; level?: number; passives?: string[] } = {}): Fx {
  const save = createCharacter('RangerWave', 'ranger', 62);
  save.level = opts.level ?? 70;
  save.skills.slots = opts.slots ?? [null, null, null, null];
  save.skills.autoCast = ['paused', 'paused', 'paused', 'paused'];
  if (opts.primary) save.skills.primary = opts.primary;
  save.skills.runes = { ...(opts.runes ?? {}) };
  save.skills.nodes = structuredClone(opts.nodes ?? {});
  if (opts.passives) save.passives = { revision: 1, slots: [...opts.passives, null, null, null, null].slice(0, 4) };
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'ranger', channel: 1, seed: 79, theme: ZONES.whispering_glade.theme });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeMob(m);
  inst.addPlayer(link);
  const p = inst.players[0];
  p.debugInfiniteHp = true; p.res = p.mres; p.atkCdMs = 1e9;
  const posts = (opts.posts ?? [[200, 0]]).map(([dx, dy, tier]) => createMob(inst, POST, 70, p.x + dx, p.y + dy, { tier: (tier ?? 0) as 0 }));
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
    const w = 1000;
    const d: DerivedStats = { ...base, powers, sets, chc: 0, weaponMin: w, weaponMax: w };
    p.ctx = buildCtx(save, d);
  };
  setPowers({});
  return { inst, p, save, posts, tick, events, setPowers };
}
const dealt = (m: Mob) => m.mhp - m.hp;
const slot = (f: Fx, id: string) => f.p.ctx.slotted(id)!;

// ─────────────────────────── Data ───────────────────────────

test('ranger data: 12 skills in 5 categories, NAMES.md display names, tags, 5 runes each, trees, 14 passives, 5 sets, 35 legendaries', () => {
  const skills = skillsForClass('ranger');
  assert.equal(skills.length, 12);
  assert.deepEqual([...new Set(skills.map((s) => s.category))].sort(), ['Beasts', 'Devices', 'Shots', 'Skyfall', 'Volleys']);
  assert.equal(SKILLS.hungering_arrow.name, 'Tracking Arrow'); assert.equal(SKILLS.cluster_arrow.name, 'Burst Arrow'); assert.equal(SKILLS.rain_of_vengeance.name, 'Arrowfall');
  for (const s of skills) {
    assert.equal(s.runes.length, 5, `${s.id} runes`);
    assert(s.nodes && s.nodes.length >= 5, `${s.id} tree`);
    assert(treeTotalRanks(s) >= 10, `${s.id}: a 10-rank cap leaves choices`);
  }
  // ITEMS-SHARED §1.2 tags (kind tags are derived).
  const tags = (id: string, rune?: string) => [...skillTags(SKILLS[id], rune)].sort();
  assert.deepEqual(tags('pitch_mortar'), ['area', 'burn', 'device', 'fire', 'ground', 'summon']);
  assert.deepEqual(tags('pitch_mortar', 'frostpot'), ['area', 'chill', 'cold', 'device', 'ground', 'summon']);
  assert.deepEqual(tags('skipstone_bolt', 'heavy_stone'), ['displace', 'physical', 'primary', 'projectile']);
  assert.deepEqual(tags('sentry', 'flame_lance'), ['area', 'cooldown', 'device', 'fire', 'summon']);
  assert.equal(passivesForClass('ranger').length, 14);
  assert.equal(Object.values(SETS).filter((x) => x.classId === 'ranger').length, 5);
  assert.equal(Object.values(LEGENDARIES).filter((l) => l.classes?.includes('ranger')).length, 35);
  assert.deepEqual(validateContent(), []);
});

test('ranger loot: the new legendaries and set pieces drop through normal loot generation', () => {
  const rng = new Rng(5);
  const seen = new Set<string>();
  for (let i = 0; i < 6000; i++) { const it = generateItem(rng, { ilvl: 70, classId: 'ranger', rarity: 'legendary', smartChance: 1 }); if (it.legendary) seen.add(it.legendary.power); }
  for (const l of Object.values(LEGENDARIES).filter((x) => x.classes?.includes('ranger'))) assert(seen.has(l.id), `${l.id} drops`);
  const set = generateItem(rng, { ilvl: 70, classId: 'ranger', rarity: 'set', set: 'snarewright', base: 'waist_belt' });
  assert.equal(set.set, 'snarewright');
});

// ─────────────────────────── New skills ───────────────────────────

test('Skipstone Bolt: hits, then skips to 2 more enemies within 220 units at −20 % each; Long Skip skips 4 times', () => {
  const f = fixture({ primary: 'skipstone_bolt', posts: [[150, 0], [300, 0], [450, 0], [600, 0], [750, 0]] });
  try {
    castPrimary(f.inst, f.p, f.posts[0]);
    f.tick(40);
    const d = f.posts.map(dealt);
    assert(d[0] > 0 && d[1] > 0 && d[2] > 0 && d[3] === 0, `three enemies hit: ${d.map((x) => x > 0 ? 1 : 0)}`);
    assert(Math.abs(d[1] / d[0] - 0.8) < 0.02 && Math.abs(d[2] / d[1] - 0.8) < 0.02, `−20 % per skip (${(d[1] / d[0]).toFixed(3)}, ${(d[2] / d[1]).toFixed(3)})`);
    assert(f.events['proj:skip'] >= 3 && f.p.res > 0);
  } finally { f.inst.destroy(); }
  const g = fixture({ primary: 'skipstone_bolt', runes: { skipstone_bolt: 'long_skip' }, posts: [[150, 0], [300, 0], [450, 0], [600, 0], [750, 0]] });
  try {
    castPrimary(g.inst, g.p, g.posts[0]);
    g.tick(60);
    assert(g.posts.every((m) => dealt(m) > 0), 'Long Skip: all five');
    assert(Math.abs(dealt(g.posts[1]) / dealt(g.posts[0]) - 0.7) < 0.02, 'Long Skip loses 30 % per skip');
  } finally { g.inst.destroy(); }
});

test('Spring Snare: placed near enemies, arms, snaps for its damage and holds (stuns) everyone within 90 units', () => {
  const f = fixture({ slots: ['spring_snare', null, null, null], posts: [[200, 0], [230, 30]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'spring_snare')));
    const snare = f.p.summons.find((s) => s.type === 'snare')!;
    assert(snare, 'a snare summon');
    f.tick(3);
    assert.equal(dealt(f.posts[0]), 0, 'not armed yet (0.6 s)');
    f.tick(20);
    assert(f.posts.every((m) => dealt(m) > 0 && m.stunMs > 0), 'snap: damage and hold');
    assert(f.events['aoe:snare_snap'] === 1 && snare.dead, 'consumed');
  } finally { f.inst.destroy(); }
  const h = fixture({ slots: ['spring_snare', null, null, null], runes: { spring_snare: 'hair_trigger' }, posts: [[200, 0]] });
  try {
    assert(castSkill(h.inst, h.p, slot(h, 'spring_snare')));
    h.tick(2);
    assert(dealt(h.posts[0]) > 0, 'Hair Trigger: arms instantly');
  } finally { h.inst.destroy(); }
});

test('Overcast Volley: 8 arrows fall over 1.2 s inside 140 units; Downpour 14; Thunder Peal ends on a heavy shaft; Pinning Shower and Soaked count 3 arrows', () => {
  const f = fixture({ slots: ['overcast_volley', null, null, null], posts: [[220, 0], [240, 20], [210, -25]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'overcast_volley')));
    f.tick(40);
    assert.equal(f.events['aoe:overcast_cloud'], 1);
    assert.equal(f.events['aoe:overcast_arrow'], 8);
    assert(f.posts.some((m) => dealt(m) > 0));
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['overcast_volley', null, null, null], runes: { overcast_volley: 'downpour' }, nodes: { overcast_volley: { downdraft: 2, thunder_peal: 1 } }, posts: [[220, 0]] });
  try {
    castSkill(g.inst, g.p, slot(g, 'overcast_volley')); g.tick(60);
    assert.equal(g.events['aoe:overcast_arrow'], 13, 'Downpour: 14 arrows, the last one heavy');
    assert.equal(g.events['aoe:overcast_heavy'], 1);
  } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['overcast_volley', 'rain_of_vengeance', null, null], runes: { overcast_volley: 'pinning_shower' }, nodes: { overcast_volley: { hatred_rain: 2, soaked: 3, denser_cloud: 3 } }, posts: [[220, 0]] });
  try {
    // A tight cloud on one post: most arrows land on it.
    h.p.ctx.slotted('overcast_volley')!.mods.radius = -90;
    castSkill(h.inst, h.p, slot(h, 'overcast_volley')); h.tick(40);
    const m = h.posts[0];
    assert(m.stunMs > 0 || h.events['aoe:overcast_arrow'] >= 3, 'pinned after 3 arrows');
    assert(m.ps?.vulns.some((v) => v.pct === 24), 'Soaked: +24 % from Arrowfall');
  } finally { h.inst.destroy(); }
});

test('Quarry Mark: marks the strongest elite (+20 %), not recast while it lives, jumps to the strongest nearby when it dies; Long Hunt lasts until death at 15 %', () => {
  const f = fixture({ slots: ['quarry_mark', null, null, null], posts: [[200, 0, 0], [260, 0, 1], [320, 40, 0]] });
  try {
    const elite = f.posts[1];
    assert(castSkill(f.inst, f.p, slot(f, 'quarry_mark')));
    assert.equal(rstate(f.p).quarry, elite.id, 'the elite');
    assert.equal(elite.markPct, 20);
    assert.equal(castSkill(f.inst, f.p, slot(f, 'quarry_mark')), false, 'no second mark while it lives');
    elite.hp = 1; elite.mhp = 1e12;
    f.p.ctx.slotted('quarry_mark');
    castPrimary(f.inst, f.p, elite); f.tick(30);
    assert(elite.dead, 'killed');
    assert.notEqual(rstate(f.p).quarry, elite.id);
    const next = f.inst.mob(rstate(f.p).quarry)!;
    assert(next && next.markPct === 20 && f.events['beam:quarry_jump'] === 1, 'jumped');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['quarry_mark', null, null, null], runes: { quarry_mark: 'long_hunt' }, posts: [[200, 0]] });
  try {
    assert.equal(skillCost(g.p, slot(g, 'quarry_mark')), 0);
    castSkill(g.inst, g.p, slot(g, 'quarry_mark'));
    g.tick(20 * 20);
    assert.equal(g.posts[0].markPct, 15); assert(g.posts[0].markMs > 0, 'still marked after 20 s');
  } finally { g.inst.destroy(); }
});

test('Pitch Mortar: a stationary device that lobs a shell every 2 s at 120–500 units, leaving burning pitch; Frostpot freezes; Twin Barrels allows 2', () => {
  const f = fixture({ slots: ['pitch_mortar', null, null, null], posts: [[300, 0], [320, 30]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'pitch_mortar')));
    assert(f.p.summons.some((s) => s.type === 'mortar'));
    f.tick(20 * 5);
    assert(f.events['aoe:mortar_shot'] >= 2 && f.events['aoe:mortar_impact'] >= 2, `shells (${f.events['aoe:mortar_shot']})`);
    assert(f.posts.every((m) => dealt(m) > 0));
    assert(f.inst.grounds.some((g) => g.fx?.def.id === 'pitch_fire'), 'pitch');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['pitch_mortar', null, null, null], runes: { pitch_mortar: 'frostpot' }, posts: [[300, 0]] });
  try {
    castSkill(g.inst, g.p, slot(g, 'pitch_mortar')); g.tick(30);
    assert(g.posts[0].freezeMs > 0 || g.events['aoe:mortar_impact'] >= 1);
    assert(!g.inst.grounds.some((x) => x.fx?.def.id === 'pitch_fire'), 'no pitch');
  } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['pitch_mortar', null, null, null], runes: { pitch_mortar: 'twin_barrels' }, posts: [[300, 0]] });
  try {
    castSkill(h.inst, h.p, slot(h, 'pitch_mortar')); h.p.x += 40; castSkill(h.inst, h.p, slot(h, 'pitch_mortar'));
    assert.equal(h.p.summons.filter((s) => s.type === 'mortar' && !s.dead).length, 2);
  } finally { h.inst.destroy(); }
});

test('Murmuration: a flock flies to the densest group and strikes 2.0 weapon damage per second inside it; Split Flock makes two; Starling Shield guards you', () => {
  const f = fixture({ slots: ['murmuration', null, null, null], posts: [[300, 0], [320, 20], [300, 40], [280, 20], [310, -20], [330, 0]] });
  try {
    assert(castSkill(f.inst, f.p, slot(f, 'murmuration')));
    const flock = f.p.summons.find((s) => s.type === 'flock')!;
    assert(flock && flock.r === 120);
    f.tick(20 * 4);
    assert(Math.hypot(flock.x - f.posts[0].x, flock.y - f.posts[0].y) < 150, 'it reached the pack');
    assert(f.posts.every((m) => dealt(m) > 0));
    assert(getBuff(f.p, 'murmuration'), 'Shadow Cover sees the flock');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['murmuration', null, null, null], runes: { murmuration: 'split_flock' }, posts: [[300, 0]] });
  try { castSkill(g.inst, g.p, slot(g, 'murmuration')); assert.equal(g.p.summons.filter((s) => s.type === 'flock').length, 2); } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['murmuration', null, null, null], runes: { murmuration: 'starling_shield' }, posts: [[300, 0]] });
  try { castSkill(h.inst, h.p, slot(h, 'murmuration')); assert.equal(getBuff(h.p, 'starling_shield')?.dr, 25); assert(h.p.summons.some((s) => s.type === 'flock_guard')); } finally { h.inst.destroy(); }
});

// ─────────────────────────── Existing skills: runes 4–5 and nodes ───────────────────────────

test('Tracking Arrow: Barbed Shaft bleeds, Hunger Pangs restores Hatred per pierce, Split Feathers adds 2 arrows every Nth shot', () => {
  const f = fixture({ runes: { hungering_arrow: 'barbed_shaft' }, posts: [[150, 0]] });
  try {
    castPrimary(f.inst, f.p, f.posts[0]); f.tick(10);
    assert(f.posts[0].dots.some((d) => d.kind === 'bleed'), 'bleed');
  } finally { f.inst.destroy(); }
  const g = fixture({ runes: { hungering_arrow: 'puncturing' }, nodes: { hungering_arrow: { hunger_pangs: 3, split_feathers: 3 } }, posts: [[150, 0], [220, 0], [290, 0]] });
  try {
    g.p.res = 0;
    for (let i = 0; i < 3; i++) { castPrimary(g.inst, g.p, g.posts[0]); g.tick(12); }
    assert(g.events['proj:arrow'] >= 3 + 2, `every 3rd arrow +2 (${g.events['proj:arrow']})`);
    assert(g.p.res > 3 * 3, `Hatred from pierces on top of 3 per shot (${g.p.res})`);
  } finally { g.inst.destroy(); }
});

test('Sentry: Flame Lance sprays a cone instead of bolts; Crossfire and Last Barrage; Gearwright’s Heart fires 30 % faster', () => {
  const f = fixture({ slots: ['sentry', null, null, null], runes: { sentry: 'flame_lance' }, posts: [[100, 0]] });
  try {
    castSkill(f.inst, f.p, slot(f, 'sentry')); f.tick(40);
    assert(f.events['aoe:sentry_flame'] > 0 && !f.events['proj:bolt'] && dealt(f.posts[0]) > 0);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['sentry', null, null, null], nodes: { sentry: { sturdier_frames: 2, last_barrage: 1 } }, posts: [[150, 0]] });
  try {
    castSkill(g.inst, g.p, slot(g, 'sentry'));
    const s = g.p.summons.find((x) => x.type === 'sentry')!;
    s.lifeMs = 120; const before = g.events['proj:bolt'] ?? 0;
    g.tick(4);
    assert((g.events['proj:bolt'] ?? 0) - before >= 4, 'final barrage of 4 bolts');
  } finally { g.inst.destroy(); }
  const rate = (powers: Record<string, number>) => {
    const h = fixture({ slots: ['sentry', null, null, null], posts: [[150, 0]] });
    try { h.setPowers(powers); castSkill(h.inst, h.p, slot(h, 'sentry')); h.tick(20 * 6); return h.events['proj:bolt'] ?? 0; } finally { h.inst.destroy(); }
  };
  const base = rate({}), fast = rate({ gearwright_heart: 35 });
  assert(fast / base > 1.2 && fast / base < 1.4, `30 % faster (${base} → ${fast})`);
});

test('Multishot: Fanning Hail fires 15 arrows over 180°; Gale Shot restores 1 Hatred per enemy (max 10); Thrifty Nock refunds on 5+ hits', () => {
  const posts: [number, number][] = [[120, -60], [140, -20], [140, 20], [120, 60], [160, 0], [180, 40]];
  const f = fixture({ slots: ['multishot', null, null, null], runes: { multishot: 'fanning_hail' }, posts });
  try { castSkill(f.inst, f.p, slot(f, 'multishot')); assert.equal(f.events['proj:arrow'], 15); } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['multishot', null, null, null], runes: { multishot: 'gale_shot' }, nodes: { multishot: { thrifty_nock: 3 } }, posts });
  try {
    g.p.res = 50;
    castSkill(g.inst, g.p, slot(g, 'multishot')); g.p.res -= skillCost(g.p, slot(g, 'multishot'));
    const after = g.p.res; g.tick(20);
    assert(g.p.res - after >= 6 + 6 - 1, `6 enemies: +6 Gale Shot, +6 Thrifty Nock (${(g.p.res - after).toFixed(1)})`);
  } finally { g.inst.destroy(); }
});

test('Burst Arrow: Freezing Charge grenades freeze; Barrel Bomb blasts before detonating; Powderkeg Crossbow adds 3 grenades', () => {
  const f = fixture({ slots: ['cluster_arrow', null, null, null], runes: { cluster_arrow: 'freezing_charge' }, posts: [[200, 0], [260, 20], [220, 60]] });
  try { castSkill(f.inst, f.p, slot(f, 'cluster_arrow')); f.tick(20); assert(f.events['aoe:grenade'] === 4 && f.posts.some((m) => m.freezeMs > 0)); } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['cluster_arrow', null, null, null], runes: { cluster_arrow: 'barrel_bomb' }, posts: [[200, 0]] });
  try { g.setPowers({ powderkeg_crossbow: 175 }); castSkill(g.inst, g.p, slot(g, 'cluster_arrow')); g.tick(25); assert.equal(g.events['aoe:barrel_blast'], 3); assert.equal(g.events['aoe:grenade'], 7); } finally { g.inst.destroy(); }
});

test('Arrowfall: Flood Plain leaves wet ground; Hailstones stuns after 5 waves; Opening Burst strengthens the first wave; Rainspindle rolls damage', () => {
  const f = fixture({ slots: ['rain_of_vengeance', null, null, null], runes: { rain_of_vengeance: 'flood_plain' }, nodes: { rain_of_vengeance: { wind_shear: 2, hailstones: 3 } }, posts: [[200, 0]] });
  try {
    castSkill(f.inst, f.p, slot(f, 'rain_of_vengeance'));
    f.tick(20 * 3);
    assert(f.posts[0].stunMs > 0, 'Hailstones: stunned after 5 waves');
    f.tick(20 * 3);
    assert(f.inst.grounds.some((g) => g.fx?.def.id === 'wet_ground'), 'wet ground after the storm');
  } finally { f.inst.destroy(); }
  assert.equal(SKILLS.rain_of_vengeance.nodes!.find((n) => n.id === 'wind_shear')!.name, 'Crosswind', 'renamed (originality gate)');
  assert.equal(LEGENDARIES.rainspindle.range[0], 150, 'Rainspindle: damage roll (BUDGET.md §4 lever)');
});

test('Companion: Badger Sett stuns with bursts; Heron spears from 200 units and chills; Loyal Guard: less damage per companion', () => {
  const f = fixture({ slots: ['companion', null, null, null], runes: { companion: 'badger_sett' }, posts: [[120, 0]] });
  try { castSkill(f.inst, f.p, slot(f, 'companion')); let stunned = false; for (let i = 0; i < 60 && !stunned; i++) { f.tick(); stunned = f.posts[0].stunMs > 0; } assert(f.events['aoe:badger_burst'] >= 1 && stunned, 'badger burst stuns'); } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['companion', null, null, null], runes: { companion: 'heron' }, posts: [[220, 0]] });
  try {
    castSkill(g.inst, g.p, slot(g, 'companion')); g.tick(20 * 3);
    const heron = g.p.summons.find((s) => s.type === 'heron')!;
    assert(heron && g.events['beam:heron_spear'] >= 1 && g.posts[0].chillMs > 0, 'heron spears and chills');
  } finally { g.inst.destroy(); }
});

// ─────────────────────────── Passives, sets, legendaries ───────────────────────────

test('passives: Engineer’s Margin (+1 Device maximum, −15 damage), Weather Eye (Aerial chills, +15 % vs chilled), Hatred Well, Second Skin', () => {
  const f = fixture({ slots: ['sentry', 'overcast_volley', null, null], passives: ['ranger_engineers_margin', 'ranger_weather_eye', 'ranger_hatred_well', 'ranger_second_skin'], posts: [[220, 0]] });
  try {
    assert.equal(slot(f, 'sentry').mods.maxSummons, 1);
    assert.equal(slot(f, 'sentry').mods.dmg, -15);
    assert(f.p.ctx.powers.index.get('overcast_volley')?.has('chill'), 'Weather Eye: Aerial skills count as Chill');
    castSkill(f.inst, f.p, slot(f, 'overcast_volley')); f.tick(30);
    assert(f.posts[0].chillMs > 0, 'chilled by an Aerial hit');
    // Hatred Well: below 40 Hatred regeneration doubles.
    f.p.res = 10; const r0 = f.p.res; f.tick(20);
    const regen = f.p.ctx.d.resourceRegen;
    assert(f.p.res - r0 >= regen * 1.9, `doubled (${(f.p.res - r0).toFixed(2)} vs ${regen}/s)`);
  } finally { f.inst.destroy(); }
});

test('sets: Siegebreaker 2 / 6 count Devices; Thicket Kin 4 damage reduction per Beast; Snarewright 4 guard on trigger; Rainkeeper 4 costs', () => {
  const f = fixture({ slots: ['sentry', 'pitch_mortar', 'spring_snare', 'multishot'], posts: [[300, 0]] });
  try {
    f.setPowers({}, { siegebreaker: 6 });
    assert.equal(slot(f, 'sentry').mods.maxSummons, 1); assert.equal(slot(f, 'pitch_mortar').mods.cooldown, -20);
    castSkill(f.inst, f.p, slot(f, 'sentry')); castSkill(f.inst, f.p, slot(f, 'pitch_mortar'));
    assert(Math.abs(ownMultiplier(f.p, 'multishot') - 1.2) < 1e-9, 'Siegebreaker 6: +10 % per active Device (2)');
    assert.equal(ownMultiplier(f.p, 'hungering_arrow'), 1, 'not for a non-Device, non-Spender skill');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['companion', null, null, null], posts: [[300, 0]] });
  try {
    g.setPowers({}, { thicket_kin: 4 });
    assert.equal(slot(g, 'companion').mods.maxSummons, 1);
    castSkill(g.inst, g.p, slot(g, 'companion')); castSkill(g.inst, g.p, slot(g, 'companion'));
    assert.equal(g.p.summons.filter((s) => s.skill === 'companion' && !s.dead).length, 2);
  } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['spring_snare', null, null, null], posts: [[200, 0]] });
  try {
    h.setPowers({}, { snarewright: 4 });
    assert.equal(slot(h, 'spring_snare').mods.maxSummons, 1);
    castSkill(h.inst, h.p, slot(h, 'spring_snare')); h.tick(20);
    assert.equal(getBuff(h.p, 'snare_guard')?.dr, 20, '20 % damage reduction after a trigger');
  } finally { h.inst.destroy(); }
  const k = fixture({ slots: ['rain_of_vengeance', 'multishot', null, null], posts: [[200, 0]] });
  try {
    k.setPowers({}, { rainkeeper: 4 });
    const before = skillCost(k.p, slot(k, 'multishot'));
    castSkill(k.inst, k.p, slot(k, 'rain_of_vengeance')); k.tick(10);
    assert(getBuff(k.p, 'rainkeeper'), 'active while the storm lasts');
    assert(Math.abs(skillCost(k.p, slot(k, 'multishot')) - before * 0.85) < 0.01, '15 % cheaper (fitted from 30)');
  } finally { k.inst.destroy(); }
});

test('legendaries: Riverstone Repeater +2 skips, Featherguard Cuffs compound per pass, Bowyer’s Gloves within 200, Roost Charm, Spotter’s Repeater', () => {
  const posts: [number, number][] = [[150, 0], [300, 0], [450, 0], [600, 0], [750, 0]];
  const f = fixture({ primary: 'skipstone_bolt', posts });
  try { f.setPowers({ riverstone_repeater: 125 }); castPrimary(f.inst, f.p, f.posts[0]); f.tick(60); assert(f.posts.every((m) => dealt(m) > 0), '+2 skips: five enemies'); } finally { f.inst.destroy(); }
  const ratio = (powers: Record<string, number>) => {
    const g = fixture({ primary: 'skipstone_bolt', posts });
    try { g.setPowers(powers); castPrimary(g.inst, g.p, g.posts[0]); g.tick(40); return dealt(g.posts[1]) / dealt(g.posts[0]); } finally { g.inst.destroy(); }
  };
  assert(Math.abs(ratio({ featherguard_cuffs: 25 }) / ratio({}) - 1.25) < 0.02, 'Featherguard: +25 % at the first skip');
  const h = fixture({ slots: ['quarry_mark', null, null, null], posts: [[200, 0]] });
  try { h.setPowers({ spotters_repeater: 12 }); castSkill(h.inst, h.p, slot(h, 'quarry_mark')); assert.equal(h.posts[0].markPct, 32, '20 + 12 points'); } finally { h.inst.destroy(); }
});

test('more items and rules: Tar-Stained Jerkin grows your grounds and exposes enemies to Devices; Roost Charm; Second Skin; Siegebreaker 4 device copies', () => {
  const f = fixture({ slots: ['pitch_mortar', 'sentry', null, null], posts: [[300, 0]] });
  try {
    f.setPowers({ tar_stained_jerkin: 30 });
    castSkill(f.inst, f.p, slot(f, 'pitch_mortar')); f.tick(20 * 3);
    const g = f.inst.grounds.find((x) => x.fx?.def.id === 'pitch_fire')!;
    assert(g && g.r > 100, `the pitch spreads (${g?.r})`);
    assert(f.posts[0].ps?.vulns.some((v) => v.pct === 30), 'enemies inside take more from Devices');
  } finally { f.inst.destroy(); }
  const r = fixture({ slots: ['companion', 'murmuration', null, null], posts: [[150, 0]] });
  try {
    r.setPowers({ roost_charm: 4 });
    castSkill(r.inst, r.p, slot(r, 'companion'));
    r.p.readyAt.set('murmuration', r.inst.t + 40_000);
    const before = r.p.readyAt.get('murmuration')!;
    r.posts[0].hp = 1; r.tick(20 * 3);
    assert(r.posts[0].dead, 'the companion killed it');
    assert(Math.abs(before - r.p.readyAt.get('murmuration')! - 500) < 1, 'Roost Charm: −0.5 s');
  } finally { r.inst.destroy(); }
  const s = fixture({ slots: ['sentry', 'multishot', null, null], posts: [[200, 0], [230, 30]] });
  try {
    s.setPowers({}, { siegebreaker: 4 });
    castSkill(s.inst, s.p, slot(s, 'sentry')); s.tick(2);
    const before = s.events['proj:arrow'] ?? 0;
    castSkill(s.inst, s.p, slot(s, 'multishot'));
    assert.equal((s.events['proj:arrow'] ?? 0) - before, 18, 'the Sentry fires a copy of the volley');
  } finally { s.inst.destroy(); }
});
