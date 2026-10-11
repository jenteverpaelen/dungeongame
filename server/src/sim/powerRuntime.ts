// The one power-template interpreter of the simulation. buildPowerRuntime turns the active sources
// (shared/src/powerSources.ts, canonical order) into the per-player tables the combat code reads:
//   skill mods per strike id · own-bucket multipliers (static × cast-time conditions, capped) · per-hit multipliers ·
//   target conditions (vulnerability position) · procs · element stacks / cycle · buffs granted by powers.
// Tag queries and target lists are resolved here, once per stat rebuild; nothing resolves tags per hit.
// Every multiplication happens in the canonical source order, which reproduces the pre-template code bit for bit.

import { addBuff, getBuff, removeBuff } from './effects';
import {
  ITEM_COUNT_CAP, OWN_BUCKET_CAP, SUB_STRIKES, amount, isTargetCondition,
  type BuffGrant, type Condition, type PowerEffect, type ProcTrigger, type Targets,
} from '../../../shared/src/powers';
import type { PowerSource } from '../../../shared/src/powerSources';
import { LEGENDARIES, SETS } from '../../../shared/src/data/items';
import { PASSIVES } from '../../../shared/src/passives';
import { SKILLS, matchesTags, mergeMods, skillTags, type Element, type SkillMods, type SkillTag, type TagQuery } from '../shared';
import type { Instance } from './instance';
import type { Mob, Player } from './types';

/** A condition with its tag queries already resolved to skill-id sets. */
type RCondition = Exclude<Condition, { channeling: unknown }> | { channeling: true } | { channelingIn: ReadonlySet<string> };
export interface OwnTerm { when: RCondition; skills: ReadonlySet<string> | null; pct: number }
export interface HitTerm { kind: 'stacks' | 'cycle' | 'cond'; skills: ReadonlySet<string> | null; when?: RCondition; pct: number }
export interface VulnTerm { when: RCondition; skills: ReadonlySet<string> | null; pct: number }
export interface ProcRuntime { chance?: number; reduceMs: number; resource: number; buff: Buff | null }
type Buff = { id: string; ms: number; dmg?: number; chc?: number; chd?: number; ias?: number };

/** Tags per strike id for one character (class skills with their equipped runes, plus sub-strikes). */
export type TagIndex = ReadonlyMap<string, ReadonlySet<SkillTag>>;

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
  /** Target conditions that cannot be folded (other predicates, or filtered to skills). */
  vulnTerms: VulnTerm[];
  procs: Partial<Record<ProcTrigger, ProcRuntime[]>>;
  elementStacks: { elements: readonly Element[]; windowMs: number; perStack: number; buff?: string } | null;
  elementCycle: { elements: readonly Element[]; periodMs: number; pct: number; buffPrefix: string } | null;
  /** Buff ids / prefixes the active powers can grant (others from the power catalogue are dropped on refresh). */
  grants: { ids: Set<string>; prefixes: string[] };
  /** Some active condition needs `Player.inOwnGround` (updated per tick only then). */
  watchGround: boolean;
}

/** Tag index from base data (no runes): used when no character is given (tests, catalogue scans). */
export function baseTagIndex(): TagIndex {
  const out = new Map<string, ReadonlySet<SkillTag>>();
  for (const s of Object.values(SKILLS)) out.set(s.id, skillTags(s));
  for (const [sub, owner] of Object.entries(SUB_STRIKES)) if (out.has(owner)) out.set(sub, out.get(owner)!);
  return out;
}

/** Tag index for a character: its class skills with the equipped runes (+ sub-strikes inherit their owner's tags). */
export function tagIndexFor(classId: string, runes: Readonly<Record<string, string | null>>): TagIndex {
  const out = new Map<string, ReadonlySet<SkillTag>>();
  for (const s of Object.values(SKILLS)) if (s.classId === classId) out.set(s.id, skillTags(s, runes[s.id]));
  for (const [sub, owner] of Object.entries(SUB_STRIKES)) if (out.has(owner)) out.set(sub, out.get(owner)!);
  return out;
}

function resolveQuery(q: TagQuery, index: TagIndex): string[] {
  const out: string[] = [];
  for (const [id, tags] of index) if (matchesTags(tags, q)) out.push(id);
  return out;
}

/** Strike ids an effect applies to (named skills ∪ tag matches), or null for "every strike". */
export function resolveTargets(t: Targets, index: TagIndex): string[] | null {
  if (!t.skills && !t.tags) return null;
  const ids = new Set(t.skills ?? []);
  if (t.tags) for (const id of resolveQuery(t.tags, index)) ids.add(id);
  return [...ids];
}

function resolveCondition(c: Condition, index: TagIndex): RCondition {
  if ('channeling' in c && typeof c.channeling === 'object') return { channelingIn: new Set(resolveQuery(c.channeling, index)) };
  if ('channeling' in c && typeof c.channeling === 'string') return { channelingIn: new Set([c.channeling]) };
  return c as RCondition;
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

/** Clamp extra summons / projectiles from items and sets to ITEM_COUNT_CAP per skill (other sources are not counted). */
function capCounts(part: SkillMods, used: { maxSummons: number; projectiles: number }): SkillMods {
  let out = part;
  for (const k of ['maxSummons', 'projectiles'] as const) {
    const v = part[k];
    if (!v || v < 0) continue;
    const allowed = Math.max(0, Math.min(v, ITEM_COUNT_CAP[k] - used[k]));
    used[k] += allowed;
    if (allowed !== v) out = { ...out, [k]: allowed };
  }
  return out;
}

const ownFactor = (pct: number) => 1 + pct / 100;

export function buildPowerRuntime(sources: readonly PowerSource[], index: TagIndex = baseTagIndex()): PowerRuntime {
  const rt: PowerRuntime = {
    mods: new Map(), ownStatic: new Map(), ownTerms: [], hitTerms: [], stunFactor: 1, frozenFactor: 1, vulnTerms: [],
    procs: {}, elementStacks: null, elementCycle: null, grants: { ids: new Set(), prefixes: [] }, watchGround: false,
  };
  const counts = new Map<string, { maxSummons: number; projectiles: number }>();
  const asSet = (ids: string[] | null) => (ids ? new Set(ids) : null);
  for (const src of sources) buffGrants(src.effects, rt.grants);
  for (const src of sources) for (const e of src.effects) {
    if ('when' in e && e.when && 'inOwnGround' in e.when) rt.watchGround = true;
    switch (e.kind) {
      case 'skillMods': {
        const fromItems = src.kind === 'set' || src.kind === 'legendary';
        for (const skill of resolveTargets(e, index) ?? []) {
          let m = rt.mods.get(skill) ?? { flags: [] };
          const used = counts.get(skill) ?? { maxSummons: 0, projectiles: 0 };
          for (const part of effectMods(e, src.roll)) m = mergeMods(m, fromItems ? capCounts(part, used) : part);
          counts.set(skill, used);
          rt.mods.set(skill, m);
        }
        break;
      }
      case 'ownMult':
        for (const skill of resolveTargets(e, index) ?? []) rt.ownStatic.set(skill, (rt.ownStatic.get(skill) ?? 1) * e.mult);
        break;
      case 'skillMore': {
        const pct = amount(e.pct, src.roll), skills = resolveTargets(e, index) ?? [];
        if (!e.when) for (const skill of skills) rt.ownStatic.set(skill, (rt.ownStatic.get(skill) ?? 1) * ownFactor(pct));
        else if (isTargetCondition(e.when)) rt.vulnTerms.push({ when: resolveCondition(e.when, index), skills: new Set(skills), pct });
        else rt.ownTerms.push({ when: resolveCondition(e.when, index), skills: new Set(skills), pct });
        break;
      }
      case 'conditional': {
        const pct = amount(e.pct, src.roll), skills = asSet(resolveTargets(e, index)), when = resolveCondition(e.when, index);
        if (e.bucket === 'own') rt.ownTerms.push({ when, skills, pct });
        else if ('targetState' in e.when) {
          const st = e.when.targetState;
          if (!skills && st === 'stunned') rt.stunFactor *= 1 + pct / 100;
          else if (!skills && st === 'frozen') rt.frozenFactor *= 1 + pct / 100;
          else rt.vulnTerms.push({ when, skills, pct });
        } else if (isTargetCondition(e.when)) rt.vulnTerms.push({ when, skills, pct });
        else rt.hitTerms.push({ kind: 'cond', when, skills, pct });
        break;
      }
      case 'elementStacks':
        if (!rt.elementStacks) {
          rt.elementStacks = { elements: e.elements, windowMs: e.windowMs, perStack: e.perStack, buff: e.buff };
          rt.hitTerms.push({ kind: 'stacks', skills: null, pct: e.perStack });
        }
        break;
      case 'elementCycle':
        if (!rt.elementCycle) {
          rt.elementCycle = { elements: e.elements, periodMs: e.periodMs, pct: amount(e.pct, src.roll), buffPrefix: e.buffPrefix };
          rt.hitTerms.push({ kind: 'cycle', skills: null, pct: rt.elementCycle.pct });
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

/**
 * How many times a condition holds: 0 = no, 1 = yes, k = the capped count of a scaling condition (stacks, summons).
 * Target predicates need the enemy (`m`); without one they do not hold.
 */
function conditionCount(p: Player, w: RCondition, el: Element | undefined, m: Mob | null): number {
  if ('targetState' in w) {
    if (!m) return 0;
    switch (w.targetState) {
      case 'stunned': return m.stunMs > 0 ? 1 : 0;
      case 'frozen': return m.freezeMs > 0 ? 1 : 0;
      case 'chilled': return m.chillMs > 0 ? 1 : 0;
      case 'bleeding': return m.dots.some((d) => d.kind === 'bleed') ? 1 : 0;
      case 'immobilised': return m.stunMs > 0 || m.freezeMs > 0 ? 1 : 0;
      case 'inBlackHole': return m.inHoleMs > 0 ? 1 : 0;
    }
  }
  if ('targetLifeAbovePct' in w) return m && m.hp > m.mhp * w.targetLifeAbovePct / 100 ? 1 : 0;
  if ('targetFartherThan' in w) return m && Math.hypot(m.x - p.x, m.y - p.y) > w.targetFartherThan ? 1 : 0;
  if ('channeling' in w) return p.channel ? 1 : 0;
  if ('channelingIn' in w) return p.channel && w.channelingIn.has(p.channel.skill) ? 1 : 0;
  if ('buff' in w) return getBuff(p, w.buff) ? 1 : 0;
  if ('buffStacks' in w) { const b = getBuff(p, w.buffStacks); return b ? Math.min(w.max, b.st ?? 1) : 0; }
  if ('perSummon' in w) { let n = 0; for (const s of p.summons) if (s.type === w.perSummon && !s.dead) n++; return Math.min(w.max, n); }
  if ('standingStill' in w) return p.moving ? 0 : 1;
  if ('inOwnGround' in w) return p.inOwnGround ? 1 : 0;
  if ('element' in w) return el && w.element.includes(el) ? 1 : 0;
  if ('lifeBelowPct' in w) return p.hp < p.mhp * w.lifeBelowPct / 100 ? 1 : 0;
  if ('lifeAbovePct' in w) return p.hp > p.mhp * w.lifeAbovePct / 100 ? 1 : 0;
  return 0;
}

/** Own-bucket multiplier of a strike (set bonuses, skillMore …): static × cast-time conditions, capped by OWN_BUCKET_CAP. */
export function ownMultiplier(p: Player, skillId: string): number {
  const pr = p.ctx.powers;
  let m = pr.ownStatic.get(skillId) ?? 1;
  for (const t of pr.ownTerms) {
    if (t.skills && !t.skills.has(skillId)) continue;
    const n = conditionCount(p, t.when, undefined, null);
    if (n) m *= 1 + t.pct / 100 * n;
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
    } else if (!t.skills || t.skills.has(skill)) { const n = conditionCount(p, t.when!, el, null); if (n) m *= 1 + t.pct / 100 * n; }
  }
  return m;
}

/** Target-condition factors (vulnerability position) that could not be folded into stunMult / frozenMult. */
export function vulnTermsFactor(p: Player, m: Mob, skill: string | undefined): number {
  let v = 1;
  for (const t of p.ctx.powers.vulnTerms) {
    if (t.skills && (!skill || !t.skills.has(skill))) continue;
    const n = conditionCount(p, t.when, undefined, m);
    if (n) v *= 1 + t.pct / 100 * n;
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

/** Per tick, only when an active condition asks for it: is the player inside one of their own ground effects? */
export function updateOwnGround(inst: Instance, p: Player) {
  if (!p.ctx.powers.watchGround) { p.inOwnGround = false; return; }
  p.inOwnGround = inst.grounds.some((g) => g.owner === p && g.endT > inst.t && Math.hypot(g.x - p.x, g.y - p.y) <= g.r);
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
