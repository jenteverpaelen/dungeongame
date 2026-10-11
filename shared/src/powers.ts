// Power templates: the small vocabulary legendary powers, set bonuses, passives and specialization nodes are composed
// from, as plain data (structured-cloneable, no functions). One interpreter on the server (server/src/sim/playerctx.ts)
// and the character sheet (shared/src/stats.ts) read these; tooltip text is generated from them or validated against
// them (powerTextIssues). Recipes: docs/rework/depth/FOUNDATION.md §5.

import { NUMERIC_MOD_KEYS, SKILLS, type SkillMods, type SkillTag, type TagQuery } from './data/skills';
import type { Element, StatId } from './types';

/**
 * Global cap on the own-bucket (set-style) damage multiplier of one strike. [M] 127 is the largest authored value
 * today (Cinder Oath six-piece), so the cap does not bind existing content; lower it when sets become capped
 * transformations (plan §3.1 lever 2) — the parity harness then shows the effect.
 */
export const OWN_BUCKET_CAP = 127;

/**
 * Most extra summons / projectiles one skill may get from items and set bonuses combined (runes, tiers, passives and
 * specialization nodes excluded), enforced where those bonuses are summed (server/src/sim/powerRuntime.ts). [M] 3 / 2
 * are today's largest totals (Sapper's Pack +2 with Siegebreaker 2pc +1 Sentry; Spindle of a Thousand Missiles +2), so
 * nothing binds now; the content bible (BUDGET.md R7) proposes 2 / 2 for the M1 retune.
 */
export const ITEM_COUNT_CAP = { maxSummons: 3, projectiles: 2 } as const;

/**
 * Strike ids that are not skills but may be targeted by templates (`skills: [...]`), with the skill that owns them.
 * Behaviour code builds these strikes (e.g. warrior.ts Dust Devils); add an entry when a new sub-strike id appears.
 */
export const SUB_STRIKES: Record<string, string> = { dust_devil: 'whirlwind', cleave_rupture: 'cleave' };

/** A literal number, or `roll × k` where roll is the item's rolled value (Cube: maximum), a node's rank, or 1. */
export type Amount = number | { roll: number };

export type NumericModKey = (typeof NUMERIC_MOD_KEYS)[number];

/**
 * Who an effect applies to: named skills / sub-strikes, a tag query, or both (union). Templates with neither apply to
 * every strike (conditional only). Tag queries are resolved once when the combat context is built (powerRuntime.ts).
 */
export type Targets = { skills?: string[]; tags?: TagQuery };
/** immobilised = stunned or frozen (and any future root); inBlackHole = inside any of your Black Holes. */
export type TargetState = 'stunned' | 'frozen' | 'chilled' | 'bleeding' | 'immobilised' | 'inBlackHole';

/**
 * The one condition predicate shared by `conditional`, `skillMore`, vulnerability and set bonuses. Target conditions are
 * evaluated per hit against the enemy; player conditions when the strike is made (own bucket) or per hit. Scaling
 * conditions (perSummon, buffStacks) multiply the bonus by a capped count: factor = 1 + pct % × count.
 */
export type Condition =
  // target (per hit)
  | { targetState: TargetState }
  | { targetLifeAbovePct: number }         // the enemy is above X % life
  | { targetFartherThan: number }          // the enemy is more than X units from you
  // player
  | { channeling: string | true | TagQuery } // while channelling (that skill, any skill, or a skill matching the tags)
  | { buff: string }                       // while you have this buff
  | { buffStacks: string; max: number }    // × stacks of this buff, capped (e.g. 6 % per stack, max 5)
  | { perSummon: string; max: number }     // × your active summons of this type, capped
  | { standingStill: true }
  | { inOwnGround: true }                  // standing inside one of your own ground effects
  | { lifeBelowPct: number }
  | { lifeAbovePct: number }
  // strike
  | { element: Element[] };                // the strike's element is one of these (per hit)

export const isTargetCondition = (c: Condition): boolean => 'targetState' in c || 'targetLifeAbovePct' in c || 'targetFartherThan' in c;

export interface BuffGrant { id: string; ms: number; dmg?: Amount; chc?: Amount; chd?: Amount; ias?: Amount }
export type ProcTrigger = 'spend' | 'kill' | 'eliteKill' | 'crit' | 'dash' | 'cast';

export type PowerEffect =
  /** Modify named skills (or sub-strike ids such as 'dust_devil'): any SkillMods, plus the roll into one field. */
  | { kind: 'skillMods'; skills?: string[]; tags?: TagQuery; mods?: SkillMods; roll?: { field: NumericModKey | `var:${string}`; sign?: 1 | -1 } }
  /** Own-bucket damage multiplier on named strikes (×mult), multiplied with other own-bucket terms, capped. */
  | { kind: 'ownMult'; skills?: string[]; tags?: TagQuery; mult: number }
  /** +pct % while a condition holds: 'own' multiplies the own bucket at cast time, 'hit' multiplies each hit. */
  | { kind: 'conditional'; when: Condition; skills?: string[]; tags?: TagQuery; bucket: 'own' | 'hit'; pct: Amount }
  /**
   * ×(1 + pct %) on named skills — the multiplicative "more" a legendary kit needs to compete with a set. Without
   * `when`: own bucket (capped with set multipliers). Player / scaling condition: own bucket at cast time. Target
   * condition: per hit (vulnerability position, outside OWN_BUCKET_CAP).
   */
  | { kind: 'skillMore'; skills?: string[]; tags?: TagQuery; pct: Amount; when?: Condition }
  /**
   * Character-sheet stat (same keys as affixes), e.g. +7 % attack speed. `perLegendary`: × equipped legendary items
   * (capped at max); `noSetBonus`: only while no set bonus is active (Patchwork Signet pattern).
   */
  | { kind: 'stat'; stat: StatId; value: Amount; perLegendary?: { max: number }; noSetBonus?: boolean }
  /** Each distinct listed element dealt within the window multiplies hits by (1 + perStack %), D3 Tal Rasha style. */
  | { kind: 'elementStacks'; elements: Element[]; windowMs: number; perStack: number; buff?: string }
  /** One element of the cycle is boosted at a time; the boost moves on every periodMs (buff `${buffPrefix}_${el}`). */
  | { kind: 'elementCycle'; elements: Element[]; periodMs: number; pct: Amount; buffPrefix: string }
  /** On a trigger: shorten active cooldowns, gain resource and/or gain a buff. `chance` 0..1 (absent = always). */
  | { kind: 'proc'; on: ProcTrigger; chance?: number; reduceCooldownsMs?: Amount; resource?: Amount; buff?: BuffGrant }
  /** Dash cooldown multiplier (0.5 = halved). */
  | { kind: 'dashCooldown'; mult: number };

export function amount(a: Amount | undefined, roll: number): number {
  if (a === undefined) return 0;
  return typeof a === 'number' ? a : a.roll * roll;
}

export const usesRoll = (e: PowerEffect): boolean => {
  const r = (a: Amount | undefined) => typeof a === 'object' && a !== null;
  switch (e.kind) {
    case 'skillMods': return !!e.roll;
    case 'conditional': case 'skillMore': return r(e.pct);
    case 'stat': return r(e.value);
    case 'elementCycle': return r(e.pct);
    case 'proc': return r(e.reduceCooldownsMs) || r(e.resource) || !!e.buff && (r(e.buff.dmg) || r(e.buff.chc) || r(e.buff.chd) || r(e.buff.ias));
    default: return false;
  }
};

// ─────────────────────────── Builders (authoring sugar; they return plain data) ───────────────────────────

export const ROLL: Amount = { roll: 1 };
/** A skill list (`['meteor']`) or a tag query (`{ anyOf: ['projectile'] }`). */
export type Target = string[] | TagQuery;
const target = (t: Target): Targets => (Array.isArray(t) ? { skills: t } : { tags: t });
export const tagged = (...anyOf: SkillTag[]): TagQuery => ({ anyOf });
export const skillMods = (skills: Target, mods: SkillMods, roll?: { field: NumericModKey | `var:${string}`; sign?: 1 | -1 }): PowerEffect =>
  roll ? { kind: 'skillMods', ...target(skills), mods, roll } : { kind: 'skillMods', ...target(skills), mods };
/** "<skill> deals {v}% increased damage" (+ optional fixed mods). */
export const rolledDamage = (skill: string, mods: SkillMods = {}): PowerEffect => skillMods([skill], mods, { field: 'dmg' });
/** "<skill> cooldown is reduced by {v}%" (+ optional fixed mods). */
export const rolledCooldown = (skill: string, mods: SkillMods = {}): PowerEffect => skillMods([skill], mods, { field: 'cooldown', sign: -1 });
/** "<skill> costs {v}% less" (+ optional fixed mods). */
export const rolledCost = (skill: string, mods: SkillMods = {}): PowerEffect => skillMods([skill], mods, { field: 'cost', sign: -1 });
export const convert = (skills: Target, element: Element): PowerEffect => skillMods(skills, { element });
export const extraProjectiles = (skills: Target, n: number): PowerEffect => skillMods(skills, { projectiles: n });
export const extraSummons = (skills: Target, n: number): PowerEffect => skillMods(skills, { maxSummons: n });
export const flags = (skills: Target, ...f: string[]): PowerEffect => skillMods(skills, { flags: f });
export const ownMult = (skills: Target, mult: number): PowerEffect => ({ kind: 'ownMult', ...target(skills), mult });
export const stat = (s: StatId, value: Amount): PowerEffect => ({ kind: 'stat', stat: s, value });
export const skillMore = (skills: Target, pct: Amount, when?: Condition): PowerEffect =>
  when ? { kind: 'skillMore', ...target(skills), pct, when } : { kind: 'skillMore', ...target(skills), pct };
export const conditional = (when: Condition, bucket: 'own' | 'hit', pct: Amount, skills?: Target): PowerEffect =>
  skills ? { kind: 'conditional', when, bucket, pct, ...target(skills) } : { kind: 'conditional', when, bucket, pct };
export const proc = (on: ProcTrigger, grant: Omit<Extract<PowerEffect, { kind: 'proc' }>, 'kind' | 'on'>): PowerEffect => ({ kind: 'proc', on, ...grant });

// ─────────────────────────── Text: generation and validation ───────────────────────────

const skillName = (id: string) => (Object.hasOwn(SKILLS, id) ? SKILLS[id].name : id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const list = (xs: string[], word = 'and') => xs.reduce((a, b, i, all) => (i === 0 ? b : i === all.length - 1 ? `${a} ${word} ${b}` : `${a}, ${b}`), '');
const tagText = (q: TagQuery) => [q.anyOf?.length ? `${list(q.anyOf.map(cap), 'or')} skills` : '', q.allOf?.length ? `${list(q.allOf.map(cap))} skills` : '',
  q.noneOf?.length ? `(not ${list(q.noneOf.map(cap), 'or')})` : ''].filter(Boolean).join(' ') || 'Skills';
/** "Meteor and Hydra", "Projectile or Area skills", or both. */
const names = (t: Targets) => [t.skills?.length ? list(t.skills.map(skillName)) : '', t.tags ? tagText(t.tags) : ''].filter(Boolean).join(' and ') || 'Your skills';
const plural = (t: Targets) => !!t.tags || (t.skills?.length ?? 0) > 1;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const fmt = (a: Amount | undefined) => (typeof a === 'object' ? '{v}' : String(Math.round(Math.abs(a ?? 0) * 100) / 100));
const STAT_TEXT: Partial<Record<StatId, string>> = {
  chd: 'Critical Hit Damage', chc: 'Critical Hit Chance', ias: 'attack speed', area: 'area damage', cdr: 'cooldown reduction',
  rcr: 'resource cost reduction', lifePct: 'Life', armor: 'Armor', allRes: 'resistance to all elements', dmgPct: 'damage', ms: 'movement speed',
};
const MOD_TEXT: Record<NumericModKey, (v: string, who: string) => string> = {
  dmg: (v, who) => `${who} deal${who.includes(' and ') || who.endsWith('skills') ? '' : 's'} ${v}% increased damage`,
  radius: (v, who) => `${who} radius is increased by ${v}%`,
  cost: (v, who) => `${who} costs ${v}% less`,
  cooldown: (v, who) => `${who} cooldown is reduced by ${v}%`,
  duration: (v, who) => `${who} lasts ${v}% longer`,
  projectiles: (v, who) => `${who} fires ${v} additional projectiles`,
  pierce: (v, who) => `${who} gains ${v}% pierce chance`,
  gen: (v, who) => `${who} generates ${v} additional resource`,
  maxSummons: (v, who) => `You may have ${v} additional ${who}`,
};
const STATE_TEXT: Record<TargetState, string> = { stunned: 'stunned', frozen: 'frozen', chilled: 'chilled', bleeding: 'bleeding', immobilised: 'immobilised', inBlackHole: 'Black Hole-bound' };
const conditionText = (c: Condition): string =>
  'channeling' in c ? (c.channeling === true ? 'while channelling' : typeof c.channeling === 'string' ? `while channelling ${skillName(c.channeling)}` : `while channelling ${tagText(c.channeling)}`)
  : 'targetState' in c ? (c.targetState === 'inBlackHole' ? 'against enemies inside your Black Hole' : `against ${STATE_TEXT[c.targetState]} enemies`)
  : 'targetLifeAbovePct' in c ? `against enemies above ${c.targetLifeAbovePct}% Life`
  : 'targetFartherThan' in c ? `against enemies more than ${c.targetFartherThan} units away`
  : 'perSummon' in c ? `for each active ${skillName(c.perSummon)} (max ${c.max})`
  : 'buffStacks' in c ? `per stack of ${skillName(c.buffStacks)} (max ${c.max})`
  : 'element' in c ? `with ${c.element.map(cap).join(' or ')} damage`
  : 'buff' in c ? `while ${skillName(c.buff)} is active`
  : 'standingStill' in c ? 'while standing still'
  : 'inOwnGround' in c ? 'while standing in your own ground effects'
  : 'lifeBelowPct' in c ? `while below ${c.lifeBelowPct}% Life` : `while above ${c.lifeAbovePct}% Life`;
const conditionTokens = (c: Condition, n: (v: number) => string): string[] =>
  'perSummon' in c || 'buffStacks' in c ? [n(c.max)] : 'targetLifeAbovePct' in c ? [n(c.targetLifeAbovePct)] : 'targetFartherThan' in c ? [n(c.targetFartherThan)]
  : 'lifeBelowPct' in c ? [n(c.lifeBelowPct)] : 'lifeAbovePct' in c ? [n(c.lifeAbovePct)] : [];

/** Generated English for one effect ({v} = rolled value). Flags/vars describe code behaviour and need authored text. */
export function describeEffect(e: PowerEffect): string {
  switch (e.kind) {
    case 'skillMods': {
      const who = names(e), parts: string[] = [];
      for (const k of NUMERIC_MOD_KEYS) {
        const rolled = e.roll?.field === k, v = e.mods?.[k];
        if (rolled) parts.push(MOD_TEXT[k]('{v}', who));
        if (v !== undefined) parts.push(MOD_TEXT[k](fmt(v), who));
      }
      if (e.mods?.element) parts.push(`${who} deal${plural(e) ? '' : 's'} ${cap(e.mods.element)} damage`);
      if (e.roll?.field.startsWith('var:')) parts.push(`${who}: ${e.roll.field.slice(4)} {v}`);
      return parts.length ? parts.join('; ') + '.' : '';
    }
    case 'ownMult': return `${names(e)} deal ${Math.round((e.mult - 1) * 100).toLocaleString('en-US')}% increased damage.`;
    case 'conditional': return `${e.skills || e.tags ? names(e) + ' deal' : 'You deal'} ${fmt(e.pct)}% increased damage ${conditionText(e.when)}.`;
    case 'skillMore': return `${names(e)} deal ${fmt(e.pct)}% more damage${e.when ? ' ' + conditionText(e.when) : ''}.`;
    case 'stat': return `${e.noSetBonus ? 'While no set bonus is active, ' : ''}${e.perLegendary ? `each equipped legendary item increases ${STAT_TEXT[e.stat] ?? e.stat} by ${fmt(e.value)}% (max ${e.perLegendary.max} items)` : `increases ${STAT_TEXT[e.stat] ?? e.stat} by ${fmt(e.value)}${['str', 'dex', 'int', 'vit', 'armor', 'allRes'].includes(e.stat) ? '' : '%'}`}.`.replace(/^i/, 'I');
    case 'elementStacks': return `Dealing ${e.elements.map(cap).join(', ')} damage increases your damage by ${e.perStack}% for ${e.windowMs / 1000} seconds per element (max ${e.elements.length}).`;
    case 'elementCycle': return `Gain a ${fmt(e.pct)}% damage bonus to a single element that rotates every ${e.periodMs / 1000} seconds.`;
    case 'proc': {
      const when = { spend: 'Each resource-spending skill', kill: 'Killing an enemy', eliteKill: 'Killing an elite', crit: 'Critical hits', dash: 'Dashing', cast: 'Casting a skill' }[e.on];
      const parts: string[] = [];
      if (e.reduceCooldownsMs !== undefined) parts.push(`reduces your active cooldowns by ${typeof e.reduceCooldownsMs === 'object' ? '{v}' : fmt(e.reduceCooldownsMs / 1000)} seconds`);
      if (e.resource !== undefined) parts.push(`restores ${fmt(e.resource)} resource`);
      if (e.buff) parts.push(`grants ${fmt(e.buff.dmg)}% increased damage for ${e.buff.ms / 1000} seconds`);
      return `${e.chance !== undefined ? `${Math.round(e.chance * 100)}% chance: ` : ''}${when} ${parts.join(' and ')}.`;
    }
    case 'dashCooldown': return `Dash cooldown is reduced by ${Math.round((1 - e.mult) * 100)}%.`;
  }
}

export const powerText = (effects: readonly PowerEffect[]): string => effects.map(describeEffect).filter(Boolean).join(' ');

/** Numbers (and element names) that a player text describing these effects must mention. */
export function effectTokens(e: PowerEffect): string[] {
  const n = (v: number) => String(Math.round(Math.abs(v) * 100) / 100);
  const a = (v: Amount | undefined) => (typeof v === 'number' ? [n(v)] : []);
  switch (e.kind) {
    case 'skillMods': return [...NUMERIC_MOD_KEYS.flatMap((k) => (e.mods?.[k] ? [n(e.mods[k]!)] : [])), ...(e.mods?.element ? [cap(e.mods.element)] : [])];
    case 'ownMult': return [n((e.mult - 1) * 100)];
    case 'conditional': return [...a(e.pct), ...conditionTokens(e.when, n)];
    case 'skillMore': return [...a(e.pct), ...(e.when ? conditionTokens(e.when, n) : [])];
    case 'stat': return [...a(e.value), ...(e.perLegendary ? [n(e.perLegendary.max)] : [])];
    case 'elementStacks': return [n(e.perStack), n(e.windowMs / 1000)];
    case 'elementCycle': return [n(e.periodMs / 1000), ...a(e.pct)];
    case 'proc': return [...(typeof e.reduceCooldownsMs === 'number' ? [n(e.reduceCooldownsMs / 1000)] : []), ...a(e.resource), ...(e.buff ? [n(e.buff.ms / 1000), ...a(e.buff.dmg)] : [])];
    case 'dashCooldown': return [n((1 - e.mult) * 100)];
  }
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Problems with an authored text for these effects: missing numbers / elements, or a {v} that does (not) belong. */
export function powerTextIssues(text: string, effects: readonly PowerEffect[], rolled: boolean): string[] {
  const issues: string[] = [];
  const plain = text.replaceAll(',', '');
  const hasNumber = (tok: string) => /^[A-Z]/.test(tok) ? plain.includes(tok)
    : new RegExp(`(^|[^0-9.])${tok.replace('.', '\\.')}([^0-9]|$)`).test(plain) || (Number.isInteger(+tok) && +tok <= 10 && new RegExp(`\\b${WORDS[+tok]}\\b`, 'i').test(plain));
  for (const e of effects) for (const tok of effectTokens(e)) if (!hasNumber(tok)) issues.push(`text does not mention ${tok} (${e.kind})`);
  const needsV = effects.some(usesRoll);
  if (rolled && needsV !== text.includes('{v}')) issues.push(needsV ? 'rolled effect but no {v} in text' : '{v} in text but no rolled effect');
  if (!rolled && text.includes('{v}')) issues.push('{v} in text but this source has no roll');
  return issues;
}
