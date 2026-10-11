// Warrior diversity harness (BUDGET.md §4 / §6, D1–D6) on the real 20 Hz simulation. Builds on server/test/parity/harness.ts:
// the same encounters, seeds, Torment II, mean rolls, 48 tier points; adds what the warrior pilot needs:
//   * internal test fixtures per main skill (WARRIOR.md §2: main + the support the bible's search found + Battle Rage),
//     never shipped or shown — the labels exist only here;
//   * a fixed specialization allocation per fixture (10 ranks per active tree, BUDGET.md §6);
//   * a deterministic planner per configuration (rare baseline, legendary-only, every set at 6 and at 4 pieces) that
//     scores legendaries by what they do for the fixture, plus an optional local search (coordinate ascent, sim-scored);
//   * the D1–D6 checks (factors = rare-kit time ÷ kit time, i.e. the item lift of a kit over plain rares).

import { BASES, LEGENDARIES, SETS, type LegendaryDef } from '../../../shared/src/data/items';
import { SKILLS, skillTags, type SkillTag } from '../../../shared/src/data/skills';
import { SUB_STRIKES, subStrikeOwner, type PowerEffect } from '../../../shared/src/powers';
import type { CharacterSave, Slot } from '../../../shared/src/types';
import { resolveTargets, tagIndexFor } from '../../src/sim/powerRuntime';
import { ENCOUNTER_CAP_MS, PARITY_WINDOW, SEEDS, kitSave, runEncounter, type KitResult, type KitSpec, type SlotItem } from './harness';

void SUB_STRIKES;

/** The warrior's main skills (BUDGET.md §4 table). Buff skills are supports, not mains. */
export const WARRIOR_MAIN = ['cleave', 'tolling_blow', 'whirlwind', 'ironplough', 'rend', 'sawtooth_hatchet', 'ground_stomp', 'seismic_slam', 'cairnfall'] as const;
/** Support skill the bible's search picked per main skill (BUDGET.md §4 "Main skill (support)"). */
const SUPPORT: Record<string, string> = {
  cleave: 'sawtooth_hatchet', tolling_blow: 'sawtooth_hatchet', whirlwind: 'cairnfall', ironplough: 'sawtooth_hatchet', rend: 'ironplough',
  sawtooth_hatchet: 'ironplough', ground_stomp: 'ironplough', seismic_slam: 'ground_stomp', cairnfall: 'ironplough',
};
export const WARRIOR_SETS = ['endless_storm', 'cinder_oath', 'fault_warden', 'furrowmark', 'hearthbanner'] as const;
const PRIMARIES = new Set(['cleave', 'tolling_blow']);

export interface Fixture { main: string; primary: string; slots: string[] }

/**
 * Main + Battle Rage (BUDGET.md §8: warriors keep a Buff skill up) + Muster Standard + a stun cooldown, and no second
 * Spender or Channel: in the simulation a second spender takes the main skill's Fury (measured: Sawtooth Hatchet dealt
 * 88 % of a "Cleave" kit, Ironplough 68–85 % of a "Rend" kit), so the bible's search supports are not slotted.
 */
export function fixtureOf(main: string): Fixture {
  const primary = main === 'tolling_blow' ? 'tolling_blow' : 'cleave';
  const slots: string[] = [];
  for (const id of [main, 'battle_rage', 'muster_standard', 'ground_stomp', 'cairnfall']) {
    if (slots.length < 4 && !PRIMARIES.has(id) && !slots.includes(id)) slots.push(id);
  }
  return { main, primary, slots };
}

/**
 * Fixed specialization per active tree (10 ranks): the top row's first two nodes at 3, the third at 2, then 2 ranks
 * in the middle node of the second row (its prerequisite is the second top node at 2+). Deterministic, not a design.
 */
export function fixtureNodes(skills: readonly string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const id of skills) {
    const nodes = SKILLS[id]?.nodes ?? [];
    const at = (c: number, r: number) => nodes.find((n) => n.pos.col === c && n.pos.row === r);
    const ranks: Record<string, number> = {};
    let left = 10;
    for (const [c, r, k] of [[0, 0, 3], [1, 0, 3], [2, 0, 2], [1, 1, 2], [0, 1, 2], [2, 1, 2]] as const) {
      const n = at(c, r);
      if (!n || left <= 0) continue;
      const req = n.requires?.[0];
      if (req && (ranks[req.node] ?? 0) < req.rank) continue;
      const take = Math.min(k, n.maxRank, left);
      ranks[n.id] = take; left -= take;
    }
    if (Object.keys(ranks).length) out[id] = ranks;
  }
  return out;
}

// ─────────────────────────── Planner ───────────────────────────

const slotsOf = (base: string): Slot[] => {
  const k = BASES[base].kind;
  return k === 'ring' ? ['ring1', 'ring2'] : k === 'weapon1h' || k === 'weapon2h' ? ['mainhand'] : k === 'offhand' ? ['offhand'] : [k as Slot];
};
const ARMOR: Slot[] = ['head', 'shoulders', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet'];
const JEWEL: Slot[] = ['neck', 'ring1', 'ring2'];
const RARE_BASE: Record<string, string> = {
  head: 'head_horned', shoulders: 'shoulders_spiked', chest: 'chest_plate', hands: 'hands_gauntlets', wrists: 'wrists_bracers', waist: 'waist_belt',
  legs: 'legs_plate', feet: 'feet_greaves', neck: 'neck_amulet', ring1: 'ring', ring2: 'ring', mainhand: 'axe2h', offhand: 'shield',
};
const twoHanded = (base: string) => !!BASES[base].weapon?.twoHanded;
/** Powers the immortal, never-dashing bot cannot use (BUDGET.md §8). */
const INVISIBLE = (e: PowerEffect) => (e.kind === 'proc' && e.on === 'dash') || e.kind === 'dashCooldown' || e.kind === 'damageTaken' || e.kind === 'cheatDeath' || e.kind === 'firstHit' || e.kind === 'controlImmunity';

/**
 * What a legendary does for a fixture: 3 per effect on the main skill (by name or tag), 1.5 on the support, 1 on another
 * bar skill, 0.5 for generic damage; powers the bot cannot use count 0. Deterministic tie-break: registry order.
 */
export function legendaryValue(l: LegendaryDef, f: Fixture): number {
  if (l.classes && !l.classes.includes('warrior')) return 0;
  const index = tagIndexFor('warrior', {});
  const bar = [f.primary, ...f.slots];
  let v = 0;
  for (const e of l.effects) {
    if (INVISIBLE(e)) continue;
    if ('skills' in e || 'tags' in e) {
      const hit = new Set((resolveTargets(e as { skills?: string[] }, index) ?? []).map(subStrikeOwner));
      v += hit.has(f.main) ? 3 : bar.some((s) => hit.has(s)) ? 1 : 0;
      continue;
    }
    if ((e.kind === 'stat' && ['chd', 'chc', 'area', 'ias', 'dmgPct'].includes(e.stat)) || e.kind === 'elementCycle' || e.kind === 'elementStacks'
      || (e.kind === 'proc' && e.on !== 'dash') || e.kind === 'conditional') v += 0.5;
  }
  return v;
}

export type Config = { kind: 'rare' } | { kind: 'legendary' } | { kind: 'set'; set: string; pieces: 6 | 4 };
export const configId = (c: Config) => (c.kind === 'set' ? `${c.set}${c.pieces}` : c.kind);

export interface PlanOptions { excludeShared?: boolean }

/** A KitSpec for one fixture and configuration (deterministic). */
export function planWarriorKit(f: Fixture, c: Config, o: PlanOptions = {}): KitSpec {
  const pool = Object.values(LEGENDARIES).filter((l) => (!l.classes || l.classes.includes('warrior')) && !(o.excludeShared && !l.classes))
    .map((l) => ({ l, v: c.kind === 'rare' ? 0 : legendaryValue(l, f) })).filter((x) => x.v > 0);
  const best = (slot: Slot, used: Set<string>) => pool.filter((x) => !used.has(x.l.id) && slotsOf(x.l.base).includes(slot)).sort((a, b) => b.v - a.v)[0];
  const equipment: Partial<Record<Slot, SlotItem>> = {};
  const used = new Set<string>();
  // Set footprint (6 pieces, or the 4 whose best legendary alternative is worth least).
  let setSlots: Slot[] = [];
  if (c.kind === 'set') {
    const set = SETS[c.set];
    const foot = set.pieces.map((p) => BASES[p.base].kind as Slot);
    setSlots = c.pieces === 6 ? foot : foot.map((s, i) => ({ s, i, v: best(s, new Set())?.v ?? 0 })).sort((a, b) => a.v - b.v || a.i - b.i).slice(0, 4).map((x) => x.s);
    for (const s of setSlots) equipment[s] = { set: c.set, base: set.pieces.find((p) => BASES[p.base].kind === s)!.base };
  }
  // Weapon / off-hand: the best pair (two-handers leave the off-hand empty).
  if (c.kind !== 'rare') {
    const weapons = [...pool.filter((x) => slotsOf(x.l.base).includes('mainhand')), null];
    let top = { v: -1, w: null as LegendaryDef | null, off: null as LegendaryDef | null };
    for (const w of weapons) {
      const off = w && twoHanded(w.l.base) ? null : best('offhand', new Set(w ? [w.l.id] : []))?.l ?? null;
      const v = (w?.v ?? 0) + (off ? pool.find((x) => x.l === off)!.v : 0);
      if (v > top.v) top = { v, w: w?.l ?? null, off };
    }
    if (top.w) { equipment.mainhand = { legendary: top.w.id }; used.add(top.w.id); }
    if (top.off) { equipment.offhand = { legendary: top.off.id }; used.add(top.off.id); }
  }
  equipment.mainhand ??= { rare: RARE_BASE.mainhand };
  if (!(('legendary' in equipment.mainhand) && twoHanded(LEGENDARIES[equipment.mainhand.legendary].base)) && !('rare' in equipment.mainhand && twoHanded(equipment.mainhand.rare))) equipment.offhand ??= { rare: RARE_BASE.offhand };
  for (const s of [...ARMOR, ...JEWEL]) {
    if (equipment[s]) continue;
    const b = c.kind === 'rare' ? undefined : best(s, used);
    equipment[s] = b ? { legendary: b.l.id } : { rare: RARE_BASE[s] };
    if (b) used.add(b.l.id);
  }
  const cube = c.kind === 'rare' ? [null, null, null] : (['weapon', 'armor', 'jewelry'] as const).map((cs) => pool.filter((x) => x.l.cubeSlot === cs && !used.has(x.l.id)).sort((a, b) => b.v - a.v)[0]?.l.id ?? null);
  return { id: `${f.main}/${configId(c)}`, classId: 'warrior', mainSkills: [f.main], primary: f.primary, slots: f.slots, equipment, cube };
}

// ─────────────────────────── Runner ───────────────────────────

/** Play a kit with the fixture's specialization on the matched encounters (harness runEncounter). */
export function runWarriorKit(spec: KitSpec, seeds = SEEDS, encounters = [0, 1, 2], breakdown?: Map<string, number>): KitResult {
  const nodes = fixtureNodes([spec.primary ?? 'cleave', ...spec.slots]);
  const rows = [];
  for (const seed of seeds) {
    const save: CharacterSave = kitSave(spec, seed);
    save.skills.nodes = structuredClone(nodes);
    for (const e of encounters) rows.push(runEncounter(save, e, seed, { breakdown }));
  }
  return { spec, rows, totalMs: rows.reduce((n, r) => n + r.ms, 0), estTotalMs: rows.reduce((n, r) => n + r.estMs, 0), timeouts: rows.filter((r) => !r.cleared).length };
}

/** Coordinate ascent over legendary slots, scored by a cheap sim proxy (one seed). Returns the improved spec. */
export function searchWarriorKit(spec: KitSpec, f: Fixture, maxEvals = 40, o: PlanOptions = {}): KitSpec {
  const proxy = (k: KitSpec) => runWarriorKit(k, [SEEDS[0]]).estTotalMs;
  const pool = Object.values(LEGENDARIES).filter((l) => (!l.classes || l.classes.includes('warrior')) && !(o.excludeShared && !l.classes) && legendaryValue(l, f) > 0);
  let cur = spec, score = proxy(cur), evals = 1;
  for (const s of [...ARMOR, ...JEWEL, 'mainhand', 'offhand'] as Slot[]) {
    const it = cur.equipment[s];
    if (!it || 'set' in it) continue;
    const taken = new Set(Object.values(cur.equipment).flatMap((x) => (x && 'legendary' in x ? [x.legendary] : [])).concat(cur.cube.filter((x): x is string => !!x)));
    for (const l of pool) {
      if (evals >= maxEvals) return cur;
      if (!slotsOf(l.base).includes(s) || taken.has(l.id) || (s === 'mainhand' && twoHanded(l.base) !== twoHanded(baseOf(it)))) continue;
      const next = { ...cur, equipment: { ...cur.equipment, [s]: { legendary: l.id } } };
      const v = proxy(next); evals++;
      if (v < score) { cur = next; score = v; taken.add(l.id); }
    }
  }
  return cur;
}
const baseOf = (it: SlotItem) => ('legendary' in it ? LEGENDARIES[it.legendary].base : 'set' in it ? it.base : it.rare);

// ─────────────────────────── D1–D6 ───────────────────────────

export interface MainRow {
  main: string; fixture: Fixture;
  /** Clear time per configuration (ms, totals over seeds × encounters; timeouts extrapolated). */
  ms: Record<string, number>; timeouts: Record<string, number>; kits: Record<string, KitSpec>;
  /** Lift over the rare kit per configuration (rare ms ÷ kit ms). */
  factor: Record<string, number>;
  best: string; bestSet6: string; bestHybrid: string;
}
export interface Diversity { rows: MainRow[]; checks: Record<'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6', { value: string; target: boolean; hard: boolean }>; seeds: number[] }

export function warriorDiversity(opts: { seeds?: number[]; search?: number; excludeShared?: boolean; mains?: readonly string[] } = {}): Diversity {
  const seeds = opts.seeds ?? SEEDS;
  const configs: Config[] = [{ kind: 'rare' }, { kind: 'legendary' }, ...WARRIOR_SETS.flatMap((set) => [{ kind: 'set', set, pieces: 6 } as Config, { kind: 'set', set, pieces: 4 } as Config])];
  const rows: MainRow[] = [];
  for (const main of opts.mains ?? WARRIOR_MAIN) {
    const f = fixtureOf(main);
    const row: MainRow = { main, fixture: f, ms: {}, timeouts: {}, kits: {}, factor: {}, best: '', bestSet6: '', bestHybrid: '' };
    for (const c of configs) {
      let spec = planWarriorKit(f, c, opts);
      if (opts.search && c.kind !== 'rare') spec = searchWarriorKit(spec, f, opts.search, opts);
      const r = runWarriorKit(spec, seeds);
      const id = configId(c);
      row.ms[id] = r.estTotalMs; row.timeouts[id] = r.timeouts; row.kits[id] = spec;
    }
    for (const id of Object.keys(row.ms)) row.factor[id] = row.ms.rare / row.ms[id];
    const ids = Object.keys(row.ms).filter((id) => id !== 'rare');
    row.best = ids.sort((a, b) => row.ms[a] - row.ms[b])[0];
    row.bestSet6 = ids.filter((id) => id.endsWith('6')).sort((a, b) => row.ms[a] - row.ms[b])[0];
    row.bestHybrid = ids.filter((id) => id.endsWith('4')).sort((a, b) => row.ms[a] - row.ms[b])[0];
    rows.push(row);
  }
  // D1: main skills whose best kit factor is within 1.25× of the class's best factor.
  const bestF = rows.map((r) => r.factor[r.best]), top = Math.max(...bestF);
  const within = rows.filter((r) => r.factor[r.best] * PARITY_WINDOW >= top).length;
  // D2: the most frequent item / set across the top kits.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = r.kits[r.best], seen = new Set<string>();
    for (const it of Object.values(k.equipment)) if (it) seen.add('set' in it ? `set:${it.set}` : 'legendary' in it ? it.legendary : '');
    for (const id of k.cube) if (id) seen.add(id);
    seen.delete('');
    for (const id of seen) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const [topItem, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  const share = topCount / rows.length;
  // D3: best legendary-only ÷ best 6-piece (factor ratio); D4: best hybrid vs the nearer of the two.
  const d3 = rows.map((r) => r.factor.legendary / r.factor[r.bestSet6]);
  const d4 = rows.map((r) => {
    const h = r.factor[r.bestHybrid], a = r.factor.legendary, b = r.factor[r.bestSet6];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return h >= lo && h <= hi ? 1 : h > hi ? h / hi : h / lo;
  });
  // D5: sets that are the best configuration or the best hybrid of some main skill.
  const used = new Set(rows.flatMap((r) => [r.best, r.bestHybrid].filter((id) => id !== 'legendary').map((id) => id.replace(/[46]$/, ''))));
  // D6: no main skill's best factor above 1.5× the class median.
  const sorted = [...bestF].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  const d6 = Math.max(...bestF) / median;
  const fmt = (x: number) => x.toFixed(2);
  return {
    seeds, rows,
    checks: {
      D1: { value: `${within}/${rows.length}`, target: within >= rows.length * 2 / 3, hard: within >= rows.length / 2 },
      D2: { value: `${topItem} ${topCount}/${rows.length}`, target: share <= 0.75, hard: share < 1 },
      D3: { value: `${fmt(Math.min(...d3))}–${fmt(Math.max(...d3))}`, target: d3.every((x) => x >= 0.85 && x <= 1.2), hard: d3.every((x) => x >= 0.8 && x <= 1.25) },
      D4: { value: `${fmt(Math.min(...d4))}–${fmt(Math.max(...d4))}`, target: d4.every((x) => x >= 0.95 && x <= 1.05), hard: d4.every((x) => x >= 0.9 && x <= 1.1) },
      D5: { value: `${used.size}/${WARRIOR_SETS.length} (${[...used].join(', ')})`, target: used.size >= WARRIOR_SETS.length, hard: used.size >= 4 },
      D6: { value: fmt(d6), target: d6 <= 1.5, hard: d6 <= 1.5 },
    },
  };
}

/** Tags of a skill (base data) — used by reports. */
export const tagsOfSkill = (id: string): SkillTag[] => [...skillTags(SKILLS[id])];
export { ENCOUNTER_CAP_MS };
