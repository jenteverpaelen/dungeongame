// Mage diversity harness (BUDGET.md §4 / §6, D1–D6) on the real 20 Hz simulation. Same method as the warrior pilot's
// server/test/parity/warrior.ts (the harness's encounters, seeds, Torment II, mean rolls, 48 tier points), with:
//   * internal test fixtures per main skill (MAGE.md §2: never shipped or shown — the labels exist only here);
//   * a fixed specialization allocation per fixture (10 ranks per active tree, BUDGET.md §6);
//   * a deterministic planner per configuration (rare baseline, legendary-only, every mage set at 6 and at 4 pieces)
//     that scores legendaries by what they do for the fixture, plus an optional local search (coordinate ascent);
//   * the D1–D6 checks (factors = rare-kit time ÷ kit time, i.e. the item lift of a kit over plain rares).

import { BASES, LEGENDARIES, SETS, blocksOffhand, type LegendaryDef } from '../../../shared/src/data/items';
import { SKILLS } from '../../../shared/src/data/skills';
import { subStrikeOwner, type PowerEffect } from '../../../shared/src/powers';
import type { CharacterSave, Slot } from '../../../shared/src/types';
import { resetIdsForHarness } from '../../src/sim/ids';
import { resolveTargets, tagIndexFor } from '../../src/sim/powerRuntime';
import { PARITY_WINDOW, SEEDS, kitSave, runEncounter, type KitResult, type KitSpec, type SlotItem } from './harness';
import { fixtureNodes } from './warrior';

/** The mage's main skills (BUDGET.md §4 mage table). Magic Weapon (the Buff skill) is a support, not a main. */
export const MAGE_MAIN = ['magic_missile', 'rime_needles', 'meteor', 'stormglass_orb', 'thrumming_ray', 'black_hole', 'frost_nova', 'rimefield', 'hydra', 'cinderkin', 'orrery'] as const;
export const MAGE_SETS = ['fallen_star', 'glass_concord', 'lantern_garden', 'hoarfrost_vigil', 'hollowstar_choir'] as const;
const PRIMARIES = new Set(['magic_missile', 'rime_needles']);

export interface Fixture { main: string; primary: string; slots: string[] }

/**
 * Main + Magic Weapon (BUDGET.md §8: mages keep a Buff skill up) + two cooldowns that cost little Arcane Power (Frost
 * Nova, Black Hole; Rimefield when one of them is the main), and no second Spender or Channel: like the warrior's
 * Fury, a second Spender takes the main skill's resource. Magic Missile is the primary (Rime Needles for its own fixture).
 */
export function fixtureOf(main: string): Fixture {
  const primary = main === 'rime_needles' ? 'rime_needles' : 'magic_missile';
  const slots: string[] = [];
  for (const id of [main, 'magic_weapon', 'frost_nova', 'black_hole', 'rimefield']) {
    if (slots.length < 4 && !PRIMARIES.has(id) && !slots.includes(id)) slots.push(id);
  }
  return { main, primary, slots };
}

// ─────────────────────────── Planner ───────────────────────────

const slotsOf = (base: string): Slot[] => {
  const k = BASES[base].kind;
  return k === 'ring' ? ['ring1', 'ring2'] : k === 'weapon1h' || k === 'weapon2h' ? ['mainhand'] : k === 'offhand' ? ['offhand'] : [k as Slot];
};
const ARMOR: Slot[] = ['head', 'shoulders', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet'];
const JEWEL: Slot[] = ['neck', 'ring1', 'ring2'];
const RARE_BASE: Record<string, string> = {
  head: 'head_wizard', shoulders: 'shoulders_mantle', chest: 'chest_robe', hands: 'hands_wraps', wrists: 'wrists_bracers', waist: 'waist_sash',
  legs: 'legs_cloth', feet: 'feet_shoes', neck: 'neck_amulet', ring1: 'ring', ring2: 'ring', mainhand: 'staff', offhand: 'orb',
};
const noOff = (base: string) => blocksOffhand(BASES[base]);
/** Powers the immortal, never-dashing bot cannot use (BUDGET.md §8). */
const INVISIBLE = (e: PowerEffect) => (e.kind === 'proc' && e.on === 'dash') || e.kind === 'dashCooldown' || e.kind === 'damageTaken' || e.kind === 'cheatDeath' || e.kind === 'firstHit' || e.kind === 'controlImmunity';

/**
 * What a legendary does for a fixture: 3 per effect on the main skill (by name or tag), 1 on another bar skill, 0.5 for
 * generic damage; powers the bot cannot use count 0. Deterministic tie-break: registry order.
 */
export function legendaryValue(l: LegendaryDef, f: Fixture): number {
  if (l.classes && !l.classes.includes('mage')) return 0;
  const index = tagIndexFor('mage', {});
  const bar = [f.primary, ...f.slots];
  let v = 0;
  for (const e of l.effects) {
    if (INVISIBLE(e)) continue;
    if (('skills' in e && e.skills) || ('tags' in e && e.tags)) {
      const hit = new Set((resolveTargets(e as { skills?: string[] }, index) ?? []).map(subStrikeOwner));
      v += hit.has(f.main) ? 3 : bar.some((s) => hit.has(s)) ? 1 : 0;
      continue;
    }
    if ((e.kind === 'stat' && ['chd', 'chc', 'area', 'ias', 'dmgPct', 'dotDmg'].includes(e.stat)) || e.kind === 'elementCycle' || e.kind === 'elementStacks'
      || (e.kind === 'proc' && e.on !== 'dash') || e.kind === 'conditional' || e.kind === 'skillMore') v += 0.5;
  }
  return v;
}

export type Config = { kind: 'rare' } | { kind: 'legendary' } | { kind: 'set'; set: string; pieces: 6 | 4 };
export const configId = (c: Config) => (c.kind === 'set' ? `${c.set}${c.pieces}` : c.kind);

export interface PlanOptions { excludeShared?: boolean }

/** A KitSpec for one fixture and configuration (deterministic). */
export function planMageKit(f: Fixture, c: Config, o: PlanOptions = {}): KitSpec {
  const pool = Object.values(LEGENDARIES).filter((l) => (!l.classes || l.classes.includes('mage')) && !(o.excludeShared && !l.classes))
    .map((l) => ({ l, v: c.kind === 'rare' ? 0 : legendaryValue(l, f) })).filter((x) => x.v > 0);
  const best = (slot: Slot, used: Set<string>) => pool.filter((x) => !used.has(x.l.id) && slotsOf(x.l.base).includes(slot)).sort((a, b) => b.v - a.v)[0];
  const equipment: Partial<Record<Slot, SlotItem>> = {};
  const used = new Set<string>();
  let setSlots: Slot[] = [];
  if (c.kind === 'set') {
    const set = SETS[c.set];
    const foot = set.pieces.map((p) => BASES[p.base].kind as Slot);
    setSlots = c.pieces === 6 ? foot : foot.map((s, i) => ({ s, i, v: best(s, new Set())?.v ?? 0 })).sort((a, b) => a.v - b.v || a.i - b.i).slice(0, 4).map((x) => x.s);
    for (const s of setSlots) equipment[s] = { set: c.set, base: set.pieces.find((p) => BASES[p.base].kind === s)!.base };
  }
  // Weapon / off-hand: the best pair (staves and censers leave the off-hand empty).
  if (c.kind !== 'rare') {
    const weapons = [...pool.filter((x) => slotsOf(x.l.base).includes('mainhand')), null];
    let top = { v: -1, w: null as LegendaryDef | null, off: null as LegendaryDef | null };
    for (const w of weapons) {
      const off = w && noOff(w.l.base) ? null : best('offhand', new Set(w ? [w.l.id] : []))?.l ?? null;
      const v = (w?.v ?? 0) + (off ? pool.find((x) => x.l === off)!.v : 0);
      if (v > top.v) top = { v, w: w?.l ?? null, off };
    }
    if (top.w) { equipment.mainhand = { legendary: top.w.id }; used.add(top.w.id); }
    if (top.off) { equipment.offhand = { legendary: top.off.id }; used.add(top.off.id); }
  }
  equipment.mainhand ??= { rare: RARE_BASE.mainhand };
  const mh = equipment.mainhand;
  const mhBase = 'legendary' in mh ? LEGENDARIES[mh.legendary].base : 'rare' in mh ? mh.rare : mh.base;
  if (!noOff(mhBase)) equipment.offhand ??= { rare: RARE_BASE.offhand };
  for (const s of [...ARMOR, ...JEWEL]) {
    if (equipment[s]) continue;
    const b = c.kind === 'rare' ? undefined : best(s, used);
    equipment[s] = b ? { legendary: b.l.id } : { rare: RARE_BASE[s] };
    if (b) used.add(b.l.id);
  }
  const cube = c.kind === 'rare' ? [null, null, null] : (['weapon', 'armor', 'jewelry'] as const).map((cs) => pool.filter((x) => x.l.cubeSlot === cs && !used.has(x.l.id)).sort((a, b) => b.v - a.v)[0]?.l.id ?? null);
  return { id: `${f.main}/${configId(c)}`, classId: 'mage', mainSkills: [f.main], primary: f.primary, slots: f.slots, equipment, cube };
}

// ─────────────────────────── Runner ───────────────────────────

/** Play a kit with the fixture's specialization on the matched encounters (harness runEncounter). */
export function runMageKit(spec: KitSpec, seeds = SEEDS, encounters = [0, 1, 2], breakdown?: Map<string, number>): KitResult {
  const nodes = fixtureNodes([spec.primary ?? 'magic_missile', ...spec.slots]);
  const rows = [];
  for (const seed of seeds) {
    const save: CharacterSave = kitSave(spec, seed);
    save.skills.nodes = structuredClone(nodes);
    // Fresh ids per encounter: a kit's time must not depend on what ran before it (see resetIdsForHarness).
    for (const e of encounters) { resetIdsForHarness(); rows.push(runEncounter(save, e, seed, { breakdown })); }
  }
  return { spec, rows, totalMs: rows.reduce((n, r) => n + r.ms, 0), estTotalMs: rows.reduce((n, r) => n + r.estMs, 0), timeouts: rows.filter((r) => !r.cleared).length };
}

const baseOf = (it: SlotItem) => ('legendary' in it ? LEGENDARIES[it.legendary].base : 'set' in it ? it.base : it.rare);

/** Coordinate ascent over legendary slots, scored by a cheap sim proxy (one seed). Returns the improved spec. */
export function searchMageKit(spec: KitSpec, f: Fixture, maxEvals = 40, o: PlanOptions = {}): KitSpec {
  const proxy = (k: KitSpec) => runMageKit(k, [SEEDS[0]]).estTotalMs;
  const pool = Object.values(LEGENDARIES).filter((l) => (!l.classes || l.classes.includes('mage')) && !(o.excludeShared && !l.classes) && legendaryValue(l, f) > 0);
  let cur = spec, score = proxy(cur), evals = 1;
  for (const s of [...ARMOR, ...JEWEL, 'mainhand', 'offhand'] as Slot[]) {
    const it = cur.equipment[s];
    if (!it || 'set' in it) continue;
    const taken = new Set(Object.values(cur.equipment).flatMap((x) => (x && 'legendary' in x ? [x.legendary] : [])).concat(cur.cube.filter((x): x is string => !!x)));
    for (const l of pool) {
      if (evals >= maxEvals) return cur;
      if (!slotsOf(l.base).includes(s) || taken.has(l.id) || (s === 'mainhand' && noOff(l.base) !== noOff(baseOf(it)))) continue;
      const next = { ...cur, equipment: { ...cur.equipment, [s]: { legendary: l.id } } };
      const v = proxy(next); evals++;
      if (v < score) { cur = next; score = v; taken.add(l.id); }
    }
  }
  return cur;
}

// ─────────────────────────── D1–D6 ───────────────────────────

export interface MainRow {
  main: string; fixture: Fixture;
  ms: Record<string, number>; timeouts: Record<string, number>; kits: Record<string, KitSpec>;
  factor: Record<string, number>;
  best: string; bestSet6: string; bestHybrid: string;
}
export interface Diversity { rows: MainRow[]; checks: Record<'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6', { value: string; target: boolean; hard: boolean }>; seeds: number[] }

export function mageDiversity(opts: { seeds?: number[]; search?: number; excludeShared?: boolean; mains?: readonly string[]; sets?: readonly string[]; log?: (s: string) => void } = {}): Diversity {
  const seeds = opts.seeds ?? SEEDS;
  const sets = opts.sets ?? MAGE_SETS;
  const configs: Config[] = [{ kind: 'rare' }, { kind: 'legendary' }, ...sets.flatMap((set) => [{ kind: 'set', set, pieces: 6 } as Config, { kind: 'set', set, pieces: 4 } as Config])];
  const rows: MainRow[] = [];
  for (const main of opts.mains ?? MAGE_MAIN) {
    const f = fixtureOf(main);
    const row: MainRow = { main, fixture: f, ms: {}, timeouts: {}, kits: {}, factor: {}, best: '', bestSet6: '', bestHybrid: '' };
    for (const c of configs) {
      let spec = planMageKit(f, c, opts);
      if (opts.search && c.kind !== 'rare') spec = searchMageKit(spec, f, opts.search, opts);
      const r = runMageKit(spec, seeds);
      const id = configId(c);
      row.ms[id] = r.estTotalMs; row.timeouts[id] = r.timeouts; row.kits[id] = spec;
    }
    for (const id of Object.keys(row.ms)) row.factor[id] = row.ms.rare / row.ms[id];
    const ids = Object.keys(row.ms).filter((id) => id !== 'rare');
    row.best = ids.sort((a, b) => row.ms[a] - row.ms[b])[0];
    row.bestSet6 = ids.filter((id) => id.endsWith('6')).sort((a, b) => row.ms[a] - row.ms[b])[0];
    row.bestHybrid = ids.filter((id) => id.endsWith('4')).sort((a, b) => row.ms[a] - row.ms[b])[0];
    rows.push(row);
    opts.log?.(`${main}: ${Object.entries(row.factor).map(([k, v]) => `${k} ×${v.toFixed(2)}`).join(' ')}`);
  }
  const bestF = rows.map((r) => r.factor[r.best]), top = Math.max(...bestF);
  const within = rows.filter((r) => r.factor[r.best] * PARITY_WINDOW >= top).length;
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
  const d3 = rows.map((r) => r.factor.legendary / r.factor[r.bestSet6]);
  const d4 = rows.map((r) => {
    const h = r.factor[r.bestHybrid], a = r.factor.legendary, b = r.factor[r.bestSet6];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return h >= lo && h <= hi ? 1 : h > hi ? h / hi : h / lo;
  });
  const used = new Set(rows.flatMap((r) => [r.best, r.bestHybrid].filter((id) => id !== 'legendary').map((id) => id.replace(/[46]$/, ''))));
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
      D5: { value: `${used.size}/${sets.length} (${[...used].join(', ')})`, target: used.size >= sets.length, hard: used.size >= 4 },
      D6: { value: fmt(d6), target: d6 <= 1.5, hard: d6 <= 1.5 },
    },
  };
}
