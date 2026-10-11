// The one power-template interpreter of the simulation. buildPowerRuntime turns the active sources
// (shared/src/powerSources.ts, canonical order) into the per-player tables the combat code reads:
//   skill mods per strike id · own-bucket multipliers (static × per-strike conditions, capped) · per-hit multipliers ·
//   target-state vulnerability · procs · element stacks / cycle · buffs granted by powers.
// Every multiplication happens in the canonical source order, which reproduces the pre-template code bit for bit.

import { addBuff, getBuff, removeBuff } from './effects';
import { OWN_BUCKET_CAP, amount, type BuffGrant, type Condition, type PowerEffect, type ProcTrigger } from '../../../shared/src/powers';
import type { PowerSource } from '../../../shared/src/powerSources';
import { LEGENDARIES, SETS } from '../../../shared/src/data/items';
import { PASSIVES } from '../../../shared/src/passives';
import { SKILLS, mergeMods, type Element, type SkillMods } from '../shared';
import type { Instance } from './instance';
import type { Mob, Player } from './types';

export interface OwnTerm { when: Condition; skills?: readonly string[]; pct: number }
export interface HitTerm { kind: 'stacks' | 'cycle' | 'cond'; skills?: readonly string[]; when?: Condition; pct: number }
export interface ProcRuntime { chance?: number; reduceMs: number; resource: number; buff: Buff | null }
type Buff = { id: string; ms: number; dmg?: number; chc?: number; chd?: number; ias?: number };

export interface PowerRuntime {
  /** Power-template SkillMods per strike id (merged in canonical order; runes/tiers/nodes are added before). */
  mods: Map<string, SkillMods>;
  /** Static own-bucket product per strike id. */
  ownStatic: Map<string, number>;
  /** Conditional own-bucket terms (evaluated when a strike is made). */
  ownTerms: OwnTerm[];
  /** Target-independent per-hit multipliers in canonical order. */
  hitTerms: HitTerm[];
  /** Folded target-state factors for unfiltered stunned / frozen conditions (×, after rune vulnerability). */
  stunFactor: number;
  frozenFactor: number;
  /** Target-state conditions that cannot be folded (other states, or filtered to skills). */
  vulnTerms: { state: string; skills?: readonly string[]; pct: number }[];
  procs: Partial<Record<ProcTrigger, ProcRuntime[]>>;
  elementStacks: { elements: readonly Element[]; windowMs: number; perStack: number; buff?: string } | null;
  elementCycle: { elements: readonly Element[]; periodMs: number; pct: number; buffPrefix: string } | null;
  /** Buff ids / prefixes the active powers can grant (others from the power catalogue are dropped on refresh). */
  grants: { ids: Set<string>; prefixes: string[] };
}

function grantBuff(g: BuffGrant, roll: number): Buff {
  const b: Buff = { id: g.id, ms: g.ms };
  if (g.dmg !== undefined) b.dmg = amount(g.dmg, roll);
  if (g.chc !== undefined) b.chc = amount(g.chc, roll);
  if (g.chd !== undefined) b.chd = amount(g.chd, roll);
  if (g.ias !== undefined) b.ias = amount(g.ias, roll);
  return b;
}

function effectMods(e: Extract<PowerEffect, { kind: 'skillMods' }>, roll: number): SkillMods[] {
  const out: SkillMods[] = [e.mods ?? {}];
  if (e.roll) {
    const v = (e.roll.sign ?? 1) * roll;
    out.push(e.roll.field.startsWith('var:') ? { vars: { [e.roll.field.slice(4)]: v } } : { [e.roll.field]: v });
  }
  return out;
}

export function buildPowerRuntime(sources: readonly PowerSource[]): PowerRuntime {
  const rt: PowerRuntime = {
    mods: new Map(), ownStatic: new Map(), ownTerms: [], hitTerms: [], stunFactor: 1, frozenFactor: 1, vulnTerms: [],
    procs: {}, elementStacks: null, elementCycle: null, grants: { ids: new Set(), prefixes: [] },
  };
  for (const src of sources) buffGrants(src.effects, rt.grants);
  for (const src of sources) for (const e of src.effects) {
    switch (e.kind) {
      case 'skillMods':
        for (const skill of e.skills) {
          let m = rt.mods.get(skill) ?? { flags: [] };
          for (const part of effectMods(e, src.roll)) m = mergeMods(m, part);
          rt.mods.set(skill, m);
        }
        break;
      case 'ownMult':
        for (const skill of e.skills) rt.ownStatic.set(skill, (rt.ownStatic.get(skill) ?? 1) * e.mult);
        break;
      case 'conditional': {
        const pct = amount(e.pct, src.roll);
        if (e.bucket === 'own') rt.ownTerms.push({ when: e.when, skills: e.skills, pct });
        else if ('targetState' in e.when) {
          const st = e.when.targetState;
          if (!e.skills && st === 'stunned') rt.stunFactor *= 1 + pct / 100;
          else if (!e.skills && st === 'frozen') rt.frozenFactor *= 1 + pct / 100;
          else rt.vulnTerms.push({ state: st, skills: e.skills, pct });
        } else rt.hitTerms.push({ kind: 'cond', when: e.when, skills: e.skills, pct });
        break;
      }
      case 'elementStacks':
        if (!rt.elementStacks) {
          rt.elementStacks = { elements: e.elements, windowMs: e.windowMs, perStack: e.perStack, buff: e.buff };
          rt.hitTerms.push({ kind: 'stacks', pct: e.perStack });
        }
        break;
      case 'elementCycle':
        if (!rt.elementCycle) {
          rt.elementCycle = { elements: e.elements, periodMs: e.periodMs, pct: amount(e.pct, src.roll), buffPrefix: e.buffPrefix };
          rt.hitTerms.push({ kind: 'cycle', pct: rt.elementCycle.pct });
        }
        break;
      case 'proc': {
        const list = (rt.procs[e.on] ??= []);
        list.push({ chance: e.chance, reduceMs: amount(e.reduceCooldownsMs, src.roll), resource: amount(e.resource, src.roll), buff: e.buff ? grantBuff(e.buff, src.roll) : null });
        break;
      }
      case 'stat': case 'dashCooldown': break; // character sheet (shared/src/stats.ts)
    }
  }
  return rt;
}

// ─────────────────────────── Evaluation ───────────────────────────

function holds(p: Player, w: Condition, el?: Element): boolean {
  if ('channeling' in w) return !!p.channel && (w.channeling === true || p.channel.skill === w.channeling);
  if ('buff' in w) return !!getBuff(p, w.buff);
  if ('element' in w) return !!el && w.element.includes(el);
  if ('lifeBelowPct' in w) return p.hp < p.mhp * w.lifeBelowPct / 100;
  if ('lifeAbovePct' in w) return p.hp > p.mhp * w.lifeAbovePct / 100;
  return false;
}

/** Own-bucket multiplier of a strike (set bonuses …): static product × conditional terms, capped by OWN_BUCKET_CAP. */
export function ownMultiplier(p: Player, skillId: string): number {
  const pr = p.ctx.powers;
  let m = pr.ownStatic.get(skillId) ?? 1;
  for (const t of pr.ownTerms) {
    if (t.skills && !t.skills.includes(skillId)) continue;
    const w = t.when;
    if ('perSummon' in w) {
      let n = 0;
      for (const s of p.summons) if (s.type === w.perSummon && !s.dead) n++;
      m *= 1 + t.pct / 100 * Math.min(w.max, n);
    } else if (holds(p, w)) m *= 1 + t.pct / 100;
  }
  return Math.min(OWN_BUCKET_CAP, m);
}

/** Distinct stacking elements dealt within the window; records `el` (Fallen Star 4pc style). */
export function elementStacks(inst: Instance, p: Player, el: Element | null): number {
  const es = p.ctx.powers.elementStacks;
  if (!es) return 0;
  if (el && es.elements.includes(el)) p.lastEle[el] = inst.t;
  let n = 0;
  for (const e of es.elements) if (inst.t - (p.lastEle[e] ?? -1e9) <= es.windowMs) n++;
  return n;
}

/** Target-independent per-hit multipliers, applied one by one (same order and arithmetic as before templates). */
export function applyHitTerms(inst: Instance, p: Player, m: number, skill: string, el: Element): number {
  for (const t of p.ctx.powers.hitTerms) {
    if (t.kind === 'stacks') { const n = elementStacks(inst, p, el); if (n) m *= 1 + t.pct / 100 * n; }
    else if (t.kind === 'cycle') {
      const cyc = p.ctx.powers.elementCycle!;
      if (t.pct && cyc.elements[p.ouroIdx % cyc.elements.length] === el) m *= 1 + t.pct / 100;
    } else if ((!t.skills || t.skills.includes(skill)) && holds(p, t.when!, el)) m *= 1 + t.pct / 100;
  }
  return m;
}

/** Extra target-state factors that could not be folded into stunMult / frozenMult. */
export function vulnTermsFactor(p: Player, m: Mob, skill: string | undefined): number {
  let v = 1;
  for (const t of p.ctx.powers.vulnTerms) {
    if (t.skills && (!skill || !t.skills.includes(skill))) continue;
    const on = t.state === 'stunned' ? m.stunMs > 0 : t.state === 'frozen' ? m.freezeMs > 0 : t.state === 'chilled' ? m.chillMs > 0
      : t.state === 'bleeding' ? m.dots.some((d) => d.kind === 'bleed') : false;
    if (on) v *= 1 + t.pct / 100;
  }
  return v;
}

/** Run the procs for a trigger (no RNG is used unless a proc has a `chance`). */
export function firePowerProcs(inst: Instance, p: Player, on: ProcTrigger) {
  const list = p.ctx.powers.procs[on];
  if (!list) return;
  for (const pr of list) {
    if (pr.chance !== undefined && inst.rng.next() >= pr.chance) continue;
    if (pr.reduceMs) for (const [k, v] of p.readyAt) p.readyAt.set(k, v - pr.reduceMs);
    if (pr.resource > 0) p.res = Math.min(p.mres, p.res + pr.resource);
    if (pr.buff) addBuff(p, { ...pr.buff });
  }
}

/** Buff ids and id prefixes a list of effects can grant. */
function buffGrants(effects: readonly PowerEffect[], into = { ids: new Set<string>(), prefixes: [] as string[] }) {
  for (const e of effects) {
    if (e.kind === 'proc' && e.buff) into.ids.add(e.buff.id);
    else if (e.kind === 'elementStacks' && e.buff) into.ids.add(e.buff);
    else if (e.kind === 'elementCycle' && !into.prefixes.includes(`${e.buffPrefix}_`)) into.prefixes.push(`${e.buffPrefix}_`);
  }
  return into;
}

/** Every buff any power in the catalogue can grant (computed once; content is static at run time). */
let catalogue: { ids: Set<string>; prefixes: string[] } | null = null;
function powerBuffCatalogue() {
  if (catalogue) return catalogue;
  const c = { ids: new Set<string>(), prefixes: [] as string[] };
  for (const l of Object.values(LEGENDARIES)) buffGrants(l.effects, c);
  for (const s of Object.values(SETS)) for (const b of s.bonuses) buffGrants(b.effects ?? [], c);
  for (const p of PASSIVES) buffGrants(p.effects ?? [], c);
  for (const s of Object.values(SKILLS)) for (const n of s.nodes ?? []) buffGrants(n.effects ?? [], c);
  return (catalogue = c);
}

/** Drop buffs that come from powers which are no longer active (called on every stat refresh). */
export function dropInactivePowerBuffs(p: Player) {
  const cat = powerBuffCatalogue(), active = p.ctx.powers.grants;
  for (const b of [...p.buffs]) {
    const fromPower = cat.ids.has(b.id) || cat.prefixes.some((x) => b.id.startsWith(x));
    if (fromPower && !active.ids.has(b.id) && !active.prefixes.some((x) => b.id.startsWith(x))) removeBuff(p, b.id);
  }
}
