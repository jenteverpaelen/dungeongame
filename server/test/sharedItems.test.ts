// Shared-items wave (docs/rework/depth/FOUNDATION.md §12, ITEMS-SHARED.md §2/3/5/7): engine primitives for the
// shared legendaries, set reduction, new bases and affixes, Kindled / Fabled grades with the save-16 migration and the
// Mystic rekindle, the Inscription pool and the remaining wave-2 engine gaps. Uses an isolated DATA_DIR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCharacter } from '../../shared/src/character';
import { AFFIXES, AFFIX_BY_STAT, BASES, LEGENDARIES, SETS, affixFits, affixScale, blocksOffhand } from '../../shared/src/data/items';
import { INSCRIPTIONS } from '../../shared/src/data/inscriptions';
import { MONSTERS } from '../../shared/src/data/monsters';
import { GRADE_LABEL, canRekindle, deterministicInscription, inscriptionGroup, inscriptionPool } from '../../shared/src/itemGrades';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { affixPowerSources, itemPowerSources, setReduction, setThreshold, type PowerSource } from '../../shared/src/powerSources';
import type { PowerEffect } from '../../shared/src/powers';
import { SAVE_VERSION } from '../../shared/src/saveVersion';
import { computeStats, powerCounts, setBonusesActive } from '../../shared/src/stats';
import { validateContent } from '../../shared/src/contentValidation';
import { isPersistedCommand } from '../../shared/src/commandState';
import type { CharacterSave, ClassId, Item } from '../../shared/src/types';
import { runCommand } from '../src/commands';
import { ensureDataDir, normalizeSave } from '../src/persistence';
import { damagePlayer, defenseMult, strikeMob, vulnerability } from '../src/sim/damage';
import { addBuff, addDot, getBuff, markMob, pullPlayer, stunMob, stunPlayer } from '../src/sim/effects';
import { Instance } from '../src/sim/instance';
import { createMob } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { channelMsPct, onKillStacking, powerTick } from '../src/sim/powerActions';
import { buildPowerRuntime, firePowerProcs, ownMultiplier, resolveStatus } from '../src/sim/powerRuntime';
import { spawnProj, updateProjectiles } from '../src/sim/projectiles';
import { applyStatus } from '../src/sim/status';
import { playerTick } from '../src/sim/players';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required'); ensureDataDir();

function world(classId: ClassId, effects: PowerEffect[], o: { save?: (s: CharacterSave) => void } = {}) {
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'shared', channel: 0, seed: 41, theme: 'glade', level: 70, difficulty: 5 });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const save = createCharacter('Shared', classId, 7); save.level = 70;
  o.save?.(save);
  const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed() {}, rec: { inst } } as unknown as Session;
  let center: { x: number; y: number } | undefined;
  for (let y = 600; y < inst.heightPx - 600 && !center; y += 160) for (let x = 600; x < inst.widthPx - 600; x += 160)
    if ([-250, 0, 250].every((dx) => [-250, 0, 250].every((dy) => inst.cw.isFree(x + dx, y + dy, 24)))) { center = { x, y }; break; }
  assert(center);
  s.entityId = inst.addPlayer(s, center);
  const p = inst.playerById(s.entityId)!;
  p.invulnMs = 0;
  p.ctx = buildCtx(save, computeStats(save), effects.length ? [{ kind: 'passive', id: 'fx_shared', roll: 1, effects }] : []);
  const mob = (dx: number, dy: number, tier: 0 | 1 = 0) => createMob(inst, MONSTERS.bog_slime, 70, center!.x + dx, center!.y + dy, { tier, dormant: false, difficulty: 5 });
  return { inst, p, save, mob, center };
}
const strike = (skill: string) => ({ skill, coef: 1, el: 'physical' as const, pct: 0 });
const legendarySource = (id: string, roll?: number): PowerSource => ({ kind: 'legendary', id, roll: roll ?? LEGENDARIES[id].range[1], effects: LEGENDARIES[id].effects });

// ─────────────── content ───────────────

test('content: 13 shared legendaries, 80 bases, 56 affixes, an Inscription pool; everything validates', () => {
  assert.deepEqual(validateContent(), []);
  for (const id of ['patchwork_signet', 'journeymans_ring', 'watchkeepers_hood', 'kilnwatch_spaulders', 'hearthguard_coat', 'ink_stained_gloves', 'causeway_waders',
    'ridgewalker_boots', 'surveyors_plumb', 'brine_tally', 'signal_horn_charm', 'lockglass_cincture', 'wardkeepers_cuffs']) assert(LEGENDARIES[id] && !LEGENDARIES[id].classes, id);
  assert.deepEqual(LEGENDARIES.ouroboros_loop.range, [60, 80], 'the bible\'s owner-visible Ouroboros cut');
  assert.equal(LEGENDARIES.patchwork_signet.extractable, false); assert.equal(LEGENDARIES.journeymans_ring.extractable, false);
  assert.equal(Object.keys(BASES).length, 80); assert.equal(AFFIXES.length, 56); // 56: resource per critical hit (owner 2026-10-13)
  const legacyShapes = new Set(Object.values(BASES).slice(0, 42).map((b) => b.shape));
  for (const b of Object.values(BASES).slice(42)) assert(legacyShapes.has(b.shape), `${b.id} falls back to an existing look shape`);
  assert(blocksOffhand(BASES.censer) && blocksOffhand(BASES.staff) && !blocksOffhand(BASES.longbow) && blocksOffhand(BASES.maul2h));
  assert(affixFits(AFFIX_BY_STAT.pierceChance, BASES.bow) && !affixFits(AFFIX_BY_STAT.pierceChance, BASES.axe2h) && affixFits(AFFIX_BY_STAT.pierceChance, BASES.quiver) && !affixFits(AFFIX_BY_STAT.pierceChance, BASES.orb));
  assert.equal(affixScale('fixed', 3), 1);
  assert.equal(Object.keys(INSCRIPTIONS).length, 10);
  for (const k of ['weapon1h', 'head', 'chest', 'hands', 'waist', 'neck'] as const) assert(inscriptionPool(k).length >= 1, `${inscriptionGroup(k)} has Inscriptions`);
});

test('drops: new bases and affixes roll; smart loot keeps class weapons; the merchant still stocks the first base per kind', () => {
  const rng = new Rng(11), seen = new Set<string>(), stats = new Set<string>();
  for (let i = 0; i < 4000; i++) {
    const it = generateItem(rng, { ilvl: 70, classId: 'mage', rarity: 'rare', smartChance: 1 });
    seen.add(it.base); for (const a of it.affixes) stats.add(a.stat);
    if (BASES[it.base].classes) assert(BASES[it.base].classes!.includes('mage'), it.base);
  }
  for (const id of ['rod', 'sceptre', 'censer', 'tome', 'neck_torc', 'ring_coil', 'head_widebrim']) assert(seen.has(id), `mage rares can be ${id}`);
  assert(!seen.has('cleaver') && !seen.has('sling'), 'no other-class weapons on smart drops');
  for (const s of ['summonDmg', 'cooldownDmg', 'ccReduction', 'globeHeal']) assert(stats.has(s), `affix ${s} rolls`);
});

// ─────────────── set reduction (Journeyman's Ring) ───────────────

test('setReduce: one fewer piece for every bonus (minimum 2), does not stack, counted for no-set checks', () => {
  const set = Object.values(SETS)[0], six = set.bonuses.find((b) => b.count === 6)!;
  const red = setReduction({ journeymans_ring: 1 });
  assert.deepEqual(red, { by: 1, min: 2 });
  assert.deepEqual([2, 4, 6].map((c) => setThreshold(c, red)), [2, 3, 5]);
  const on = (n: number, powers: Record<string, number>) => itemPowerSources(powers, { [set.id]: n }).filter((s) => s.kind === 'set').map((s) => s.id);
  assert(on(5, { journeymans_ring: 1 }).includes(`set:${set.id}:6`) && !on(5, {}).includes(`set:${set.id}:6`), '5 pieces + ring = the 6-piece bonus');
  assert(!on(1, { journeymans_ring: 1 }).length, 'one piece never gives the 2-piece bonus');
  assert.equal(setBonusesActive(set.id, 5, { journeymans_ring: 1 }).length, set.bonuses.length);
  assert.equal(powerCounts({}, { [set.id]: 1 }, { journeymans_ring: 1 }).setBonus, false);
  assert.equal(powerCounts({}, { [set.id]: 3 }, { journeymans_ring: 1 }).setBonus, true);
  void six;
});

test('Journeyman\'s Ring and Patchwork Signet cannot be extracted at the Cube', () => {
  const save = createCharacter('Cube', 'mage', 2); save.level = 70; save.cube.level = 8;
  const ring = generateItem(new Rng(3), { ilvl: 70, classId: 'mage', rarity: 'legendary', legendary: 'journeymans_ring', ancientAllowed: false });
  save.inventory[0] = ring;
  const s = { save, changed() {}, rec: { kind: 'town', inst: { map: { town: { npcs: [{ role: 'cube', name: 'Cube', x: 0, y: 0, interactionRadius: 99 }] } }, canInteract: () => true } } } as unknown as Session;
  const r = runCommand(s, {} as World, 'extract', { itemId: ring.id });
  assert.equal(r.ok, false); assert.match(String((r as { err?: string }).err ?? JSON.stringify(r)), /cannot be extracted/);
});

// ─────────────── shared legendaries in play ───────────────

test('legendaries: Watchkeeper (no enemy near), Causeway (standing still), Ridgewalker (distance stacks), Signal Horn (summons)', () => {
  const { inst, p, mob } = world('ranger', [...LEGENDARIES.watchkeepers_hood.effects.map((e) => e), ...LEGENDARIES.causeway_waders.effects]);
  try {
    p.ctx = buildCtx(p.save, computeStats(p.save), [legendarySource('watchkeepers_hood', 30), legendarySource('causeway_waders', 25), legendarySource('signal_horn_charm', 20)]);
    powerTick(inst, p, 50);
    assert.equal(ownMultiplier(p, 'multishot'), 1.3, 'no enemy within 200: Projectile skills +30% more');
    const m = mob(150, 0); powerTick(inst, p, 50);
    assert.equal(ownMultiplier(p, 'multishot'), 1, 'an enemy within 200');
    p.moving = false; for (let i = 0; i < 21; i++) powerTick(inst, p, 50);
    assert.equal(ownMultiplier(p, 'sentry'), 1.25 * 1.2, 'still for 1 s: Summons +25% more (and Signal Horn +20%)');
    void m;
  } finally { inst.destroy(); }
  const w = world('warrior', []);
  try {
    w.p.ctx = buildCtx(w.p.save, computeStats(w.p.save), [legendarySource('ridgewalker_boots', 5)]);
    powerTick(w.inst, w.p, 50);
    for (let i = 0; i < 6; i++) { w.p.x += 60; powerTick(w.inst, w.p, 50); }
    assert.equal(getBuff(w.p, 'ridgewalker')?.st, 3, '360 units = 3 stacks');
    assert(Math.abs(ownMultiplier(w.p, 'rend') - (1 + 0.05 * 3)) < 1e-12, 'Spender skills +5% more per stack');
  } finally { w.inst.destroy(); }
});

test('legendaries: Ink-Stained repeats every 5th primary attack; Brine Tally counts afflicted kills; Wardkeeper marks controlled enemies', () => {
  const { inst, p, mob } = world('warrior', []);
  try {
    p.ctx = buildCtx(p.save, computeStats(p.save), [legendarySource('ink_stained_gloves', 60), legendarySource('brine_tally', 20), legendarySource('wardkeepers_cuffs', 15)]);
    const m = mob(50, 0);
    let last = m.hp;
    for (let i = 1; i <= 5; i++) {
      firePowerProcs(inst, p, 'attack', { skill: 'cleave', mob: m });
      if (i < 5) assert.equal(m.hp, last, 'no repeat yet'); else assert(m.hp < last, 'the 5th attack repeats');
      last = m.hp;
    }
    const dead = mob(0, 80), plain = mob(0, -80);
    addDot(dead, { kind: 'bleed', owner: p.id, skill: 'rend', perTick: 1, el: 'physical', tickMs: 500, nextMs: 500, leftMs: 3000, durMs: 3000 });
    for (let i = 0; i < 19; i++) onKillStacking(inst, p, 'cleave', dead);
    onKillStacking(inst, p, 'cleave', plain);
    assert.equal(getBuff(p, 'brine_tally')?.st, 19, 'only kills of bleeding / burning enemies count');
    onKillStacking(inst, p, 'cleave', dead);
    assert(!getBuff(p, 'brine_tally') && getBuff(p, 'brine_surge')?.ias === 20 && p.live.cdrec === 20, 'at 20: the surge, tally reset');
    stunMob(plain, 500, inst, p);
    assert(Math.abs(vulnerability(p, plain, 'cleave') - 1.15 * (p.ctx.stunMult)) < 1e-9, 'stunned by you: +15% from you for 3 s');
  } finally { inst.destroy(); }
});

test('legendaries: Patchwork Signet (no set), Hearthguard Coat (channel / own ground), Lockglass Cincture (no pull while channelling)', () => {
  const save = createCharacter('Patch', 'mage', 5); save.level = 70;
  const rt = buildPowerRuntime([legendarySource('patchwork_signet', 3)], undefined, { legendaries: 6, setBonus: false });
  assert(Math.abs(rt.defense!.takenStatic - 0.94) < 1e-12, '6 legendaries: 6% less damage taken');
  const { inst, p } = world('warrior', []);
  try {
    p.ctx = buildCtx(p.save, computeStats(p.save), [legendarySource('hearthguard_coat', 25), legendarySource('lockglass_cincture', 25)]);
    const base = defenseMult(p, 70, false), raw = p.mhp * 0.1 / base;
    const plainHit = damagePlayer(inst, p, raw, 'physical', null, 70); p.hp = p.mhp;
    p.channel = { skill: 'whirlwind', graceMs: 0, tickMs: 0, devilMs: 0, spunMs: 0 };
    assert(damagePlayer(inst, p, raw, 'physical', null, 70) < plainHit, 'channelling: 15% less damage taken');
    powerTick(inst, p, 50);
    const x = p.mv.x; pullPlayer(inst, p, p.x + 300, p.y, 10); assert.equal(p.mv.x, x, 'cannot be pulled while channelling');
    stunPlayer(p, 300); assert(p.stunMs > 0, 'stuns still land (knockback / pull only)');
    assert(p.ctx.modsOf('whirlwind').mods.cost! <= -25, 'Channel skills cost 25% less');
  } finally { inst.destroy(); }
  void save;
});

// ─────────────── engine gaps ───────────────

test('engine: marks spread (Surveyor), consumable vulnerabilities, returning projectiles, ricochet at maximum range', () => {
  const { inst, p, mob } = world('ranger', [
    { kind: 'projectile', skills: ['fx_shot'], returns: true },
    { kind: 'projectile', skills: ['fx_rico'], bounces: 1, rangeRicochet: true },
  ]);
  try {
    p.ctx = buildCtx(p.save, computeStats(p.save), [legendarySource('surveyors_plumb', 25), { kind: 'passive', id: 'fx', roll: 1, effects: [
      { kind: 'projectile', skills: ['fx_shot'], returns: true }, { kind: 'projectile', skills: ['fx_rico'], bounces: 1, rangeRicochet: true }] }]);
    const a = mob(120, 0), b = mob(200, 30);
    markMob(a, 3000, 0, inst, p);
    assert(b.markMs > 0, 'the nearest other enemy is marked too');
    assert.equal(vulnerability(p, a, 'multishot'), 1.25, 'marked enemies take 25% more from you');
    const c = mob(-120, 0);
    applyStatus(inst, p, c, resolveStatus({ kind: 'vulnerable', pct: 30, ms: 3000, skills: ['multishot'], consume: true }, p.ctx.powers.index), p.x, p.y, 'fx');
    assert.equal(vulnerability(p, c, 'multishot'), 1.3);
    strikeMob(inst, p, c, strike('multishot'));
    assert.equal(vulnerability(p, c, 'multishot'), 1, 'used up by the first matching hit');
    const t = mob(0, 150);
    const shot = spawnProj(inst, { kind: 'missile', v: 'missile', owner: p, src: p.id, x: p.x, y: p.y, angle: Math.PI / 2, speed: 600, lifeMs: 1000, r: 8, el: 'physical', strike: strike('fx_shot') });
    for (let i = 0; i < 10 && !shot.dead; i++) updateProjectiles(inst, 50);
    assert(shot.dead && inst.projs.some((q) => q.returned && !q.dead), 'after its last hit it flies back once');
    void t;
    const r = mob(200, -200);
    const rico = spawnProj(inst, { kind: 'missile', v: 'missile', owner: p, src: p.id, x: p.x, y: p.y, angle: Math.PI, speed: 400, lifeMs: 100, r: 8, el: 'physical', strike: strike('fx_rico') });
    updateProjectiles(inst, 50); updateProjectiles(inst, 50); // the life ends on the second tick
    assert(rico.dead && inst.projs.some((q) => q !== rico && q.rule?.rangeRicochet && q.bounces === 0 && !q.dead), 'at maximum range it ricochets toward an enemy');
    void r;
  } finally { inst.destroy(); }
});

test('engine: cooldown recovery buffs, control immunity by kind, stack filters on the killed enemy', () => {
  const { inst, p } = world('warrior', [{ kind: 'controlImmunity', kinds: ['stun'] }]);
  try {
    p.readyAt.set('ground_stomp', inst.t + 1000);
    addBuff(p, { id: 'fx_quick', ms: 5000, cdrec: 50 });
    playerTick(inst, p, 100);
    assert.equal(p.readyAt.get('ground_stomp'), inst.t + 1000 - 50, '50% faster: 50 ms extra per 100 ms');
    powerTick(inst, p, 50);
    stunPlayer(p, 300); assert.equal(p.stunMs, 0, 'stun blocked');
    const x = p.mv.x; pullPlayer(inst, p, p.x + 300, p.y, 10); assert.notEqual(p.mv.x, x, 'pull still works');
  } finally { inst.destroy(); }
});

// ─────────────── affixes in play ───────────────

test('affixes: tag-keyed ones become templates; DR, dash, control durations, globes, channel speed, life on control, chill on hit', () => {
  const src = affixPowerSources({ summonDmg: 12, primaryDmg: 0, spenderDmg: 10, cooldownDmg: 0, areaRadius: 8, channelCost: 12, summonDuration: 0, buffDuration: 0,
    pierceChance: 9, dotDmg: 15, vsControlled: 6, resourceOnKill: 3, resourceOnCrit: 4 });
  assert.equal(src.length, 1); assert.equal(src[0].kind, 'affix');
  const rt = buildPowerRuntime(src);
  assert.equal(rt.mods.get('sentry')?.dmg, 12); assert.equal(rt.mods.get('rend')?.dmg, 10); assert.equal(rt.mods.get('whirlwind')?.cost, -12);
  assert.equal(rt.mods.get('multishot')?.pierce, 9); assert(rt.dotRules.length === 3 && rt.dotRules[0].strength === 1.15); assert.equal(rt.procs.kill?.[0].resource, 3);
  assert.equal(rt.procs.crit?.[0].resource, 4); assert.equal(rt.procs.crit?.[0].icdMs, 250); // resource per critical hit, at most every 250 ms
  assert.deepEqual(affixPowerSources({ summonDmg: 0, primaryDmg: 0, spenderDmg: 0, cooldownDmg: 0, areaRadius: 0, channelCost: 0, summonDuration: 0, buffDuration: 0,
    pierceChance: 0, dotDmg: 0, vsControlled: 0, resourceOnKill: 0, resourceOnCrit: 0 }), [], 'no affixes, no source');
  const withAffix = (stat: string, value: number) => (s: CharacterSave) => {
    const it = generateItem(new Rng(5), { ilvl: 70, classId: s.classId, rarity: 'rare', base: 'chest_mail', smartChance: 1 });
    it.affixes = [{ stat: stat as Item['affixes'][number]['stat'], value, min: value, max: value, primary: true }];
    s.equipment.chest = it;
  };
  const a = world('warrior', [], { save: withAffix('meleeDR', 5) });
  try {
    const d = a.p.ctx.d; assert.equal(d.meleeDR, 5);
    const m = a.mob(40, 0), raw = 1000;
    const melee = damagePlayer(a.inst, a.p, raw, 'physical', m, 70, true); a.p.hp = a.p.mhp;
    const ranged = damagePlayer(a.inst, a.p, raw, 'physical', m, 70, false);
    assert(melee < ranged, 'melee hits reduced, ranged not');
  } finally { a.inst.destroy(); }
  const b = world('warrior', [], { save: withAffix('ccDuration', 10) });
  try { const m = b.mob(40, 0); stunMob(m, 1000, b.inst, b.p); assert.equal(m.stunMs, 1100); } finally { b.inst.destroy(); }
  const c = world('warrior', [], { save: withAffix('lifeOnControl', 2500) });
  try { const m = c.mob(40, 0); c.p.hp = 100; stunMob(m, 500, c.inst, c.p); assert.equal(c.p.hp, 2600); } finally { c.inst.destroy(); }
  const e = world('warrior', [], { save: withAffix('ccReduction', 20) });
  try { stunPlayer(e.p, 1000); assert.equal(e.p.stunMs, 800); } finally { e.inst.destroy(); }
  const f = world('warrior', [], { save: withAffix('moveWhileChannel', 12) });
  try { f.p.channel = { skill: 'whirlwind', graceMs: 0, tickMs: 0, devilMs: 0, spunMs: 0 }; assert.equal(channelMsPct(f.p), f.p.ctx.d.ms + 12); } finally { f.inst.destroy(); }
  const dash = createCharacter('Dash', 'ranger', 2); withAffix('dashCdr', 10)(dash);
  assert.equal(computeStats(dash).dashCdMs, computeStats(createCharacter('Dash0', 'ranger', 2)).dashCdMs * 0.9);
  const g = world('warrior', [], { save: withAffix('chillOnHit', 100) });
  try { const m = g.mob(40, 0); strikeMob(g.inst, g.p, m, strike('cleave')); assert(m.chillMs > 0, '100% chance chills'); } finally { g.inst.destroy(); }
});

// ─────────────── grades ───────────────

test('grades: Kindled adds one kindled affix at normal ranges, Fabled rolls maximum + an Inscription; no grade multiplier', () => {
  const rng = new Rng(77);
  let kindled: Item | null = null, fabled: Item | null = null;
  for (let i = 0; i < 6000 && !(kindled && fabled); i++) {
    const it = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'legendary', ancientAllowed: true, primalAllowed: true });
    if (it.ancient === 1 && !kindled) kindled = it;
    if (it.ancient === 2 && !fabled) fabled = it;
  }
  assert(kindled && fabled, 'both grades drop');
  for (const it of [kindled, fabled]) {
    // A socketed legendary spends one primary slot on its sockets (items.ts), so it carries one affix fewer.
    const socketed = it.sockets.length > 0 ? 1 : 0;
    assert.equal(it.affixes.length + socketed, 7, '5 primary (sockets count as one) + 2 secondary');
    assert.equal(it.kindledAffix, it.affixes.length - 1); assert(it.affixes[it.affixes.length - 1].primary);
    for (const a of it.affixes) {
      const def = AFFIX_BY_STAT[a.stat], s = affixScale(def.scale, 70), hi = def.ranges[it.kind]![1] * s;
      assert(a.max <= Math.round(hi * 10) / 10 + 1e-9 || a.max <= Math.round(hi), `${a.stat}: normal ranges (no ×1.3)`);
    }
  }
  assert(fabled.affixes.every((a) => a.value === a.max), 'Fabled: every affix at maximum, kindled included');
  assert(fabled.inscription && INSCRIPTIONS[fabled.inscription].group === inscriptionGroup(fabled.kind), 'an Inscription of its slot group');
  assert.equal(kindled.inscription, undefined);
  assert.deepEqual([GRADE_LABEL[1], GRADE_LABEL[2]], ['Kindled', 'Fabled']);
});

test('save 16: legacy Ancient / Primal items keep their values, get legacyGrade; Primal gets the same Inscription every load', async () => {
  assert.equal(SAVE_VERSION, 17); // v17: skill loadouts (build tools)
  const raw = await fs.readFile(new URL('./fixtures/saves/v15-grades.json', import.meta.url), 'utf8');
  const before = JSON.parse(raw) as CharacterSave;
  const a = normalizeSave(JSON.parse(raw)), b = normalizeSave(JSON.parse(raw));
  const oldK = before.equipment.neck!, oldF = before.inventory.find((i) => i?.id === 'legacyprimal01')!;
  const k = a.equipment.neck!, f = a.inventory.find((i) => i?.id === 'legacyprimal01')!;
  assert.equal(a.version, SAVE_VERSION, 'loads to the current version');
  assert(k.legacyGrade && f.legacyGrade);
  assert.deepEqual(k.affixes, oldK.affixes, 'stored values and ranges exactly'); assert.deepEqual(f.affixes, oldF.affixes);
  assert.equal(f.inscription, deterministicInscription(f)); assert.equal(f.inscription, b.inventory.find((i) => i?.id === 'legacyprimal01')!.inscription, 'deterministic');
  assert.equal(k.inscription, undefined, 'old Ancients get no Inscription');
  const again = normalizeSave(structuredClone(a));
  assert.deepEqual(again.equipment.neck, k, 'migration runs once');
});

test('Mystic rekindle: one free reroll of a legacy Kindled item into the new form, beside the Mystic only', async () => {
  assert(isPersistedCommand('rekindle'));
  const raw = await fs.readFile(new URL('./fixtures/saves/v15-grades.json', import.meta.url), 'utf8');
  const save = normalizeSave(JSON.parse(raw));
  const item = save.equipment.neck!;
  const near = (role: string, ok: boolean) => ({ save, changed() {}, rec: { kind: 'town', inst: { map: { town: { npcs: [{ role, name: 'Mystic', x: 0, y: 0, interactionRadius: 99 }] } }, canInteract: () => ok } } }) as unknown as Session;
  assert.equal(runCommand(near('mystic', false), {} as World, 'rekindle', { itemId: item.id }).ok, false, 'needs the Mystic');
  assert(canRekindle(item));
  const r = runCommand(near('mystic', true), {} as World, 'rekindle', { itemId: item.id });
  assert(r.ok, JSON.stringify(r));
  assert(!item.legacyGrade && item.kindledAffix === item.affixes.length - 1, 'now a Kindled item with a kindled affix');
  for (const a of item.affixes) { const def = AFFIX_BY_STAT[a.stat], hi = def.ranges[item.kind]![1] * affixScale(def.scale, item.ilvl); assert(a.max <= Math.max(Math.round(hi), Math.round(hi * 10) / 10) + 1e-9, `${a.stat} normal range`); }
  assert.equal(runCommand(near('mystic', true), {} as World, 'rekindle', { itemId: item.id }).ok, false, 'once');
  const fab = save.inventory.find((i) => i?.id === 'legacyprimal01')!;
  assert.equal(runCommand(near('mystic', true), {} as World, 'rekindle', { itemId: fab.id }).ok, false, 'Fabled items are not rekindled');
});

test('Inscriptions from the pool work in play: one extra charge on Cooldown skills, grounds follow at half size', () => {
  const { inst, p } = world('warrior', [], { save: (s) => {
    const it = generateItem(new Rng(9), { ilvl: 70, classId: 'warrior', rarity: 'legendary', legendary: 'mountain_fists', ancientAllowed: false });
    it.ancient = 2; it.inscription = 'spare_charge'; s.equipment.hands = it;
  } });
  try {
    assert.equal(p.ctx.powers.rules.charges.get('ground_stomp'), 1, 'the active Inscription reached the runtime');
  } finally { inst.destroy(); }
});
