// The one power-template interpreter of the simulation. buildPowerRuntime turns the active sources
// (shared/src/powerSources.ts, canonical order) into the per-player tables the combat code reads:
//   skill mods per strike id · own-bucket multipliers (static × cast-time conditions, capped) · per-hit multipliers ·
//   target conditions (vulnerability position) · procs · element stacks / cycle · buffs granted by powers ·
//   (engine wave 2) defensive terms · projectile rules · dot rules · stacking buffs · resource debt · deflection ·
//   rule changes (charges, channel movement, buff upkeep, spend refunds, following grounds, state aliases).
// Tag queries and target lists are resolved here, once per stat rebuild; nothing resolves tags per hit.
// Tag resolution order (one fixed order, FOUNDATION.md §11.2): 1 skill tags + equipped rune add/remove (+ v1 aliases) →
// 2 sub-strikes and data grounds inherit their owner's tags → 3 tagGrant templates, all read the index of step 2 at
// once (no chaining), sub-strikes / grounds also get their owner's grants → 4 proc strike ids join with their own
// tags → 5 every other tag-keyed effect resolves against that final index.
// Every multiplication happens in the canonical source order, which reproduces the pre-template code bit for bit.
// Proc actions that deal damage or create entities live in powerActions.ts; per-tick and defensive hooks too.

import { addBuff, getBuff, refreshLive, removeBuff } from './effects';
import { GROUND_DEFS } from '../../../shared/src/data/grounds';
import {
  ITEM_COUNT_CAP, OWN_BUCKET_CAP, SUB_STRIKES, amount, isTargetCondition,
  type BuffGrant, type Condition, type PowerEffect, type ProcTrigger, type StatusKind, type StatusSpec, type TargetState, type Targets,
} from '../../../shared/src/powers';
import type { PowerSource } from '../../../shared/src/powerSources';
import { LEGENDARIES, SETS } from '../../../shared/src/data/items';
import { PASSIVES } from '../../../shared/src/passives';
import { SKILLS, TAG_ALIASES, matchesTags, mergeMods, skillTags, type Element, type SkillMods, type SkillTag, type TagQuery } from '../shared';
import type { Instance } from './instance';
import { repeatAttack, runProcActions } from './powerActions';
import type { Mob, Player, PowerState } from './types';

/** A condition with its tag queries already resolved to skill-id sets. */
export type RCondition =
  | Exclude<Condition, { channeling: unknown } | { all: unknown } | { any: unknown }>
  | { channeling: true } | { channelingIn: ReadonlySet<string> } | { all: RCondition[] } | { any: RCondition[] };
export interface OwnTerm { when: RCondition; skills: ReadonlySet<string> | null; pct: number }
export interface HitTerm { kind: 'stacks' | 'cycle' | 'cond'; skills: ReadonlySet<string> | null; when?: RCondition; pct: number }
export interface VulnTerm { when: RCondition; skills: ReadonlySet<string> | null; pct: number }
export type Buff = { id: string; ms: number; dmg?: number; chc?: number; chd?: number; ias?: number; sdmg?: number; dr?: number; cci?: boolean; cdrec?: number; mv?: number };
/** A status with its vulnerability scope resolved. */
export type RStatus = StatusSpec & { at?: 'target' | 'self'; scope: ReadonlySet<string> | null };
export interface ProcRuntime {
  chance?: number; reduceMs: number; resource: number; buff: Buff | null;
  /** Wave 2 (absent on procs that do not use them, so legacy procs stay the same objects). */
  key?: string; icdMs?: number; skills?: ReadonlySet<string>; status?: readonly StatusKind[]; minHitPct?: number; buffMax?: number; every?: number; repeat?: boolean;
  /** Gate: the proc fires only while this condition holds (warrior pilot addition). */
  when?: RCondition;
  reset?: readonly string[];
  strike?: { id: string; coef: number; radius: number; el?: Element; at: 'target' | 'self'; visual?: string };
  summon?: { type: string; skill: string; lifeMs: number; at: 'target' | 'self'; max?: number };
  ground?: { def: string; at: 'target' | 'self'; scale: number; carryDot?: boolean };
  lifePct?: number;
  castSkill?: { ids: ReadonlySet<string> | null; pick: 'longestCooldown' | 'first' };
  applyStatus?: RStatus;
  clear?: { range: number; half: number };
}
/** Context of a trigger: the strike / skill, the enemy, the status applied, the damage taken. */
/** Context of a trigger: the strike / skill, the enemy, the status applied, the damage taken, Life before the hit. */
export interface ProcContext { skill?: string; mob?: Mob | null; status?: StatusKind; amount?: number; el?: Element; hpBefore?: number }

export interface DefenseRuntime {
  /** Product of unconditional damage-taken factors (per-legendary and no-set terms folded in at build). */
  takenStatic: number;
  /** Conditional factors; target conditions are tested against the attacking monster. */
  takenTerms: { when: RCondition; pct: number }[];
  firstHit: { pct: number; windowMs: number; reset: readonly StatusKind[] | null }[];
  cheat: { lifePct: number; cooldownMs: number; invulnMs: number; when: RCondition | null; reset: readonly string[] | null; buff: Buff | null; rearm: readonly string[] | null }[];
  /** controlImmunity terms (when null = always; bits 1 stun, 2 freeze, 4 pull). */
  immune: { when: RCondition | null; bits: number }[];
}
export interface ProjRule {
  distPct: number; distAt: number; bounces: number; bounceScale: number; retarget: boolean;
  seekMarked: { turn: number; range: number } | null; returns: boolean; rangeRicochet: boolean;
}
export interface StackRule {
  buff: string; source: 'distance' | 'kills' | 'channel'; per: number; max: number; decayMs: number; decay: 'all' | 'one';
  skills: ReadonlySet<string> | null; sdmg: number; sias: number; smv: number; onMax: { buff: Buff | null; reset: boolean } | null;
  /** kills: target condition on the killed enemy. */
  when: RCondition | null;
}

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
  // ── engine wave 2 ──
  /** The tag index the runtime was built with (+ proc strike ids): resolves ground-status scopes lazily. */
  index: TagIndex;
  defense: DefenseRuntime | null;
  /** Projectile rules per strike id (null key = every projectile). */
  projRules: { skills: ReadonlySet<string> | null; rule: ProjRule }[];
  dotRules: { kind: 'bleed' | 'burn' | 'poison'; skills: ReadonlySet<string> | null; stacks: number; strength: number; carry: number; also?: 'bleed' | 'burn' | 'poison'; el?: Element }[];
  stacking: StackRule[];
  debt: { skills: ReadonlySet<string> | null; max: number; regenPct: number }[];
  deflect: { range: number; half: number; when: RCondition | null }[];
  /** A status applied by this player must be reported (applyStatus procs, first-hit resets). */
  statusWatch: boolean;
  /** standingStillMs conditions are active (track Player.pw.stillMs). */
  tracksStill: boolean;
  /** Something needs the per-tick power hook (powerActions.powerTick). */
  ticks: boolean;
  /** Rule changes (RuleChange in shared/src/powers.ts). */
  rules: {
    /** Extra charges per skill id ('*' = every skill). */
    charges: Map<string, number>;
    channelMove: { skills: ReadonlySet<string> | null; pct: number }[];
    buffUpkeep: { skills: ReadonlySet<string> | null; everyMs: number }[];
    spendRefund: { skills: ReadonlySet<string> | null; pct: number; minHits: number; windowMs: number }[];
    /** Radius scale of following grounds (0 = grounds stay where placed). */
    groundsFollow: number;
    /** Target state → other states that also count as it. */
    aliases: Partial<Record<TargetState, TargetState[]>>;
    /** markSpread range (0 = off). */
    markSpread: number;
    /** Resource never decays (rule noDecay). */
    noDecay: boolean;
  };
  /** Largest noEnemyWithin radius in use (0 = not tracked). */
  nearRange: number;
}

/** Inputs the build needs from the character (computed once per stat build). */
export interface PowerCounts {
  /** Equipped legendary items and whether any set bonus is active (shared/src/stats.ts powerCounts). */
  legendaries: number; setBonus: boolean;
  /** Skill bar slots (tagGrant fromSlot). */
  slots?: readonly (string | null)[];
}

/** [P] Spend-refund window when the rule does not say (a cast's projectiles land within about a second [M] lifeMs). */
const SPEND_REFUND_WINDOW_MS = 1000;

/** Sub-strikes (and ground effects) carry their own tags plus their owner's; added when the owner is in the index. */
function withSubStrikes(out: Map<string, ReadonlySet<SkillTag>>): TagIndex {
  for (const [sub, def] of Object.entries(SUB_STRIKES)) {
    const owner = out.get(def.owner);
    if (owner) out.set(sub, def.tags?.length ? new Set([...owner, ...def.tags]) : owner);
  }
  for (const g of Object.values(GROUND_DEFS)) {
    const owner = g.owner ? out.get(g.owner) : undefined;
    if (g.owner && !owner) continue;
    out.set(g.id, new Set<SkillTag>([...(owner ?? []), ...(g.tags ?? []), 'ground', ...(g.element ? [g.element] : [])]));
  }
  return out;
}

/** Tag index from base data (no runes): used when no character is given (tests, catalogue scans). */
export function baseTagIndex(): TagIndex {
  const out = new Map<string, ReadonlySet<SkillTag>>();
  for (const s of Object.values(SKILLS)) out.set(s.id, skillTags(s));
  return withSubStrikes(out);
}

/** Tag index for a character: its class skills with the equipped runes (+ sub-strikes inherit their owner's tags). */
export function tagIndexFor(classId: string, runes: Readonly<Record<string, string | null>>): TagIndex {
  const out = new Map<string, ReadonlySet<SkillTag>>();
  for (const s of Object.values(SKILLS)) if (s.classId === classId) out.set(s.id, skillTags(s, runes[s.id]));
  return withSubStrikes(out);
}

/** Step 3 of tag resolution: tagGrant templates, evaluated together against the ungranted index. */
function withTagGrants(sources: readonly PowerSource[], index: TagIndex, slots: readonly (string | null)[] | undefined): TagIndex {
  const grants: [readonly string[], SkillTag[]][] = [];
  for (const src of sources) for (const e of src.effects) {
    if (e.kind !== 'tagGrant') continue;
    const add = new Set<SkillTag>(e.add ?? []);
    if (e.fromSlot !== undefined) { const id = slots?.[e.fromSlot], t = id ? index.get(id) : undefined; if (t) for (const x of t) add.add(x); }
    for (const t of [...add]) { const a = TAG_ALIASES[t]; if (a) add.add(a); }
    if (add.size) grants.push([resolveTargets(e, index) ?? [...index.keys()], [...add]]);
  }
  if (!grants.length) return index;
  const out = new Map(index);
  const addTo = (id: string, tags: SkillTag[]) => { const cur = out.get(id); if (cur) out.set(id, new Set([...cur, ...tags])); };
  for (const [ids, tags] of grants) for (const id of ids) {
    addTo(id, tags);
    for (const [sub, def] of Object.entries(SUB_STRIKES)) if (def.owner === id && !ids.includes(sub)) addTo(sub, tags);
    for (const g of Object.values(GROUND_DEFS)) if (g.owner === id && !ids.includes(g.id)) addTo(g.id, tags);
  }
  return out;
}

/** Proc strikes are strike ids of their own: their authored tags (+ element) join the index so templates can target them. */
function withProcStrikes(sources: readonly PowerSource[], index: TagIndex): TagIndex {
  let out: Map<string, ReadonlySet<SkillTag>> | null = null;
  for (const src of sources) for (const e of src.effects) {
    if (e.kind !== 'proc' || !e.strike || index.has(e.strike.id)) continue;
    out ??= new Map(index);
    out.set(e.strike.id, new Set<SkillTag>([...(e.strike.tags ?? []), ...(e.strike.element ? [e.strike.element] : [])]));
  }
  return out ?? index;
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
  if ('all' in c) return { all: c.all.map((x) => resolveCondition(x, index)) };
  if ('any' in c) return { any: c.any.map((x) => resolveCondition(x, index)) };
  if ('channeling' in c && typeof c.channeling === 'object') return { channelingIn: new Set(resolveQuery(c.channeling, index)) };
  if ('channeling' in c && typeof c.channeling === 'string') return { channelingIn: new Set([c.channeling]) };
  return c as RCondition;
}

/** Control kinds as bits (PowerState.ctrlImmune). */
export const CONTROL_BIT = { stun: 1, freeze: 2, pull: 4 } as const;

/** Largest noEnemyWithin radius inside a condition (0 = none). */
function nearRadius(c: Condition): number {
  if ('all' in c) return Math.max(0, ...c.all.map(nearRadius));
  if ('any' in c) return Math.max(0, ...c.any.map(nearRadius));
  return 'noEnemyWithin' in c ? c.noEnemyWithin : 0;
}

/** Does a condition (or any child) use this predicate? */
function uses(c: Condition | undefined, key: string): boolean {
  if (!c) return false;
  if ('all' in c) return c.all.some((x) => uses(x, key));
  if ('any' in c) return c.any.some((x) => uses(x, key));
  return key in c;
}

export function resolveStatus(s: StatusSpec & { at?: 'target' | 'self' }, index: TagIndex): RStatus {
  const ids = s.kind === 'vulnerable' ? resolveTargets(s, index) : null;
  return { ...s, scope: ids ? new Set(ids) : null };
}

function grantBuff(g: BuffGrant, roll: number): Buff {
  const b: Buff = { id: g.id, ms: g.ms };
  if (g.dmg !== undefined) b.dmg = amount(g.dmg, roll);
  if (g.chc !== undefined) b.chc = amount(g.chc, roll);
  if (g.chd !== undefined) b.chd = amount(g.chd, roll);
  if (g.ias !== undefined) b.ias = amount(g.ias, roll);
  if (g.stackIas !== undefined) b.ias = amount(g.stackIas, roll);
  if (g.stackDmg !== undefined) b.sdmg = amount(g.stackDmg, roll);
  if (g.dr !== undefined) b.dr = amount(g.dr, roll);
  if (g.ccImmune) b.cci = true;
  if (g.cdRecovery !== undefined) b.cdrec = amount(g.cdRecovery, roll);
  if (g.moveSpeed !== undefined) b.mv = amount(g.moveSpeed, roll);
  if (g.stackMoveSpeed !== undefined) b.mv = amount(g.stackMoveSpeed, roll);
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

function procRuntime(e: Extract<PowerEffect, { kind: 'proc' }>, roll: number, key: string, index: TagIndex): ProcRuntime {
  const pr: ProcRuntime = { chance: e.chance, reduceMs: amount(e.reduceCooldownsMs, roll), resource: amount(e.resource, roll), buff: e.buff ? grantBuff(e.buff, roll) : null };
  // Wave-2 fields are only set when authored, so a legacy proc is the same object shape as before.
  if (e.icdMs || e.skills || e.tags || e.status || e.minHitPct || e.buff?.maxStacks || e.resetCooldowns || e.strike || e.summon || e.ground || e.applyStatus || e.clearProjectiles || e.every || e.repeat || e.when || e.lifePct !== undefined || e.castSkill) pr.key = key;
  if (e.when) pr.when = resolveCondition(e.when, index);
  if (e.every && e.every > 1) pr.every = e.every;
  if (e.repeat) pr.repeat = true;
  if (e.icdMs) pr.icdMs = e.icdMs;
  if (e.skills || e.tags) pr.skills = new Set(resolveTargets(e, index) ?? []);
  if (e.status) pr.status = e.status;
  if (e.minHitPct) pr.minHitPct = e.minHitPct;
  if (e.buff?.maxStacks && e.buff.maxStacks > 1) pr.buffMax = e.buff.maxStacks;
  if (e.resetCooldowns) pr.reset = e.resetCooldowns;
  if (e.strike) pr.strike = { id: e.strike.id, coef: amount(e.strike.coef, roll), radius: e.strike.radius ?? 0, el: e.strike.element, at: e.strike.at ?? 'target', visual: e.strike.visual };
  if (e.summon) pr.summon = { ...e.summon, at: e.summon.at ?? 'target' };
  if (e.ground) pr.ground = { def: e.ground.def, at: e.ground.at ?? 'target', scale: e.ground.scale === undefined ? 1 : amount(e.ground.scale, roll), ...(e.ground.carryDot ? { carryDot: true } : {}) };
  if (e.lifePct !== undefined) pr.lifePct = e.lifePct;
  if (e.castSkill) pr.castSkill = { ids: e.castSkill.skills || e.castSkill.tags ? new Set(resolveTargets(e.castSkill, index) ?? []) : null, pick: e.castSkill.pick ?? 'first' };
  if (e.applyStatus) {
    const s = resolveStatus(e.applyStatus, index);
    if (s.pct !== undefined) s.pct = amount(s.pct, roll);
    if (s.coef !== undefined) s.coef = amount(s.coef, roll);
    pr.applyStatus = s;
  }
  if (e.clearProjectiles) pr.clear = { range: e.clearProjectiles.range, half: e.clearProjectiles.halfAngleDeg * Math.PI / 180 };
  return pr;
}

function defenseOf(rt: PowerRuntime): DefenseRuntime {
  return (rt.defense ??= { takenStatic: 1, takenTerms: [], firstHit: [], cheat: [], immune: [] });
}

export function buildPowerRuntime(sources: readonly PowerSource[], index: TagIndex = baseTagIndex(), counts: PowerCounts = { legendaries: 0, setBonus: false }): PowerRuntime {
  index = withProcStrikes(sources, withTagGrants(sources, index, counts.slots));
  const rt: PowerRuntime = {
    mods: new Map(), ownStatic: new Map(), ownTerms: [], hitTerms: [], stunFactor: 1, frozenFactor: 1, vulnTerms: [],
    procs: {}, elementStacks: null, elementCycle: null, grants: { ids: new Set(), prefixes: [] }, watchGround: false,
    index, defense: null, projRules: [], dotRules: [], stacking: [], debt: [], deflect: [], statusWatch: false, tracksStill: false, ticks: false,
    rules: { charges: new Map(), channelMove: [], buffUpkeep: [], spendRefund: [], groundsFollow: 0, aliases: {}, markSpread: 0, noDecay: false },
    nearRange: 0,
  };
  // State aliases first: an aliased stunned / frozen condition can no longer be folded into stunMult / frozenMult.
  for (const src of sources) for (const e of src.effects) if (e.kind === 'rule' && e.rule.id === 'countsAs') (rt.rules.aliases[e.rule.as] ??= []).push(e.rule.state);
  const itemCounts = new Map<string, { maxSummons: number; projectiles: number }>();
  const asSet = (ids: string[] | null) => (ids ? new Set(ids) : null);
  for (const src of sources) buffGrants(src.effects, rt.grants);
  for (const src of sources) src.effects.forEach((e, i) => {
    if ('when' in e && e.when) {
      if (uses(e.when, 'inOwnGround')) rt.watchGround = true;
      if (uses(e.when, 'standingStillMs')) rt.tracksStill = true;
      rt.nearRange = Math.max(rt.nearRange, nearRadius(e.when));
    }
    switch (e.kind) {
      case 'skillMods': {
        const fromItems = src.kind === 'set' || src.kind === 'legendary';
        for (const skill of resolveTargets(e, index) ?? []) {
          let m = rt.mods.get(skill) ?? { flags: [] };
          const used = itemCounts.get(skill) ?? { maxSummons: 0, projectiles: 0 };
          for (const part of effectMods(e, src.roll)) m = mergeMods(m, fromItems ? capCounts(part, used) : part);
          itemCounts.set(skill, used);
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
          if (!skills && st === 'stunned' && !rt.rules.aliases.stunned) rt.stunFactor *= 1 + pct / 100;
          else if (!skills && st === 'frozen' && !rt.rules.aliases.frozen) rt.frozenFactor *= 1 + pct / 100;
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
        const pr = procRuntime(e, src.roll, `${src.kind}:${src.id}:${i}`, index);
        (rt.procs[e.on] ??= []).push(pr);
        if (e.on === 'applyStatus') rt.statusWatch = true;
        break;
      }
      case 'damageTaken': {
        if (e.noSetBonus && counts.setBonus) break;
        let pct = amount(e.pct, src.roll);
        if (e.perLegendary) pct *= Math.min(e.perLegendary.max, counts.legendaries);
        const d = defenseOf(rt);
        if (e.when) d.takenTerms.push({ when: resolveCondition(e.when, index), pct });
        else d.takenStatic *= Math.max(0, 1 + pct / 100);
        break;
      }
      case 'firstHit': {
        defenseOf(rt).firstHit.push({ pct: amount(e.pct, src.roll), windowMs: e.windowMs, reset: e.resetOnStatus ?? null });
        if (e.resetOnStatus?.length) rt.statusWatch = true;
        break;
      }
      case 'cheatDeath':
        defenseOf(rt).cheat.push({ lifePct: e.lifePct, cooldownMs: e.cooldownMs, invulnMs: e.invulnMs ?? 0, when: e.when ? resolveCondition(e.when, index) : null,
          reset: e.resetCooldowns ?? null, buff: e.buff ? grantBuff(e.buff, src.roll) : null, rearm: e.rearmOnCast ?? null });
        break;
      case 'controlImmunity':
        defenseOf(rt).immune.push({ when: e.when ? resolveCondition(e.when, index) : null,
          bits: e.kinds ? e.kinds.reduce((b, k) => b | CONTROL_BIT[k], 0) : CONTROL_BIT.stun | CONTROL_BIT.freeze | CONTROL_BIT.pull });
        rt.ticks = true;
        break;
      case 'projectile':
        rt.projRules.push({ skills: asSet(resolveTargets(e, index)), rule: {
          distPct: e.distBonus ? amount(e.distBonus.pct, src.roll) : 0, distAt: e.distBonus?.atUnits ?? 1, bounces: e.bounces ?? 0,
          bounceScale: e.bounceScale ?? 1, retarget: !!e.retarget, seekMarked: e.seekMarked ?? null, returns: !!e.returns, rangeRicochet: !!e.rangeRicochet,
        } });
        break;
      case 'deflect':
        rt.deflect.push({ range: e.range, half: e.halfAngleDeg * Math.PI / 180, when: e.when ? resolveCondition(e.when, index) : null });
        rt.ticks = true;
        break;
      case 'dot':
        rt.dotRules.push({ kind: e.dot, skills: asSet(resolveTargets(e, index)), stacks: Math.max(1, e.stacks ?? 1), strength: (e.strengthPct ?? 100) / 100,
          carry: e.carryPct === undefined ? 0 : amount(e.carryPct, src.roll), ...(e.alsoKind ? { also: e.alsoKind } : {}), ...(e.element ? { el: e.element } : {}) });
        break;
      case 'stacking':
        rt.stacking.push({ buff: e.buff, source: e.source, per: e.per, max: e.max, decayMs: e.decayMs, decay: e.decay ?? 'all',
          skills: asSet(resolveTargets(e, index)), sdmg: e.stackDmg === undefined ? 0 : amount(e.stackDmg, src.roll),
          sias: e.stackIas === undefined ? 0 : amount(e.stackIas, src.roll), smv: e.stackMoveSpeed === undefined ? 0 : amount(e.stackMoveSpeed, src.roll),
          onMax: e.onMax ? { buff: e.onMax.buff ? grantBuff(e.onMax.buff, src.roll) : null, reset: !!e.onMax.reset } : null,
          when: e.when ? resolveCondition(e.when, index) : null });
        rt.ticks = true;
        break;
      case 'resourceDebt':
        rt.debt.push({ skills: asSet(resolveTargets(e, index)), max: e.max, regenPct: e.regenPct ?? 0 });
        break;
      case 'rule': {
        const r = e.rule, skills = asSet(resolveTargets(e, index));
        switch (r.id) {
          case 'charges': for (const id of skills ?? ['*']) rt.rules.charges.set(id, (rt.rules.charges.get(id) ?? 0) + r.extra); break;
          case 'channelMove': rt.rules.channelMove.push({ skills, pct: r.pct }); break;
          case 'buffUpkeep': rt.rules.buffUpkeep.push({ skills, everyMs: r.everyMs }); rt.ticks = true; break;
          case 'spendRefund': rt.rules.spendRefund.push({ skills, pct: r.pct, minHits: r.minHits, windowMs: r.windowMs ?? SPEND_REFUND_WINDOW_MS }); break;
          case 'groundsFollow': if (!rt.rules.groundsFollow) rt.rules.groundsFollow = r.scale; break;
          case 'countsAs': break; // pre-pass above
          case 'markSpread': rt.rules.markSpread = Math.max(rt.rules.markSpread, r.range); rt.statusWatch = true; break;
          case 'noDecay': rt.rules.noDecay = true; break;
        }
        break;
      }
      case 'tagGrant': break; // resolved into the index before this loop
      case 'setReduce': break; // set counting (shared/src/powerSources.ts)
      case 'stat': case 'dashCooldown': break; // character sheet (shared/src/stats.ts)
    }
  });
  if (rt.tracksStill || rt.nearRange) rt.ticks = true;
  return rt;
}

// ─────────────────────────── Evaluation ───────────────────────────

const isElite = (m: Mob) => m.tier === 1 || m.tier === 2 || m.tier === 4;

/**
 * How many times a condition holds: 0 = no, 1 = yes, k = the capped count of a scaling condition (stacks, summons).
 * Target predicates need the enemy (`m`); without one they do not hold. `all` multiplies its children's counts (0 if
 * any fails), `any` takes the largest.
 */
function stateHolds(m: Mob, s: TargetState): boolean {
  switch (s) {
    case 'stunned': return m.stunMs > 0;
    case 'frozen': return m.freezeMs > 0;
    case 'chilled': return m.chillMs > 0;
    case 'bleeding': return m.dots.some((d) => d.kind === 'bleed' || d.also === 'bleed');
    case 'burning': return m.dots.some((d) => d.kind === 'burn' || d.also === 'burn');
    case 'slowed': return m.chillMs > 0 || (!!m.ps && m.ps.slowMs > 0);
    case 'immobilised': return m.stunMs > 0 || m.freezeMs > 0;
    case 'inBlackHole': return m.inHoleMs > 0;
    case 'marked': return m.markMs > 0;
    case 'weakened': return !!m.ps && m.ps.weakenMs > 0;
  }
}

export function conditionCount(p: Player, w: RCondition, el: Element | undefined, m: Mob | null): number {
  if ('targetState' in w) {
    if (!m) return 0;
    if (stateHolds(m, w.targetState)) return 1;
    const al = p.ctx.powers.rules.aliases[w.targetState];
    if (al) for (const s of al) if (stateHolds(m, s)) return 1;
    return 0;
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
  if ('all' in w) { let n = 1; for (const c of w.all) { n *= conditionCount(p, c, el, m); if (!n) return 0; } return n; }
  if ('any' in w) { let n = 0; for (const c of w.any) n = Math.max(n, conditionCount(p, c, el, m)); return n; }
  if ('targetElite' in w) return m && isElite(m) ? 1 : 0;
  if ('targetControlledWithinMs' in w) return m && (m.stunMs > 0 || m.freezeMs > 0 || m.kbMs > 0 || (m.ctrlAgo ?? Infinity) <= w.targetControlledWithinMs) ? 1 : 0;
  if ('standingStillMs' in w) return !p.moving && (p.pw?.stillMs ?? 0) >= w.standingStillMs ? 1 : 0;
  if ('inDebt' in w) return p.res < 0 ? 1 : 0;
  if ('noEnemyWithin' in w) return (p.pw?.nearDist ?? Infinity) > w.noEnemyWithin ? 1 : 0;
  if ('targetInFront' in w || 'targetBehind' in w) {
    if (!m) return 0;
    const face = Math.atan2(p.mv.faceY, p.mv.faceX), to = Math.atan2(m.y - p.y, m.x - p.x);
    let d = Math.abs(to - face) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return 'targetInFront' in w ? (d <= w.targetInFront * Math.PI / 180 ? 1 : 0) : (Math.PI - d <= w.targetBehind * Math.PI / 180 ? 1 : 0);
  }
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

/** The player's wave-2 power state (created on first use). */
export function powerState(p: Player): PowerState {
  return (p.pw ??= { icd: new Map(), firstHitAt: [], cheatAt: [], stillMs: 0, lastX: p.x, lastY: p.y, progress: new Map(), gainT: new Map(), ctrlImmune: 0, cast: null, counts: new Map(), nearDist: Infinity });
}

/** Add a stack to a stacking buff (refreshing its duration), or create it at one stack. */
export function stackBuff(p: Player, b: Buff, max: number, n = 1) {
  const cur = getBuff(p, b.id);
  if (cur) { cur.st = Math.min(max, (cur.st ?? 1) + n); cur.ms = b.ms; refreshLive(p); }
  else addBuff(p, { ...b, st: Math.min(max, n) });
}

/** Proc chains: actions run one level deeper; hit / crit / takeDamage only trigger from depth 0, others up to depth 1. */
let procDepth = 0;
const ROOT_ONLY: Partial<Record<ProcTrigger, true>> = { hit: true, crit: true, takeDamage: true, attack: true };

/** Run the procs for a trigger (no RNG is used unless a proc has a `chance`). */
export function firePowerProcs(inst: Instance, p: Player, on: ProcTrigger, c?: ProcContext) {
  const list = p.ctx.powers.procs[on];
  if (!list) return;
  if (procDepth > (ROOT_ONLY[on] ? 0 : 1)) return;
  for (const pr of list) {
    if (pr.key !== undefined) {
      if (pr.skills && (!c?.skill || !pr.skills.has(c.skill))) continue;
      if (pr.status && (!c?.status || !pr.status.includes(c.status))) continue;
      if (pr.minHitPct && !(c?.amount !== undefined && c.amount >= p.mhp * pr.minHitPct / 100)) continue;
      if (pr.lifePct !== undefined) { const th = p.mhp * pr.lifePct / 100; if (!(c?.hpBefore !== undefined && c.hpBefore >= th && p.hp < th && p.hp > 0)) continue; }
      if (pr.icdMs && (p.pw?.icd.get(pr.key) ?? -Infinity) > inst.t) continue;
      if (pr.when && !conditionCount(p, pr.when, c?.el, c?.mob ?? null)) continue;
      if (pr.every) {
        const counts = powerState(p).counts, n = (counts.get(pr.key) ?? 0) + 1;
        counts.set(pr.key, n);
        if (n % pr.every) continue;
      }
    }
    if (pr.chance !== undefined && inst.rng.next() >= pr.chance) continue;
    if (pr.icdMs) powerState(p).icd.set(pr.key!, inst.t + pr.icdMs);
    if (pr.reduceMs) for (const [k, v] of p.readyAt) p.readyAt.set(k, v - pr.reduceMs);
    if (pr.resource > 0) p.res = Math.min(p.mres, p.res + pr.resource);
    if (pr.buff) { if (pr.buffMax) stackBuff(p, pr.buff, pr.buffMax); else addBuff(p, { ...pr.buff }); }
    if (pr.reset) for (const id of pr.reset) p.readyAt.delete(id);
    if (pr.repeat && c?.mob && !c.mob.dead) repeatAttack(inst, p, c.mob); // at this depth: its hits behave like the attack's
    if (pr.strike || pr.summon || pr.ground || pr.applyStatus || pr.clear || pr.castSkill) {
      procDepth++;
      try { runProcActions(inst, p, pr, c); } finally { procDepth--; }
    }
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
    else if (e.kind === 'cheatDeath' && e.buff) into.ids.add(e.buff.id);
    else if (e.kind === 'stacking') { into.ids.add(e.buff); if (e.onMax?.buff) into.ids.add(e.onMax.buff.id); }
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
  for (const s of Object.values(SKILLS)) { for (const n of s.nodes ?? []) buffGrants(n.effects ?? [], c); for (const r of s.runes) buffGrants(r.effects ?? [], c); }
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
