// Set-vs-legendary parity harness (plan §3.1, docs/rework/depth/FOUNDATION.md §8).
//
// Two separate layers, so later versions can swap the planner without touching the runner:
//   * KitSpec — plain data: class, main skills, loadout, every equipment slot (set piece / legendary / rare base),
//     Cube powers. `runKit` plays any KitSpec on the matched encounters; `scripts/audit-parity.ts --kits=<file.json>`
//     runs kits read from a JSON file. A future planner can search the item pool for the best kit per main skill and
//     report how many main skills per class land within PARITY_WINDOW of the best — nothing here hard-codes archetypes.
//   * planParityKits — today's planner: for every set, three kits around the set's named skills:
//       SET       six set pieces + the most relevant legendaries in the other slots + up to three Cube powers
//       HYBRID    four set pieces + relevant legendaries everywhere else + Cube
//       LEGENDARY no set piece; relevant legendaries in every slot that has one + Cube
// Shared baseline (the P11 audit's rules): level 70, non-Ancient items with mean rolls, mean-roll rares in every other
// slot, 48 tier points (primary + first three slotted skills at tier 3), no runes, gems, upgrades or Paragon; actual
// 20 Hz simulation, infinite player HP, deterministic chase, seeded RNG.
//
// Variants NOT built yet (content bible BUDGET.md §7–9): dash-driven powers (the bot never dashes, so Stridewind-style
// procs read as 0 — add a `dash` option that dashes on cooldown toward the pack); "above X % life" powers (the immortal
// bot sits at 100 % life, so they read as always on — add a `lifePct` option that pins life). Hook: RunOptions.

import { Instance } from '../../src/sim/instance';
import { createMob } from '../../src/sim/monsters';
import { resolveTargets, tagIndexFor } from '../../src/sim/powerRuntime';
import { createCharacter } from '../../../shared/src/character';
import { BASES, LEGENDARIES, SETS, type LegendaryDef, type SetDef } from '../../../shared/src/data/items';
import { SKILLS, skillsForClass } from '../../../shared/src/data/skills';
import { MONSTERS } from '../../../shared/src/data/monsters';
import { generateItem, type GenOptions } from '../../../shared/src/items';
import { Rng } from '../../../shared/src/math';
import { computeStats } from '../../../shared/src/stats';
import { SUB_STRIKES, type PowerEffect } from '../../../shared/src/powers';
import type { CharacterSave, ClassId, Item, Slot } from '../../../shared/src/types';
import type { Session } from '../../src/net/session';

export type KitKind = 'set' | 'hybrid' | 'legendary';
export const KITS: KitKind[] = ['set', 'hybrid', 'legendary'];
/** [P] Owner's 1.25 window (P11 build audit), applied to legendary-only vs set (plan §3.1). */
export const PARITY_WINDOW = 1.25;
/** [P] Hybrid may sit this far outside the [set, legendary] interval and still count as "between" (bible BUDGET.md). */
export const HYBRID_TOLERANCE = 0.05;
/** [P] Torment II: the level-70 difficulty the tests were re-pointed to after the ×350 toughness pass (BALANCE.md §7). */
export const PARITY_DIFFICULTY = 5;
export const ENCOUNTER_CAP_MS = 120_000;
const PACKS = [['bog_slime', 'gloomshroom', 'thornling', 'grave_bat', 'bog_slime', 'gloomshroom'], ['flint_beetle', 'flint_beetle', 'flint_beetle'], ['gorgemaw']] as const;
export const SEEDS = [101, 202, 303];
const ARMOR_SLOTS: Slot[] = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet'];
const OTHER_SLOTS: Slot[] = ['wrists', 'waist', 'neck', 'ring1', 'ring2'];
const RARE_BASE: Partial<Record<Slot, string>> = { wrists: 'wrists_bracers', waist: 'waist_belt', neck: 'neck_amulet', ring1: 'ring', ring2: 'ring' };
const CLASS_WEAPON: Record<ClassId, string> = { warrior: 'axe2h', ranger: 'bow', mage: 'staff' };
const CLASS_OFFHAND: Record<ClassId, string> = { warrior: 'shield', ranger: 'quiver', mage: 'orb' };

// ─────────────────────────── Kit data ───────────────────────────

export type SlotItem = { set: string; base: string } | { legendary: string } | { rare: string };
/** One kit as data: what the harness plays. Rolls are always the mean (non-Ancient); Cube powers at the maximum. */
export interface KitSpec {
  id: string;
  classId: ClassId;
  /** The skills this kit is built around (reporting key). */
  mainSkills: string[];
  /** Up to four slotted skills (the primary is the class default unless `primary` is given). */
  slots: string[];
  primary?: string;
  equipment: Partial<Record<Slot, SlotItem>>;
  /** Cube powers [weapon, armor, jewelry]. */
  cube: (string | null)[];
  /** Default: primary + first three slots at tier 3 (48 points). */
  tiers?: Record<string, number>;
  runes?: Record<string, string>;
}
/** Run-time variants; reserved for the dash / life variants above (not implemented). */
export interface RunOptions { seeds?: number[] }

export interface ParityProfile { classId: ClassId; set: string; skills: string[]; slots: string[] }

/** Skills a set's top bonus names (the "set-backed" skills; tag targets resolved for the class); sub-strikes map to their owner. */
export function setSkills(set: SetDef): string[] {
  const top = [...set.bonuses].sort((a, b) => b.count - a.count)[0];
  const index = tagIndexFor(set.classId, {});
  const ids = new Set<string>();
  for (const e of top?.effects ?? []) if ('skills' in e || 'tags' in e) for (const s of resolveTargets(e as { skills?: string[] }, index) ?? []) ids.add(Object.hasOwn(SUB_STRIKES, s) ? SUB_STRIKES[s] : s);
  return [...ids].filter((id) => Object.hasOwn(SKILLS, id));
}

/** The loadout the planner plays for a set: `SetDef.parityLoadout`, else its named non-primary skills, then fill. */
export function profileOf(set: SetDef): ParityProfile {
  const skills = setSkills(set);
  let slots = set.parityLoadout ?? skills.filter((id) => SKILLS[id].kind !== 'primary');
  if (!set.parityLoadout) for (const s of skillsForClass(set.classId)) if (slots.length < 4 && s.kind !== 'primary' && !slots.includes(s.id)) slots = [...slots, s.id];
  return { classId: set.classId, set: set.id, skills, slots: slots.slice(0, 4) };
}

export const parityProfiles = (): ParityProfile[] => Object.values(SETS).map(profileOf);

/** Relevance of a legendary to a loadout: 2 = targets one of its skills (by name or tag), 1 = generic damage, 0 = nothing for the bot. */
export function relevance(l: LegendaryDef, profile: Pick<ParityProfile, 'classId' | 'slots'>): number {
  if (l.classes && !l.classes.includes(profile.classId)) return 0;
  const bar = new Set([...profile.slots, ...skillsForClass(profile.classId).filter((s) => s.kind === 'primary').map((s) => s.id)]);
  const index = tagIndexFor(profile.classId, {});
  const touches = (e: PowerEffect) => ('skills' in e || 'tags' in e) && (e.skills || e.tags)
    && (resolveTargets(e, index) ?? []).some((s) => bar.has(Object.hasOwn(SUB_STRIKES, s) ? SUB_STRIKES[s] : s));
  if (l.effects.some(touches)) return 2;
  const generic = l.effects.some((e) => (e.kind === 'stat' && ['chd', 'chc', 'area', 'ias', 'dmgPct'].includes(e.stat))
    || e.kind === 'elementCycle' || e.kind === 'elementStacks' || (e.kind === 'proc' && e.on !== 'dash')
    || (e.kind === 'conditional' && !e.skills && !e.tags && !('targetState' in e.when)));
  return generic ? 1 : 0;
}

const slotOf = (l: LegendaryDef): Slot[] => {
  const kind = BASES[l.base].kind;
  return kind === 'ring' ? ['ring1', 'ring2'] : kind === 'weapon1h' || kind === 'weapon2h' ? ['mainhand'] : kind === 'offhand' ? ['offhand'] : [kind as Slot];
};
const blocksOffhand = (base: string) => { const w = BASES[base].weapon; return !!w?.twoHanded && (!w.ranged || base === 'staff'); };

/** Today's planner: the set / hybrid / legendary-only kits for one set (deterministic, no RNG). */
export function planKit(profile: ParityProfile, kind: KitKind): KitSpec {
  const set = SETS[profile.set];
  const pool = Object.values(LEGENDARIES).map((l) => ({ l, r: relevance(l, profile) })).filter((x) => x.r > 0);
  const bestFor = (slot: Slot, used: Set<string>) => pool.filter((x) => !used.has(x.l.id) && slotOf(x.l).includes(slot)).sort((a, b) => b.r - a.r)[0];
  // Hybrid: set pieces go to the four armor slots whose best legendary alternative matters least.
  const armorValue = ARMOR_SLOTS.map((s, i) => ({ s, i, v: bestFor(s, new Set())?.r ?? 0 }));
  const setSlots = kind === 'set' ? ARMOR_SLOTS : kind === 'legendary' ? [] : [...armorValue].sort((a, b) => a.v - b.v || a.i - b.i).slice(0, 4).map((x) => x.s);
  const used = new Set<string>(), equipment: Partial<Record<Slot, SlotItem>> = {};
  const weapons = [...pool.filter((x) => slotOf(x.l).includes('mainhand')), null];
  let best = { score: -1, weapon: null as LegendaryDef | null, off: null as LegendaryDef | null };
  for (const w of weapons) {
    const base = w ? w.l.base : CLASS_WEAPON[profile.classId];
    const off = blocksOffhand(base) ? undefined : bestFor('offhand', new Set(w ? [w.l.id] : []));
    const score = (w?.r ?? 0) + (off?.r ?? 0);
    if (score > best.score) best = { score, weapon: w?.l ?? null, off: off?.l ?? null };
  }
  const weaponBase = best.weapon?.base ?? CLASS_WEAPON[profile.classId];
  equipment.mainhand = best.weapon ? { legendary: best.weapon.id } : { rare: weaponBase };
  if (best.weapon) used.add(best.weapon.id);
  if (!blocksOffhand(weaponBase)) { equipment.offhand = best.off ? { legendary: best.off.id } : { rare: CLASS_OFFHAND[profile.classId] }; if (best.off) used.add(best.off.id); }
  for (const slot of ARMOR_SLOTS) {
    const piece = set.pieces.find((p) => BASES[p.base].kind === slot)!;
    if (setSlots.includes(slot)) { equipment[slot] = { set: set.id, base: piece.base }; continue; }
    const b = bestFor(slot, used);
    equipment[slot] = b ? { legendary: b.l.id } : { rare: piece.base };
    if (b) used.add(b.l.id);
  }
  for (const slot of OTHER_SLOTS) {
    const b = bestFor(slot, used);
    equipment[slot] = b ? { legendary: b.l.id } : { rare: RARE_BASE[slot]! };
    if (b) used.add(b.l.id);
  }
  const cube = (['weapon', 'armor', 'jewelry'] as const).map((cs) => pool.filter((x) => x.l.cubeSlot === cs && !used.has(x.l.id)).sort((a, b) => b.r - a.r)[0]?.l.id ?? null);
  return { id: `${profile.set}/${kind}`, classId: profile.classId, mainSkills: profile.skills, slots: profile.slots, equipment, cube };
}

export const planParityKits = (profile: ParityProfile): Record<KitKind, KitSpec> =>
  ({ set: planKit(profile, 'set'), hybrid: planKit(profile, 'hybrid'), legendary: planKit(profile, 'legendary') });

// ─────────────────────────── Runner ───────────────────────────

function meanRolls(item: Item): Item {
  item.ancient = 0; item.upgrade = 0;
  for (const a of item.affixes) a.value = (a.min + a.max) / 2;
  if (item.legendary) item.legendary.value = (item.legendary.min + item.legendary.max) / 2;
  if (item.weapon) item.weapon.min = item.weapon.max = (item.weapon.min + item.weapon.max) / 2;
  item.bound = true;
  return item;
}

/** Build the character a KitSpec describes, for one seed (rare affixes come from the seed). */
export function kitSave(spec: KitSpec, seed: number): CharacterSave {
  const rng = new Rng(seed);
  const save = createCharacter(`Parity${spec.classId}`, spec.classId, seed);
  save.level = 70; save.difficulty = PARITY_DIFFICULTY; save.equipment = {}; save.inventory.fill(null);
  const gen = (o: Omit<GenOptions, 'ilvl' | 'classId'>) => meanRolls(generateItem(rng, { ilvl: 70, classId: spec.classId, smartChance: 1, ancientAllowed: false, ...o }));
  for (const slot of [...ARMOR_SLOTS, ...OTHER_SLOTS, 'mainhand', 'offhand'] as Slot[]) {
    const it = spec.equipment[slot];
    if (!it) continue;
    save.equipment[slot] = 'set' in it ? gen({ rarity: 'set', set: it.set, base: it.base })
      : 'legendary' in it ? gen({ rarity: 'legendary', legendary: it.legendary }) : gen({ rarity: 'rare', base: it.rare });
  }
  save.cube.level = 8; save.cube.learned = spec.cube.filter((x): x is string => !!x); save.cube.equipped = [...spec.cube];
  if (spec.primary) save.skills.primary = spec.primary;
  save.skills.slots = Array.from({ length: 4 }, (_, i) => spec.slots[i] ?? null);
  save.skills.runes = { ...(spec.runes ?? {}) };
  save.skills.tiers = spec.tiers ? { ...spec.tiers } : {};
  if (!spec.tiers) for (const id of [save.skills.primary, ...spec.slots.slice(0, 3)]) save.skills.tiers[id] = 3;
  return save;
}

export interface EncounterResult { encounter: number; seed: number; hp: number; ms: number; cleared: boolean; dealt: number; estMs: number }

/** One matched encounter in the actual simulation. estMs = measured time, or cap × hp / damage dealt on a timeout. */
export function runEncounter(save: CharacterSave, encounter: number, seed: number): EncounterResult {
  const random = Math.random, rng = new Rng(seed * 7 + encounter);
  Math.random = () => rng.next();
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'parity', channel: 0, seed: 41, theme: 'glade', level: 70, difficulty: PARITY_DIFFICULTY });
  try {
    inst.spawner.tick = () => {};
    for (const m of [...inst.mobs]) inst.removeEntity(m.id);
    const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed(refresh: boolean) { s.derived = computeStats(save); if (refresh) inst.refreshPlayer(s); }, rec: { inst } } as unknown as Session;
    let center: { x: number; y: number } | undefined;
    for (let y = 600; y < inst.heightPx - 600 && !center; y += 160) for (let x = 600; x < inst.widthPx - 600; x += 160)
      if ([-150, 0, 150].every((dx) => [-150, 0, 150].every((dy) => inst.cw.isFree(x + dx, y + dy, 24)))) { center = { x, y }; break; }
    if (!center) throw new Error('no free arena');
    s.entityId = inst.addPlayer(s, { x: center.x, y: center.y + 140 });
    const p = inst.playerById(s.entityId)!; p.debugInfiniteHp = true;
    const targets = PACKS[encounter].map((id, i) => createMob(inst, MONSTERS[id], 70, center!.x + (i % 3 - 1) * 65, center!.y + Math.floor(i / 3) * 60,
      { tier: encounter === 2 ? 4 : encounter === 1 ? 1 : 0, dormant: false, difficulty: PARITY_DIFFICULTY }));
    const hp = targets.reduce((n, m) => n + m.mhp, 0);
    let seq = 0;
    while (targets.some((m) => !m.dead) && inst.t < ENCOUNTER_CAP_MS) {
      const t = targets.filter((m) => !m.dead).sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), stop = save.classId === 'warrior' ? 45 : 150;
      inst.queueInput(s, { t: 'in', seq: ++seq, mx: d > stop ? dx / d : 0, my: d > stop ? dy / d : 0 });
      inst.tick();
    }
    const left = targets.reduce((n, m) => n + Math.max(0, m.dead ? 0 : m.hp), 0), dealt = hp - left;
    const cleared = targets.every((m) => m.dead);
    return { encounter, seed, hp, ms: inst.t, cleared, dealt, estMs: cleared ? inst.t : dealt > 0 ? Math.round(ENCOUNTER_CAP_MS * hp / dealt) : Infinity };
  } finally { inst.destroy(); Math.random = random; }
}

export interface KitResult { spec: KitSpec; totalMs: number; estTotalMs: number; timeouts: number; rows: EncounterResult[] }

/** Play any kit on every matched encounter and seed. */
export function runKit(spec: KitSpec, opts: RunOptions = {}): KitResult {
  const rows: EncounterResult[] = [];
  for (const seed of opts.seeds ?? SEEDS) { const save = kitSave(spec, seed); for (let e = 0; e < PACKS.length; e++) rows.push(runEncounter(save, e, seed)); }
  return { spec, rows, totalMs: rows.reduce((n, r) => n + r.ms, 0), estTotalMs: rows.reduce((n, r) => n + r.estMs, 0), timeouts: rows.filter((r) => !r.cleared).length };
}

export interface ParityRow { profile: ParityProfile; kits: Record<KitKind, KitResult>; ratio: number; hybridBetween: boolean; passes: boolean }

export function measureProfile(profile: ParityProfile, opts: RunOptions = {}): ParityRow {
  const specs = planParityKits(profile);
  const kits = { set: runKit(specs.set, opts), hybrid: runKit(specs.hybrid, opts), legendary: runKit(specs.legendary, opts) };
  const set = kits.set.estTotalMs, leg = kits.legendary.estTotalMs, hyb = kits.hybrid.estTotalMs;
  const ratio = leg / set;
  const lo = Math.min(set, leg) * (1 - HYBRID_TOLERANCE), hi = Math.max(set, leg) * (1 + HYBRID_TOLERANCE);
  const hybridBetween = hyb >= lo && hyb <= hi;
  return { profile, kits, ratio, hybridBetween, passes: ratio <= PARITY_WINDOW && hybridBetween };
}

/** Skills whose data says the parity rule is enforced (`SkillDef.parityReady`). */
export const parityReadySkills = (): string[] => Object.values(SKILLS).filter((s) => s.parityReady).map((s) => s.id);
