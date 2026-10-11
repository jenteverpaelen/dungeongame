// Warrior content finished on engine wave 3 (docs/rework/depth/WARRIOR-PILOT.md §2 "blocked" list, now shipped):
// Muster Standard N4 Hold the Line, Cairnfall N3 Quarry Dust / N6 Capstone, Ironplough N6 Brace, Furrowmark 4's front
// clause, the passives Spinning Top / Grudge Holder / Iron Discipline, Deep Earth's 30 % slow, Last Rampart once per
// standard, Cinder Oath 2 / 6, Slagforged Helm and Quakestep Sabatons. Numbers are the bible's (WARRIOR.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { MONSTERS } from '../../shared/src/data/monsters';
import { ZONES } from '../../shared/src/data/zones';
import { computeStats } from '../../shared/src/stats';
import { validateContent } from '../../shared/src/contentValidation';
import { combatInteger } from '../../shared/src/combatBounds';
import type { CharacterSave, DerivedStats } from '../../shared/src/types';
import type { PlayerLink } from '../src/contracts';
import { damagePlayer, defenseMult, makeDot, strikeMob } from '../src/sim/damage';
import { addOwnedDot, getBuff } from '../src/sim/effects';
import { updateGrounds } from '../src/sim/grounds';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { powerTick } from '../src/sim/powerActions';
import { conditionCount } from '../src/sim/powerRuntime';
import { playerTick, processInputs } from '../src/sim/players';
import { castPrimary, castSkill, startChannel } from '../src/sim/skills';
import type { Mob, Player } from '../src/sim/types';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

const POST = { ...DUMMY_DEF, id: 'warrior_test_post', name: 'Post', hp: 40 };

/** As warrior.test.ts: a level-70 warrior, stationary posts, events counted, powers / sets set directly. */
function fixture(opts: { primary?: string; slots?: (string | null)[]; nodes?: Record<string, Record<string, number>>; posts?: [number, number, number?][]; passives?: (string | null)[]; runes?: Record<string, string> } = {}) {
  const save: CharacterSave = createCharacter('WarriorWave3', 'warrior', 62);
  save.level = 70;
  save.skills.slots = opts.slots ?? [null, null, null, null];
  save.skills.autoCast = ['paused', 'paused', 'paused', 'paused'];
  if (opts.primary) save.skills.primary = opts.primary;
  save.skills.runes = { ...(opts.runes ?? {}) };
  save.skills.nodes = structuredClone(opts.nodes ?? {});
  if (opts.passives) save.passives = { revision: 1, slots: opts.passives };
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'warrior3', channel: 1, seed: 79, theme: ZONES.whispering_glade.theme });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeMob(m);
  inst.addPlayer(link);
  const p = inst.players[0];
  p.debugInfiniteHp = true; p.res = p.mres; p.atkCdMs = 1e9;
  const posts = (opts.posts ?? [[60, 0]]).map(([dx, dy, tier]) => createMob(inst, POST, 70, p.x + dx, p.y + dy, { tier: (tier ?? 0) as 0 }));
  for (const m of posts) { m.hp = m.mhp = 1e12; }
  const events: { v: string; r: number }[] = [];
  const emit = inst.emit.bind(inst);
  inst.emit = ((ev: { e: string; v?: string; r?: number }, x: number, y: number, s: number) => {
    if (ev.v) events.push({ v: `${ev.e}:${ev.v}`, r: ev.r ?? 0 });
    return emit(ev as Parameters<typeof emit>[0], x, y, s);
  }) as typeof inst.emit;
  const setPowers = (powers: Record<string, number> = {}, sets: Record<string, number> = {}) => {
    const base = computeStats(save);
    const d: DerivedStats = { ...base, powers, sets, chc: 0, weaponMin: 1000, weaponMax: 1000 };
    p.ctx = buildCtx(save, d);
    p.mres = d.maxResource;
  };
  setPowers();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) { p.atkCdMs = 1e9; inst.tick(); } };
  return { inst, p, save, posts, events, setPowers, run };
}

test('warrior wave-3 content validates (texts name their numbers)', () => {
  assert.deepEqual(validateContent(), []);
});

test('Muster Standard N4 Hold the Line: enemies inside are slowed 10 / 20 / 30%, outside not', () => {
  for (const [rank, pct] of [[1, 10], [3, 30]] as const) {
    const f = fixture({ slots: ['muster_standard', null, null, null], nodes: { muster_standard: { wide_muster: 2, hold_the_line: rank } }, posts: [[60, 0], [700, 0]] });
    try {
      assert(castSkill(f.inst, f.p, f.p.ctx.slotted('muster_standard')!));
      const [inside, outside] = f.posts;
      assert.equal(inside.ps?.slowPct, pct, `rank ${rank}`);
      assert(!outside.ps || outside.ps.slowMs <= 0, 'outside the standard');
      inside.x += 1000; f.inst.mobHash.update(inside);
      f.run(500);
      assert(inside.ps!.slowMs <= 0, 'the slow ends shortly after leaving');
    } finally { f.inst.destroy(); }
  }
});

test('Cairnfall N3 Quarry Dust slows hit enemies 50% for 3 s; N6 Capstone: the last cairn is a giant (radius ×2, 50% more)', () => {
  const f = fixture({ slots: ['cairnfall', null, null, null], nodes: { cairnfall: { quarry_dust: 3, capstone: 3 } }, posts: [[100, 0]] });
  try {
    assert(castSkill(f.inst, f.p, f.p.ctx.slotted('cairnfall')!));
    const tele = f.events.filter((e) => e.v === 'tele:cairn').map((e) => e.r);
    assert.equal(tele.length, 5);
    assert.deepEqual(tele.slice(0, 4).map((r) => r * 2), [tele[4], tele[4], tele[4], tele[4]], 'the fifth cairn has twice the radius');
    f.run(1300);
    const m = f.posts[0];
    assert.equal(m.ps?.slowPct, 50); assert(m.ps!.slowMs > 1500 && m.ps!.slowMs <= 3000, 'slowed for 3 s');
  } finally { f.inst.destroy(); }
  // The giant's 50% more damage. Scree Line drops the cairns in a line (60 … 300 units): a post at 300 is hit by the
  // fourth and the fifth (last) cairn, so with Capstone it takes 1 + 1.5 instead of 1 + 1 cairns.
  const dmg = (capstone: number) => {
    const g = fixture({ slots: ['cairnfall', null, null, null], runes: { cairnfall: 'scree_line' }, nodes: { cairnfall: capstone ? { quarry_dust: 2, capstone } : { quarry_dust: 2 } }, posts: [[300, 0]] });
    try { castSkill(g.inst, g.p, g.p.ctx.slotted('cairnfall')!); g.run(1300); return g.posts[0].mhp - g.posts[0].hp; } finally { g.inst.destroy(); }
  };
  const plain = dmg(0), giant = dmg(1);
  assert(Math.abs(giant / plain - 1.25) < 1e-6, `two cairns, the last 50% stronger (${plain} → ${giant})`);
});

test('Ironplough N6 Brace: at full ramp, damage from enemies in front of the plough −30%, behind unchanged', () => {
  const f = fixture({ slots: ['ironplough', null, null, null], nodes: { ironplough: { patient_draft: 2, brace: 3 } }, posts: [[80, 0], [-80, 0]] });
  try {
    const { p, inst } = f;
    p.debugInfiniteHp = false; p.invulnMs = 0;
    const [front, back] = f.posts;
    startChannel(inst, p, p.ctx.slotted('ironplough')!, true);
    const base = defenseMult(p, 70, false), raw = p.mhp * 0.01 / base;
    const hit = (m: Mob) => { p.hp = p.mhp; return damagePlayer(inst, p, raw, 'physical', m, 70); };
    f.run(500);
    assert.equal(hit(front), combatInteger(raw * base), 'not at full ramp yet');
    f.run(2200);
    assert(getBuff(p, 'plough_brace'), 'full ramp');
    assert.equal(p.channel?.aim !== undefined, true, 'the plough aims');
    const ahead = Math.abs(Math.cos(p.channel!.aim!)) > 0.5 && Math.cos(p.channel!.aim!) > 0 ? front : back;
    const behind = ahead === front ? back : front;
    assert.equal(hit(ahead), combatInteger(raw * (base * 0.7)), 'in front of the plough: −30%');
    assert.equal(hit(behind), combatInteger(raw * base), 'behind: unchanged');
  } finally { f.inst.destroy(); }
});

test('Furrowmark 4: while channelling, damage from enemies in front −30%', () => {
  const f = fixture({ slots: ['whirlwind', null, null, null], posts: [[80, 0], [-80, 0]] });
  try {
    const { p, inst } = f;
    f.setPowers({}, { furrowmark: 4 });
    p.debugInfiniteHp = false; p.invulnMs = 0; p.mv.faceX = 1; p.mv.faceY = 0;
    const base = defenseMult(p, 70, false), raw = p.mhp * 0.01 / base;
    const hit = (m: Mob) => { p.hp = p.mhp; return damagePlayer(inst, p, raw, 'physical', m, 70); };
    assert.equal(hit(f.posts[0]), combatInteger(raw * base), 'not channelling');
    startChannel(inst, p, p.ctx.slotted('whirlwind')!, true);
    const ww = defenseMult(p, 70, false);
    assert.equal(hit(f.posts[0]), combatInteger(raw * (ww * 0.7)), 'channelling, attacker in front');
    assert.equal(hit(f.posts[1]), combatInteger(raw * ww), 'attacker behind');
  } finally { f.inst.destroy(); }
});

test('passives: Spinning Top, Grudge Holder, Iron Discipline, Deep Earth slows 30%', () => {
  const top = fixture({ slots: ['whirlwind', null, null, null], passives: ['warrior_spinning_top', null, null, null] });
  try {
    const { p, inst } = top;
    p.save.level = 70;
    const ms0 = p.ctx.d.ms;
    startChannel(inst, p, p.ctx.slotted('whirlwind')!, true);
    for (let i = 0; i < 60; i++) { p.res = p.mres; inst.t += 50; powerTick(inst, p, 50); }
    assert.equal(getBuff(p, 'spinning_top')?.st, 3, '3 s of channelling');
    assert.equal(getBuff(p, 'spinning_top')?.sdmg, 4);
    assert.equal(p.live.mv, 9, '3 × 3% movement speed');
    void ms0;
  } finally { top.inst.destroy(); }

  const grudge = fixture({ posts: [[80, 0, 1], [-80, 0, 1], [0, 80]], passives: [null, null, 'warrior_grudge_holder', null] });
  try {
    const { p, inst } = grudge;
    p.debugInfiniteHp = false; p.invulnMs = 0;
    const [elite, elite2, normal] = grudge.posts;
    const raw = 10;
    damagePlayer(inst, p, raw, 'physical', normal, 70);
    assert(!normal.markMs, 'a normal monster is not marked');
    damagePlayer(inst, p, raw, 'physical', elite, 70);
    assert(elite.markMs >= 5900, 'the first elite is Marked for 6 s');
    assert.equal(elite.ps?.vulns.find((v) => v.owner === p.id)?.pct, 15, '15% more damage from you');
    damagePlayer(inst, p, raw, 'physical', elite2, 70);
    assert(!elite2.markMs, 'once every 10 s');
    inst.t += 10000;
    damagePlayer(inst, p, raw, 'physical', elite2, 70);
    assert(elite2.markMs > 0, 'ready again after 10 s');
  } finally { grudge.inst.destroy(); }

  const iron = fixture({ passives: [null, null, null, 'warrior_iron_discipline'] }), plain = fixture();
  try {
    assert.equal(iron.p.mres, plain.p.mres + 20, 'maximum Fury +20');
    for (const f of [iron, plain]) { f.p.res = 50; f.p.sinceHitMs = 1e6; for (let i = 0; i < 40; i++) playerTick(f.inst, f.p, 50); }
    assert.equal(iron.p.res, 50, 'no decay'); assert(plain.p.res < 50);
    for (const f of [iron, plain]) { f.p.res = 0; f.p.atkCdMs = 0; castPrimary(f.inst, f.p, f.posts[0]); }
    assert(plain.p.res > 0 && Math.abs(iron.p.res / plain.p.res - 0.85) < 1e-9, `Primary Fury −15% (${iron.p.res} vs ${plain.p.res})`);
  } finally { iron.inst.destroy(); plain.inst.destroy(); }

  const deep = fixture({ slots: ['ground_stomp', null, null, null], passives: [null, null, null, 'warrior_deep_earth'], posts: [[60, 0]] });
  try {
    castSkill(deep.inst, deep.p, deep.p.ctx.slotted('ground_stomp')!);
    const m = deep.posts[0];
    m.stunMs = 0;
    deep.inst.t += 500; updateGrounds(deep.inst, 500);
    assert.equal(m.ps?.slowPct, 30, 'tremor ground slows 30%');
    assert.equal(conditionCount(deep.p, { targetState: 'slowed' }, undefined, m), 1);
  } finally { deep.inst.destroy(); }
});

test('Last Rampart: once per standard, 1 Life and 2 s invulnerable; planting a standard re-arms it', () => {
  const f = fixture({ slots: ['muster_standard', null, null, null], runes: { muster_standard: 'last_rampart' }, posts: [[60, 0]] });
  try {
    const { p, inst } = f;
    p.debugInfiniteHp = false; p.invulnMs = 0;
    const kill = () => damagePlayer(inst, p, p.mhp * 100, 'physical', f.posts[0], 70);
    assert(castSkill(inst, p, p.ctx.slotted('muster_standard')!));
    f.run(300);
    assert(getBuff(p, 'muster_standard'), 'inside the standard');
    kill();
    assert.equal(p.deadMs, 0); assert.equal(p.hp, 1); assert.equal(p.invulnMs, 2000);
    p.invulnMs = 0; f.run(100);
    assert(getBuff(p, 'muster_standard'), 'still inside the same standard');
    kill();
    assert(p.deadMs > 0, 'once per standard: the second fatal hit kills');
    p.deadMs = 0; p.hp = p.mhp; p.invulnMs = 0;
    assert(castSkill(inst, p, p.ctx.slotted('muster_standard')!), 'plant a new standard');
    f.run(300);
    kill();
    assert.equal(p.deadMs, 0, 're-armed by the new standard'); assert.equal(p.hp, 1);
  } finally { f.inst.destroy(); }
});

test('Cinder Oath 2: Bleeds also Burn (Fire, both states, Bleed skills are Burn skills); 6: cinder pools carry the strongest dot at 50%', () => {
  const f = fixture({ slots: ['rend', null, null, null], posts: [[60, 0], [90, 0]] });
  try {
    const { p, inst } = f;
    f.setPowers({}, { cinder_oath: 6 });
    assert(p.ctx.powers.index.get('rend')?.has('burn'), 'Rend counts as a Burn skill');
    const [a, b] = f.posts;
    addOwnedDot(p, a, makeDot(inst, p, { skill: 'rend', coef: 1, el: 'physical', pct: 0 }, 'bleed', 4000, 500));
    const d = a.dots[0];
    assert.equal(d.el, 'fire'); assert.equal(d.also, 'burn');
    assert.equal(conditionCount(p, { targetState: 'burning' }, undefined, a), 1);
    a.hp = 1; strikeMob(inst, p, a, { skill: 'cleave', coef: 1, el: 'physical', pct: 0 });
    assert(a.dead);
    const pool = inst.grounds.find((g) => g.fx?.def.id === 'cinder_pool');
    assert(pool, 'a cinder pool where it died');
    inst.t += 50; updateGrounds(inst, 50);
    const got = b.dots.find((x) => x.kind === 'bleed' && x.owner === p.id);
    assert(got && got.perTick === d.perTick * 0.5, 'the enemy in the pool caught the Bleed at 50%');
  } finally { f.inst.destroy(); }
});

test('Slagforged Helm: Buff cooldowns shorter; below 35% Life the ready Buff with the longest cooldown activates', () => {
  const f = fixture({ slots: ['battle_rage', 'muster_standard', null, null], posts: [[60, 0]] });
  try {
    const { p, inst } = f;
    f.setPowers({ slagforged_helm: 25 });
    p.debugInfiniteHp = false; p.invulnMs = 0;
    p.hp = p.mhp * 0.4;
    damagePlayer(inst, p, p.mhp * 0.1 / defenseMult(p, 70, false), 'physical', f.posts[0], 70);
    assert(p.hp < p.mhp * 0.35);
    const cd = (p.readyAt.get('muster_standard') ?? 0) - inst.t;
    assert.equal(cd, 20000 * 0.75, 'Muster Standard planted for free; its cooldown 25% shorter');
    assert(f.events.some((e) => e.v === 'aoe:standard'), 'the standard was planted');
  } finally { f.inst.destroy(); }
});

test('Quakestep Sabatons: when the dash ends, stun and damage within 120 units of the landing point, once per 3 s', () => {
  const f = fixture({ posts: [[260, 0], [-300, 0]] });
  try {
    const { p, inst } = f;
    f.setPowers({ quakestep_sabatons: 70 });
    const [ahead, away] = f.posts;
    p.inQ.push({ seq: 1, mx: 1, my: 0, dash: true } as never);
    for (let i = 0; i < 20 && (i === 0 || p.mv.dashMs > 0); i++) { processInputs(inst, p); p.inQ.push({ seq: i + 2, mx: 0, my: 0, dash: false } as never); }
    const near = Math.hypot(ahead.x - p.x, ahead.y - p.y) <= 120 + ahead.r;
    assert(near, `landed next to the post (${Math.round(Math.hypot(ahead.x - p.x, ahead.y - p.y))} units)`);
    assert(ahead.stunMs > 0 && ahead.hp < ahead.mhp, 'stunned and hit');
    assert(!(away.stunMs > 0), 'far away: untouched');
  } finally { f.inst.destroy(); }
});
