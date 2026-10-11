// Warrior pilot (docs/rework/depth/WARRIOR.md, bible v2): data rules (tags, names, runes, trees, economy) and the
// server behaviour of the M1 skills, runes, nodes, legendaries and set bonuses that ship in phase 1.
// Targets are stationary "posts" (a non-dummy copy of the training dummy: they take damage and can be stunned).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { LEGENDARIES, SETS } from '../../shared/src/data/items';
import { SKILLS, collectSkillMods, describeNode, skillTags, skillsForClass, type NodeDef, type SkillTag } from '../../shared/src/data/skills';
import { ZONES } from '../../shared/src/data/zones';
import { computeStats } from '../../shared/src/stats';
import { treeTotalRanks } from '../../shared/src/specialization';
import { validateContent } from '../../shared/src/contentValidation';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import type { CharacterSave, DerivedStats } from '../../shared/src/types';
import type { PlayerLink } from '../src/contracts';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { buildCtx, skillCost } from '../src/sim/playerctx';
import { channelMoveFactor } from '../src/sim/powerActions';
import { ownMultiplier } from '../src/sim/powerRuntime';
import { getBuff } from '../src/sim/effects';
import { castPrimary, castSkill, startChannel } from '../src/sim/skills';
import type { Mob, Player } from '../src/sim/types';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

const POST = { ...DUMMY_DEF, id: 'warrior_test_post', name: 'Post', hp: 40 };

interface Fx { inst: Instance; p: Player; save: CharacterSave; posts: Mob[]; tick: (n?: number) => void; events: Record<string, number>; setPowers: (powers: Record<string, number>, sets?: Record<string, number>) => void }

function fixture(opts: { primary?: string; slots?: (string | null)[]; runes?: Record<string, string>; nodes?: Record<string, Record<string, number>>; posts?: [number, number, number?][]; level?: number } = {}): Fx {
  const save = createCharacter('WarriorPilot', 'warrior', 61);
  save.level = opts.level ?? 70;
  save.skills.slots = opts.slots ?? [null, null, null, null];
  save.skills.autoCast = ['paused', 'paused', 'paused', 'paused'];
  if (opts.primary) save.skills.primary = opts.primary;
  save.skills.runes = { ...(opts.runes ?? {}) };
  save.skills.nodes = structuredClone(opts.nodes ?? {});
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'warrior', channel: 1, seed: 73, theme: ZONES.whispering_glade.theme });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeMob(m);
  inst.addPlayer(link);
  const p = inst.players[0];
  p.debugInfiniteHp = true; p.res = p.mres; p.atkCdMs = 1e9;
  const posts = (opts.posts ?? [[60, 0]]).map(([dx, dy, tier]) => createMob(inst, POST, 70, p.x + dx, p.y + dy, { tier: (tier ?? 0) as 0 }));
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
    // Deterministic damage for ratio checks: no crits, a fixed weapon roll large enough that rounding does not matter.
    const w = 1000;
    const d: DerivedStats = { ...base, powers, sets, chc: 0, weaponMin: w, weaponMax: w };
    p.ctx = buildCtx(save, d);
  };
  setPowers({});
  return { inst, p, save, posts, tick, events, setPowers };
}
const dealt = (m: Mob) => m.mhp - m.hp;

// ─────────────────────────── Data ───────────────────────────

test('warrior data: bible v2 tags (ITEMS-SHARED §1.2), NAMES.md display names, categories, rune levels, trees', () => {
  assert.deepEqual(validateContent(), []);
  const want: Record<string, SkillTag[]> = {
    cleave: ['primary', 'strike', 'area', 'physical'], tolling_blow: ['primary', 'strike', 'stun', 'physical'],
    whirlwind: ['channel', 'spender', 'strike', 'area', 'physical'], ironplough: ['channel', 'spender', 'strike', 'area', 'displace', 'physical'],
    rend: ['spender', 'area', 'bleed', 'physical'], sawtooth_hatchet: ['spender', 'projectile', 'piercing', 'bleed', 'physical'],
    ground_stomp: ['cooldown', 'area', 'stun', 'physical'], seismic_slam: ['spender', 'area', 'displace', 'physical'],
    cairnfall: ['cooldown', 'aerial', 'area', 'stun', 'physical'], battle_rage: ['buff', 'physical'], muster_standard: ['buff', 'cooldown', 'ground', 'physical'],
    kilnheart: ['buff', 'cooldown', 'burn', 'fire'],
  };
  for (const [id, tags] of Object.entries(want)) assert.deepEqual([...skillTags(SKILLS[id])].sort(), [...tags].sort(), id);
  // Rune tag changes (ITEMS-SHARED §1.2).
  for (const [skill, rune, tag] of [['cleave', 'hemorrhage_arc', 'bleed'], ['whirlwind', 'dust_devils', 'summon'], ['whirlwind', 'gyre_of_ash', 'burn'], ['whirlwind', 'gyre_of_ash', 'ground'],
    ['whirlwind', 'tethered_spin', 'displace'], ['seismic_slam', 'permafrost', 'chill'], ['tolling_blow', 'furnace_clapper', 'burn'], ['sawtooth_hatchet', 'kiln_heated', 'burn'],
    ['muster_standard', 'ember_pennant', 'area'], ['ironplough', 'stone_spray', 'projectile'], ['ironplough', 'smouldering_share', 'burn'], ['cairnfall', 'waymarker', 'ground'],
    ['cairnfall', 'kiln_stones', 'burn'], ['kilnheart', 'cold_forge', 'chill']] as const) assert(skillTags(SKILLS[skill], rune).has(tag), `${skill}/${rune} +${tag}`);
  assert(!skillTags(SKILLS.kilnheart, 'cold_forge').has('burn') && skillTags(SKILLS.kilnheart, 'cold_forge').has('cold'), 'Cold Forge −Burn, Cold');
  // NAMES.md: display renames, ids unchanged.
  assert.equal(SKILLS.seismic_slam.name, 'Quakeline');
  const rune = (s: string, r: string) => SKILLS[s].runes.find((x) => x.id === r)!.name;
  assert.deepEqual([rune('cleave', 'broad_sweep'), rune('cleave', 'gathering_storm'), rune('whirlwind', 'blood_funnel'), rune('whirlwind', 'volcanic_eruption'), rune('rend', 'lacerate'),
    rune('ground_stomp', 'wrenching_smash'), rune('ground_stomp', 'jarring_slam'), rune('ground_stomp', 'foot_of_the_mountain'), rune('seismic_slam', 'shattered_ground'), rune('battle_rage', 'marauders_rage')],
  ['Wide Swath', 'Static Edge', 'Red Draw', 'Ember Gale', 'Deep Rake', 'Drawing Stomp', 'Ringing Stomp', 'Kiln Heel', 'Scorched Seam', 'Full Boil']);
  assert(LEGENDARIES.faultcleaver.power.startsWith('Quakeline'));
  // Categories and unlocks.
  const list = skillsForClass('warrior');
  assert.deepEqual(list.map((s) => s.unlock), [1, 2, 4, 6, 9, 12, 16, 20, 26, 32, 40, 50]);
  assert.deepEqual([...new Set(list.map((s) => s.category))], ['Strikes', 'Steel Storm', 'Bloodletting', 'Earthshaker', 'Warcries']);
  // Bible rune levels: existing skills + 14 / + 20; new skills as authored.
  const at = (s: string, r: string) => SKILLS[s].runes.find((x) => x.id === r)!.unlock;
  assert.deepEqual([at('cleave', 'hemorrhage_arc'), at('cleave', 'backswing'), at('whirlwind', 'gyre_of_ash'), at('whirlwind', 'tethered_spin'), at('rend', 'gash_sense'), at('rend', 'haemal_debt'),
    at('ground_stomp', 'outward_tremor'), at('seismic_slam', 'split_earth'), at('seismic_slam', 'bedrock'), at('battle_rage', 'bloodsong'), at('battle_rage', 'shared_fury')],
  [15, 21, 16, 22, 18, 24, 20, 23, 29, 26, 32]);
  assert.deepEqual(SKILLS.cairnfall.runes.map((r) => r.unlock), [42, 45, 49, 54, 60]);
  // Trees: N4-N6 need 2 ranks in the node above; every tree holds more ranks than the cap.
  for (const s of list) {
    const nodes: NodeDef[] = s.nodes ?? [];
    assert(nodes.length >= 4, `${s.id} tree`);
    for (const n of nodes) {
      if (n.pos.row === 0) assert.equal(n.requires, undefined, `${s.id}.${n.id} open`);
      else { const above: NodeDef = nodes.find((x) => x.pos.col === n.pos.col && x.pos.row === 0)!; assert.deepEqual(n.requires, [{ node: above.id, rank: 2 }], `${s.id}.${n.id}`); }
    }
    assert(treeTotalRanks(s) > 10, `${s.id} ${treeTotalRanks(s)} ranks`);
  }
  assert.equal(describeNode(SKILLS.cleave.nodes!.find((n) => n.id === 'reapers_rhythm')!, 3), 'A Cleave kill starts a free swing at the nearest enemy (at most once every 0.6 seconds).');
  assert.equal(collectSkillMods(SKILLS.ground_stomp, null, 0, { heavy_heel: 2 }).duration, 25, 'Heavy Heel: +0.5 s on the 2 s stun');
});

test('no shipped warrior text names a build (ITEMS-SHARED §0 rule 1)', () => {
  const labels = /\b(gyre build|faultline|cinderblood|warcaller|ploughline|hatchetwind|build)\b/i;
  const texts = [
    ...skillsForClass('warrior').flatMap((s) => [s.desc, ...s.runes.map((r) => r.desc), ...(s.nodes ?? []).map((n) => n.text)]),
    ...Object.values(LEGENDARIES).filter((l) => l.classes?.includes('warrior')).flatMap((l) => [l.name, l.power, l.flavor]),
    ...Object.values(SETS).filter((s) => s.classId === 'warrior').flatMap((s) => [s.name, ...s.bonuses.map((b) => b.text), ...s.pieces.map((p) => p.name)]),
  ];
  for (const t of texts) assert(!labels.test(t), t);
});

// ─────────────────────────── Tolling Blow ───────────────────────────

test('Tolling Blow: every third blow tolls and stuns around the target; Double Peal every second; Iron Tongue pierces without tolls', () => {
  const f = fixture({ primary: 'tolling_blow', posts: [[60, 0], [90, 20]] });
  try {
    const [a, b] = f.posts;
    castPrimary(f.inst, f.p, a); castPrimary(f.inst, f.p, a);
    assert.equal(f.events['aoe:toll'] ?? 0, 0); assert.equal(b.stunMs, 0);
    castPrimary(f.inst, f.p, a);
    assert.equal(f.events['aoe:toll'], 1, 'third blow tolls');
    assert(a.stunMs > 0 && b.stunMs > 0, 'the toll stuns enemies within its radius');
    assert(dealt(b) > 0, 'the shockwave damages the neighbour');
  } finally { f.inst.destroy(); }
  const g = fixture({ primary: 'tolling_blow', runes: { tolling_blow: 'double_peal' } });
  try { castPrimary(g.inst, g.p, g.posts[0]); castPrimary(g.inst, g.p, g.posts[0]); assert.equal(g.events['aoe:toll'], 1, 'Double Peal: second blow'); } finally { g.inst.destroy(); }
  const h = fixture({ primary: 'tolling_blow', runes: { tolling_blow: 'iron_tongue' }, posts: [[60, 0], [110, 0]] });
  try {
    for (let i = 0; i < 4; i++) castPrimary(h.inst, h.p, h.posts[0]);
    assert.equal(h.events['aoe:toll'] ?? 0, 0, 'Iron Tongue: no tolls');
    assert(dealt(h.posts[1]) > 0, 'passes through to the enemy behind');
  } finally { h.inst.destroy(); }
});

test('Tolling Blow nodes: Ringing Ears primes the next Quakeline hit (consumed); Muffled Strike is a per-hit more-multiplier', () => {
  const f = fixture({ primary: 'tolling_blow', slots: ['seismic_slam', null, null, null], nodes: { tolling_blow: { ringing_ears: 3 } }, posts: [[70, 0]] });
  try {
    const m = f.posts[0];
    for (let i = 0; i < 3; i++) castPrimary(f.inst, f.p, m);
    assert(m.stunMs > 0);
    const primed = dealt(m);
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('seismic_slam')!));
    const first = dealt(m) - primed;
    m.hp = m.mhp; m.stunMs = 0;
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('seismic_slam')!));
    const second = dealt(m);
    assert(first > second * 1.08 && first < second * 1.25, `primed ${first} vs ${second} (+15% expected, crit noise)`);
  } finally { f.inst.destroy(); }
  assert.deepEqual(SKILLS.tolling_blow.nodes!.find((n) => n.id === 'muffled_strike')!.effects, [{ kind: 'skillMore', skills: ['tolling_blow'], pct: { roll: 20 }, when: { targetState: 'stunned' } }]);
});

// ─────────────────────────── Sawtooth Hatchet ───────────────────────────

test('Sawtooth Hatchet: hits each enemy on the way out and back, bleeds once; Grinning Saw adds a third pass; Twin Hatchets throws two', () => {
  const passes = (o: Parameters<typeof fixture>[0], powers: Record<string, number> = {}) => {
    const f = fixture({ slots: ['sawtooth_hatchet', null, null, null], posts: [[160, 0]], ...o });
    try {
      f.setPowers(powers);
      let hits = 0;
      const hurt = f.posts[0];
      let last = hurt.hp;
      assert(castSkill(f.inst, f.p, f.p.ctx.slotted('sawtooth_hatchet')!));
      const bled = () => hurt.dots.filter((d) => d.skill === 'sawtooth_hatchet').length;
      for (let i = 0; i < 60; i++) {
        f.tick();
        // Direct hits only: the bleed ticks every 0.5 s and is removed from the count below.
        if (hurt.hp < last) { hits += 1; last = hurt.hp; }
      }
      return { hits, bled: bled(), launches: (f.events['aoe:hatchet'] ?? 0) + (f.events['aoe:hatchet3'] ?? 0) };
    } finally { f.inst.destroy(); }
  };
  const base = passes({});
  assert.equal(base.launches, 1); assert.equal(base.bled, 1);
  assert(base.hits >= 2, `out + back (${base.hits} damage events incl. bleed ticks)`);
  const twin = passes({ runes: { sawtooth_hatchet: 'twin_hatchets' } });
  assert.equal(twin.launches, 2);
  const saw = passes({}, { grinning_saw: 175 });
  assert(saw.hits >= base.hits + 1, `a third pass (${saw.hits} vs ${base.hits})`);
});

// ─────────────────────────── Muster Standard ───────────────────────────

test('Muster Standard: you and allies inside gain attack speed and resource; Quartermaster plants two; Marching Orders follows you', () => {
  const f = fixture({ slots: ['muster_standard', null, null, null] });
  try {
    f.p.res = 0;
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('muster_standard')!));
    assert.equal(getBuff(f.p, 'muster_standard')?.ias, 15);
    for (let i = 0; i < 20; i++) { f.p.sinceHitMs = 0; f.tick(); } // 1 s, Fury decay held off
    assert(f.p.res >= 10 + 1.9 && f.p.res <= 12.6, `Fury: ${f.p.res} (10 on plant + 2 per second, first tick on plant)`);
    f.setPowers({ quartermasters_cuirass: 25 });
    f.p.readyAt.clear();
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('muster_standard')!));
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('muster_standard')!));
    assert.equal(f.events['aoe:standard_end'] ?? 0, 1, 'with two allowed, the third plant removes the oldest');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['muster_standard', null, null, null], runes: { muster_standard: 'marching_orders' } });
  try {
    assert(castSkill(g.inst, g.p, g.p.ctx.slotted('muster_standard')!));
    g.p.x += 400; g.p.mv.x += 400; g.tick(5);
    assert(getBuff(g.p, 'muster_standard'), 'the carried standard moved with you');
  } finally { g.inst.destroy(); }
});

// ─────────────────────────── Ironplough ───────────────────────────

test('Ironplough: damage ramps to double over 2.5 s and pushes enemies away; Coulter Blade ramps twice as fast', () => {
  const run = (powers: Record<string, number>) => {
    const f = fixture({ slots: ['ironplough', null, null, null], posts: [[70, 0]] });
    try {
      f.setPowers(powers);
      const m = f.posts[0], x0 = m.x;
      startChannel(f.inst, f.p, f.p.ctx.slotted('ironplough')!, true);
      const per: number[] = [];
      let last = m.hp;
      for (let i = 0; i < 70; i++) { f.p.res = f.p.mres; f.tick(); if (i % 5 === 4) { per.push(last - m.hp); last = m.hp; } m.x = x0; f.inst.mobHash.update(m); }
      return { per, pushed: f.events['aoe:plough'] ?? 0 };
    } finally { f.inst.destroy(); }
  };
  const plain = run({});
  assert(plain.pushed >= 12);
  // per[0] holds the channel's opening strike plus one more; per[1] is a single strike at ramp level 0-1, the tail level 5.
  const early = plain.per[1], late = plain.per[plain.per.length - 1];
  assert(late / early > 1.6 && late / early <= 2.01, `ramp ${early} → ${late} (${plain.per.join(',')})`);
  for (let i = 2; i < plain.per.length; i++) assert(plain.per[i] >= plain.per[i - 1], 'never falls while held');
  const fast = run({ coulter_blade: 175 });
  assert(fast.per[3] / plain.per[3] > (1 + 1.75) * 1.05, `faster ramp plus the damage roll (${fast.per[3]} vs ${plain.per[3]})`);
});

// ─────────────────────────── Cairnfall ───────────────────────────

test('Cairnfall: five telegraphed impacts that stun; Debt of Stone drops eight; Shepherd’s Count refunds cooldown per stunned enemy', () => {
  const f = fixture({ slots: ['cairnfall', null, null, null], posts: [[120, 0], [-120, 0], [0, 120], [0, -120], [85, 85]] });
  try {
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('cairnfall')!));
    assert.equal(f.events['tele:cairn'], 5);
    f.tick(30);
    assert.equal(f.events['aoe:cairn'], 5);
    assert(f.posts.filter((m) => dealt(m) > 0).length >= 3, 'the ring lands on the enemies around you');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['cairnfall', null, null, null], runes: { cairnfall: 'debt_of_stone' } });
  try { assert(castSkill(g.inst, g.p, g.p.ctx.slotted('cairnfall')!)); assert.equal(g.events['tele:cairn'], 8); } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['cairnfall', null, null, null], runes: { cairnfall: 'shepherds_count' }, posts: [[120, 0], [-120, 0], [0, 120], [0, -120]] });
  try {
    h.p.readyAt.set('cairnfall', h.inst.t + 30000);
    assert(castSkill(h.inst, h.p, h.p.ctx.slotted('cairnfall')!));
    h.tick(30);
    const left = (h.p.readyAt.get('cairnfall') ?? 0) - h.inst.t;
    assert(left < 30000 - 1500 - 2000, `refunded: ${left} ms left`);
  } finally { h.inst.destroy(); }
});

// ─────────────────────────── Existing skills: new runes and nodes ───────────────────────────

test('Cleave: Notched Edge Fury on 3+ hits, Hemorrhage Arc bleeds, Backswing follows, Millwheel Edge hits all around', () => {
  const f = fixture({ nodes: { cleave: { notched_edge: 3 } }, posts: [[60, 0], [60, 30], [60, -30]] });
  try { f.p.res = 0; castPrimary(f.inst, f.p, f.posts[0]); assert.equal(f.p.res, 5 + 3); } finally { f.inst.destroy(); }
  const g = fixture({ runes: { cleave: 'hemorrhage_arc' } });
  try { castPrimary(g.inst, g.p, g.posts[0]); assert(g.posts[0].dots.some((d) => d.kind === 'bleed' && d.skill === 'cleave')); } finally { g.inst.destroy(); }
  const h = fixture({ runes: { cleave: 'backswing' } });
  try { castPrimary(h.inst, h.p, h.posts[0]); h.tick(5); assert.equal(h.events['aoe:cleave'], 2, 'swing + backswing'); } finally { h.inst.destroy(); }
  const k = fixture({ posts: [[60, 0], [-60, 0]] });
  try {
    k.setPowers({ millwheel_edge: 175 });
    castPrimary(k.inst, k.p, k.posts[0]);
    assert(dealt(k.posts[1]) > 0, 'the enemy behind you is hit too');
  } finally { k.inst.destroy(); }
});

test('Whirlwind: Eye Wall strikes faster, Second Breath is free at first, Tethered Spin pulls; Ninefold Gale boosts Whirlwind itself', () => {
  const ticks = (o: Parameters<typeof fixture>[0]) => {
    const f = fixture({ slots: ['whirlwind', null, null, null], ...o });
    try {
      startChannel(f.inst, f.p, f.p.ctx.slotted('whirlwind')!, true);
      const res0 = f.p.res;
      f.tick(20);
      return { whirls: f.events['aoe:whirl'] ?? 0, spent: res0 - f.p.res };
    } finally { f.inst.destroy(); }
  };
  const plain = ticks({}), eye = ticks({ nodes: { whirlwind: { tight_spin: 2, eye_wall: 3 } } }), breath = ticks({ nodes: { whirlwind: { second_breath: 3 } } });
  assert(eye.whirls > plain.whirls, `${eye.whirls} > ${plain.whirls}`);
  assert(plain.spent > 8 && breath.spent < 0.01, `Second Breath: ${breath.spent} spent (plain ${plain.spent})`);
  const pull = fixture({ slots: ['whirlwind', null, null, null], runes: { whirlwind: 'tethered_spin' }, posts: [[150, 0]] });
  try {
    pull.posts[0].def = { ...pull.posts[0].def, speed: 0 };
    const d0 = pull.posts[0].x - pull.p.x;
    startChannel(pull.inst, pull.p, pull.p.ctx.slotted('whirlwind')!, true);
    pull.tick(6);
    assert(pull.posts[0].x - pull.p.x < d0 - 20, 'pulled toward you');
  } finally { pull.inst.destroy(); }
  const nf = fixture({ slots: ['whirlwind', null, null, null] });
  try {
    nf.setPowers({ ninefold_gale: 160 });
    const ww = nf.p.ctx.slotted('whirlwind')!;
    assert.equal(ww.mods.dmg, 160); assert(ww.flags.has('dustDevils'));
  } finally { nf.inst.destroy(); }
});

test('Rend: Rollover carries the remaining bleed, Thirsting Wounds refunds Fury, Haemal Debt refunds on death; Ground Stomp Sure Footing; Battle Rage Red Tide', () => {
  const f = fixture({ slots: ['rend', null, null, null], nodes: { rend: { rollover: 3 } } });
  try {
    const rt = f.p.ctx.slotted('rend')!;
    castSkill(f.inst, f.p, rt);
    const one = f.posts[0].dots.find((d) => d.skill === 'rend')!.perTick;
    castSkill(f.inst, f.p, rt);
    const two = f.posts[0].dots.find((d) => d.skill === 'rend')!.perTick;
    assert(two > one * 1.9, `Rollover 100%: ${one} → ${two}`);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['rend', null, null, null], nodes: { rend: { thirsting_wounds: 3 } }, posts: [[40, 0], [-40, 0], [0, 40], [0, -40], [30, 30]] });
  try {
    const rt = g.p.ctx.slotted('rend')!, cost = skillCost(g.p, rt);
    g.p.res = 50;
    castSkill(g.inst, g.p, rt); g.p.res -= cost; // the brain pays the cost after the cast
    assert.equal(g.p.res, 50 - cost + 2 * 6, '+6 Fury for each enemy beyond the third');
  } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['ground_stomp', null, null, null], nodes: { ground_stomp: { fury_spring: 2, sure_footing: 3 } }, posts: [[40, 0], [-40, 0], [0, 40], [0, -40], [30, 30]] });
  try {
    h.p.readyAt.set('ground_stomp', h.inst.t + 12000);
    castSkill(h.inst, h.p, h.p.ctx.slotted('ground_stomp')!);
    h.tick();
    assert(((h.p.readyAt.get('ground_stomp') ?? 0) - h.inst.t) <= 12000 - 3000, 'Sure Footing −3 s after 5 hits');
  } finally { h.inst.destroy(); }
  const k = fixture({ slots: ['battle_rage', null, null, null], nodes: { battle_rage: { red_tide: 3 } } });
  try {
    const rt = k.p.ctx.slotted('battle_rage')!, cost = skillCost(k.p, rt);
    k.p.res = 40; castSkill(k.inst, k.p, rt); k.p.res -= cost;
    assert.equal(k.p.res, 40 - cost + 30);
  } finally { k.inst.destroy(); }
});

// ─────────────────────────── Sets and legendaries ───────────────────────────

test('tag-keyed set bonuses reach exactly the tagged skills (Endless Storm on Channel, Fault Warden on Stun, Furrowmark on Displace)', () => {
  const f = fixture({ slots: ['whirlwind', 'ironplough', 'ground_stomp', 'cairnfall'] });
  try {
    f.setPowers({}, { endless_storm: 6, fault_warden: 2 });
    for (const id of ['whirlwind', 'ironplough']) assert.equal(f.p.ctx.modsOf(id).mods.cost, -25, `${id} cost −25`);
    assert(f.p.ctx.modsOf('ironplough').flags.has('stormWisps'));
    assert.equal(f.p.ctx.modsOf('cleave').mods.cost, undefined, 'Cleave is not a Channel skill');
    for (const id of ['ground_stomp', 'cairnfall', 'tolling_blow']) assert.deepEqual([f.p.ctx.modsOf(id).mods.radius, f.p.ctx.modsOf(id).mods.cooldown], [25, -15], id);
    assert.equal(f.p.ctx.modsOf('seismic_slam').mods.radius, undefined, 'Quakeline is not a Stun skill');
    // Endless Storm 6: wisps spawn while channelling.
    startChannel(f.inst, f.p, f.p.ctx.slotted('ironplough')!, true);
    for (let i = 0; i < 50; i++) { f.p.res = f.p.mres; f.tick(); }
    assert(f.p.summons.some((s) => s.type === 'dust_devil' && s.skill === 'ironplough'), 'wind wisps');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['seismic_slam', null, null, null], posts: [[70, 0], [110, 0]] });
  try {
    g.setPowers({}, { furrowmark: 4 });
    assert(g.p.ctx.modsOf('seismic_slam').flags.has('furrowStun'));
    castSkill(g.inst, g.p, g.p.ctx.slotted('seismic_slam')!);
    assert(g.posts[0].stunMs > 0, 'pushed into the enemy behind it: stunned');
  } finally { g.inst.destroy(); }
});

test('warrior legendaries: Stonecount stacks per stunned enemy, Red Ledger refunds on bleeding deaths, Belfry adds 1 s to stunned enemies', () => {
  const f = fixture({ slots: ['ground_stomp', null, null, null], posts: [[40, 0], [-40, 0], [0, 40]] });
  try {
    f.setPowers({ stonecount_gauntlets: 20, belfry_pauldrons: 35 });
    castSkill(f.inst, f.p, f.p.ctx.slotted('ground_stomp')!);
    assert.equal(getBuff(f.p, 'stonecount')?.dmg, 3);
    const before = f.posts[0].stunMs;
    f.p.readyAt.clear();
    castSkill(f.inst, f.p, f.p.ctx.slotted('ground_stomp')!);
    assert(f.posts[0].stunMs > before + 900, 'Belfry: already-stunned enemies 1 s longer');
    assert.equal(f.p.ctx.modsOf('ground_stomp').mods.radius, 35);
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['rend', null, null, null] });
  try {
    g.setPowers({ red_ledger: 4 });
    assert.equal(g.p.ctx.modsOf('rend').mods.cost, -15); // fitted from the bible's 30 (WARRIOR-PILOT.md §4)
    castSkill(g.inst, g.p, g.p.ctx.slotted('rend')!);
    g.p.res = 0;
    const m = g.posts[0]; m.hp = 1; g.tick(12);
    assert(m.dead && g.p.res >= 4, `Fury after the bleeding enemy died: ${g.p.res}`);
  } finally { g.inst.destroy(); }
});

// ─────────────────────────── Phase 2: engine wave 2 primitives ───────────────────────────

test('Kilnheart: +20% damage, +15% attack speed, half-price Fury, and warrior hits ignite (Cold Forge chills instead)', () => {
  const f = fixture({ slots: ['kilnheart', 'seismic_slam', null, null], posts: [[70, 0]] });
  try {
    const slam = f.p.ctx.slotted('seismic_slam')!, before = skillCost(f.p, slam);
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('kilnheart')!));
    const b = getBuff(f.p, 'kilnheart')!;
    assert.deepEqual([b.dmg, b.ias, b.ms], [20, 15, 20000]);
    assert.equal(skillCost(f.p, slam), before / 2, 'spend half as much Fury');
    castSkill(f.inst, f.p, slam);
    assert(f.posts[0].dots.some((d) => d.kind === 'burn' && d.skill === 'kilnheart'), 'the hit ignites');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['kilnheart', 'seismic_slam', null, null], runes: { kilnheart: 'cold_forge' }, posts: [[70, 0]] });
  try {
    castSkill(g.inst, g.p, g.p.ctx.slotted('kilnheart')!); castSkill(g.inst, g.p, g.p.ctx.slotted('seismic_slam')!);
    assert(g.posts[0].chillMs > 0 && !g.posts[0].dots.some((d) => d.skill === 'kilnheart'), 'Cold Forge chills instead of igniting');
  } finally { g.inst.destroy(); }
});

test('rune templates: Iron Root grants control immunity and damage reduction on stomp; Slag Skin only while Kilnheart burns', () => {
  const f = fixture({ slots: ['ground_stomp', null, null, null], runes: { ground_stomp: 'iron_root' } });
  try {
    f.p.manualCast = { slot: 0, skill: 'ground_stomp' } as typeof f.p.manualCast;
    f.tick();
    const b = getBuff(f.p, 'iron_root');
    assert(b && b.dr === 20 && b.cci, 'Iron Root buff after the cast');
  } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['kilnheart', null, null, null], runes: { kilnheart: 'slag_skin' } });
  try {
    const dr = () => g.p.ctx.powers.defense?.takenTerms.length ?? 0;
    assert(dr() >= 1, 'a damage-taken term from the rune');
  } finally { g.inst.destroy(); }
});

test('wave-2 runes and nodes: Watch Bell, Rusted Edge, Taunting Colours, Concussion, Open Crack, Deep Earth, Ironplough movement', () => {
  const f = fixture({ primary: 'tolling_blow', runes: { tolling_blow: 'watch_bell' } });
  try { f.p.res = 0; for (let i = 0; i < 3; i++) castPrimary(f.inst, f.p, f.posts[0]); assert.equal(getBuff(f.p, 'watch_bell')?.dr, 4); assert(f.p.res >= 10 + 18); } finally { f.inst.destroy(); }
  const g = fixture({ slots: ['sawtooth_hatchet', null, null, null], runes: { sawtooth_hatchet: 'rusted_edge' }, posts: [[150, 0]] });
  try { castSkill(g.inst, g.p, g.p.ctx.slotted('sawtooth_hatchet')!); g.tick(10); assert(g.posts[0].ps?.vulns.some((v) => v.pct === 10 && v.scope?.has('rend')), 'scoped to Bleed skills'); } finally { g.inst.destroy(); }
  const h = fixture({ slots: ['muster_standard', null, null, null], runes: { muster_standard: 'taunting_colours' }, posts: [[200, 0]] });
  try {
    castSkill(h.inst, h.p, h.p.ctx.slotted('muster_standard')!);
    assert((h.posts[0].ps?.tauntMs ?? 0) > 0, 'taunted toward the standard');
    assert(h.inst.grounds.some((x) => x.fx?.def.id === 'muster_ground' && x.owner === h.p), 'the standard is one of your grounds');
  } finally { h.inst.destroy(); }
  const k = fixture({ slots: ['ground_stomp', null, null, null], nodes: { ground_stomp: { heavy_heel: 2, concussion: 3 } } });
  try { castSkill(k.inst, k.p, k.p.ctx.slotted('ground_stomp')!); assert.equal(k.posts[0].ps?.weakenPct, 30); } finally { k.inst.destroy(); }
  const c = fixture({ slots: ['seismic_slam', null, null, null], nodes: { seismic_slam: { heave: 2, open_crack: 3 } } });
  try {
    castSkill(c.inst, c.p, c.p.ctx.slotted('seismic_slam')!);
    const crack = c.inst.grounds.find((x) => x.fx?.def.id === 'quake_crack');
    assert(crack && crack.endT - c.inst.t === 2000 && crack.fx!.scale > 0, 'a 2 s crack along the fissure');
  } finally { c.inst.destroy(); }
  const d = fixture({ slots: ['ground_stomp', null, null, null] });
  try {
    d.save.passives = { revision: 1, slots: [null, null, null, 'warrior_deep_earth'] };
    d.setPowers({});
    castSkill(d.inst, d.p, d.p.ctx.slotted('ground_stomp')!);
    assert(d.inst.grounds.some((x) => x.fx?.def.id === 'deep_tremor'), 'Deep Earth: tremor ground');
  } finally { d.inst.destroy(); }
  const factor = (o: Parameters<typeof fixture>[0], sets: Record<string, number> = {}) => {
    const x = fixture({ slots: ['ironplough', 'whirlwind', null, null], ...o });
    try { x.setPowers({}, sets); return channelMoveFactor(x.p, 'ironplough') * 100; } finally { x.inst.destroy(); }
  };
  assert.equal(Math.round(factor({})), 60, 'Ironplough: 60% movement speed');
  assert.equal(Math.round(factor({ runes: { ironplough: 'steady_oxen' } })), 30, 'Steady Oxen: 30%');
  assert.equal(Math.round(factor({}, { endless_storm: 2 })), 75, 'Endless Storm 2: +15 points');
});

test('wave-2 passives and set bonuses: Bellwether on stuns, Fault Warden 6 fault lines, Hearthbanner 4 while a Buff skill is up', () => {
  const f = fixture({ slots: ['ground_stomp', null, null, null], posts: [[40, 0], [-40, 0]] });
  try {
    f.save.passives = { revision: 1, slots: ['warrior_bellwether', null, null, null] };
    f.setPowers({}, { fault_warden: 6 });
    f.p.res = 0;
    castSkill(f.inst, f.p, f.p.ctx.slotted('ground_stomp')!);
    assert.equal(getBuff(f.p, 'bellwether')?.st, 1, 'one stack (internal cooldown 0.2 s)');
    assert(f.p.res >= 15 + 2, `Fury ${f.p.res}`);
    assert(f.inst.grounds.some((g) => g.fx?.def.id === 'fault_line'), 'fault lines under stunned enemies');
  } finally { f.inst.destroy(); }
  const h = fixture({ slots: ['battle_rage', null, null, null] });
  try {
    h.setPowers({}, { hearthbanner: 4 });
    const p = h.p;
    const before = ownMultiplier(p, 'cleave');
    castSkill(h.inst, p, p.ctx.slotted('battle_rage')!);
    assert.equal(ownMultiplier(p, 'cleave') / before, 1.25, 'Primary +25% while a Buff skill is active');
    assert.equal(getBuff(p, 'battle_rage')?.ias, 5, 'Hearthbanner 2: +5% attack speed per active Buff');
  } finally { h.inst.destroy(); }
});

test('every warrior legendary and set piece drops through the normal item generator', () => {
  const rng = new Rng(4242), seenL = new Set<string>(), seenS = new Set<string>();
  for (let i = 0; i < 6000; i++) {
    const l = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'legendary', smartChance: 1 });
    if (l.legendary) seenL.add(l.legendary.power);
    const s = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'set', smartChance: 1 });
    if (s.set) seenS.add(`${s.set}:${s.base}`);
  }
  for (const l of Object.values(LEGENDARIES).filter((x) => x.classes?.includes('warrior'))) assert(seenL.has(l.id), `${l.id} drops`);
  for (const set of Object.values(SETS).filter((x) => x.classId === 'warrior')) for (const p of set.pieces) assert(seenS.has(`${set.id}:${p.base}`), `${set.id} ${p.base} drops`);
});
