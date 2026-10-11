// Power templates: the small vocabulary legendary powers, set bonuses, passives and specialization nodes are composed
// from, as plain data (structured-cloneable, no functions). One interpreter on the server (server/src/sim/playerctx.ts)
// and the character sheet (shared/src/stats.ts) read these; tooltip text is generated from them or validated against
// them (powerTextIssues). Recipes: docs/rework/depth/FOUNDATION.md §5.

import { NUMERIC_MOD_KEYS, SKILLS, type SkillMods } from './data/skills';
import type { Element, StatId } from './types';

/**
 * Global cap on the own-bucket (set-style) damage multiplier of one strike. [M] 127 is the largest authored value
 * today (Cinder Oath six-piece), so the cap does not bind existing content; lower it when sets become capped
 * transformations (plan §3.1 lever 2) — the parity harness then shows the effect.
 */
export const OWN_BUCKET_CAP = 127;

/**
 * Strike ids that are not skills but may be targeted by templates (`skills: [...]`), with the skill that owns them.
 * Behaviour code builds these strikes (e.g. warrior.ts Dust Devils); add an entry when a new sub-strike id appears.
 */
export const SUB_STRIKES: Record<string, string> = { dust_devil: 'whirlwind', cleave_rupture: 'cleave' };

/** A literal number, or `roll × k` where roll is the item's rolled value (Cube: maximum), a node's rank, or 1. */
export type Amount = number | { roll: number };

export type NumericModKey = (typeof NUMERIC_MOD_KEYS)[number];
export type TargetState = 'stunned' | 'frozen' | 'chilled' | 'bleeding';

/** When a conditional bonus applies. Target states are evaluated per hit; the rest when the strike is made / hits. */
export type Condition =
  | { channeling: string | true }          // while channelling (that skill, or any)
  | { targetState: TargetState }           // the enemy hit is stunned / frozen / chilled / bleeding (bucket 'hit' only)
  | { perSummon: string; max: number }     // × your active summons of this type, capped (bucket 'own' only)
  | { element: Element[] }                 // the strike's element is one of these
  | { buff: string }                       // while you have this buff
  | { lifeBelowPct: number }
  | { lifeAbovePct: number };

export interface BuffGrant { id: string; ms: number; dmg?: Amount; chc?: Amount; chd?: Amount; ias?: Amount }
export type ProcTrigger = 'spend' | 'kill' | 'eliteKill' | 'crit' | 'dash' | 'cast';

export type PowerEffect =
  /** Modify named skills (or sub-strike ids such as 'dust_devil'): any SkillMods, plus the roll into one field. */
  | { kind: 'skillMods'; skills: string[]; mods?: SkillMods; roll?: { field: NumericModKey | `var:${string}`; sign?: 1 | -1 } }
  /** Own-bucket damage multiplier on named strikes (×mult), multiplied with other own-bucket terms, capped. */
  | { kind: 'ownMult'; skills: string[]; mult: number }
  /** +pct % while a condition holds: 'own' multiplies the own bucket at cast time, 'hit' multiplies each hit. */
  | { kind: 'conditional'; when: Condition; skills?: string[]; bucket: 'own' | 'hit'; pct: Amount }
  /** Character-sheet stat (same keys as affixes), e.g. +7 % attack speed. */
  | { kind: 'stat'; stat: StatId; value: Amount }
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
    case 'conditional': return r(e.pct);
    case 'stat': return r(e.value);
    case 'elementCycle': return r(e.pct);
    case 'proc': return r(e.reduceCooldownsMs) || r(e.resource) || !!e.buff && (r(e.buff.dmg) || r(e.buff.chc) || r(e.buff.chd) || r(e.buff.ias));
    default: return false;
  }
};

// ─────────────────────────── Builders (authoring sugar; they return plain data) ───────────────────────────

export const ROLL: Amount = { roll: 1 };
export const skillMods = (skills: string[], mods: SkillMods, roll?: { field: NumericModKey | `var:${string}`; sign?: 1 | -1 }): PowerEffect =>
  roll ? { kind: 'skillMods', skills, mods, roll } : { kind: 'skillMods', skills, mods };
/** "<skill> deals {v}% increased damage" (+ optional fixed mods). */
export const rolledDamage = (skill: string, mods: SkillMods = {}): PowerEffect => skillMods([skill], mods, { field: 'dmg' });
/** "<skill> cooldown is reduced by {v}%" (+ optional fixed mods). */
export const rolledCooldown = (skill: string, mods: SkillMods = {}): PowerEffect => skillMods([skill], mods, { field: 'cooldown', sign: -1 });
/** "<skill> costs {v}% less" (+ optional fixed mods). */
export const rolledCost = (skill: string, mods: SkillMods = {}): PowerEffect => skillMods([skill], mods, { field: 'cost', sign: -1 });
export const convert = (skills: string[], element: Element): PowerEffect => skillMods(skills, { element });
export const extraProjectiles = (skills: string[], n: number): PowerEffect => skillMods(skills, { projectiles: n });
export const extraSummons = (skills: string[], n: number): PowerEffect => skillMods(skills, { maxSummons: n });
export const flags = (skills: string[], ...f: string[]): PowerEffect => skillMods(skills, { flags: f });
export const ownMult = (skills: string[], mult: number): PowerEffect => ({ kind: 'ownMult', skills, mult });
export const stat = (s: StatId, value: Amount): PowerEffect => ({ kind: 'stat', stat: s, value });
export const conditional = (when: Condition, bucket: 'own' | 'hit', pct: Amount, skills?: string[]): PowerEffect =>
  skills ? { kind: 'conditional', when, bucket, pct, skills } : { kind: 'conditional', when, bucket, pct };
export const proc = (on: ProcTrigger, grant: Omit<Extract<PowerEffect, { kind: 'proc' }>, 'kind' | 'on'>): PowerEffect => ({ kind: 'proc', on, ...grant });

// ─────────────────────────── Text: generation and validation ───────────────────────────

const skillName = (id: string) => (Object.hasOwn(SKILLS, id) ? SKILLS[id].name : id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const names = (ids: string[]) => ids.map(skillName).reduce((a, b, i, all) => (i === 0 ? b : i === all.length - 1 ? `${a} and ${b}` : `${a}, ${b}`), '');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const fmt = (a: Amount | undefined) => (typeof a === 'object' ? '{v}' : String(Math.round(Math.abs(a ?? 0) * 100) / 100));
const STAT_TEXT: Partial<Record<StatId, string>> = {
  chd: 'Critical Hit Damage', chc: 'Critical Hit Chance', ias: 'attack speed', area: 'area damage', cdr: 'cooldown reduction',
  rcr: 'resource cost reduction', lifePct: 'Life', armor: 'Armor', allRes: 'resistance to all elements', dmgPct: 'damage', ms: 'movement speed',
};
const MOD_TEXT: Record<NumericModKey, (v: string, who: string) => string> = {
  dmg: (v, who) => `${who} deal${who.includes(' and ') ? '' : 's'} ${v}% increased damage`,
  radius: (v, who) => `${who} radius is increased by ${v}%`,
  cost: (v, who) => `${who} costs ${v}% less`,
  cooldown: (v, who) => `${who} cooldown is reduced by ${v}%`,
  duration: (v, who) => `${who} lasts ${v}% longer`,
  projectiles: (v, who) => `${who} fires ${v} additional projectiles`,
  pierce: (v, who) => `${who} gains ${v}% pierce chance`,
  gen: (v, who) => `${who} generates ${v} additional resource`,
  maxSummons: (v, who) => `You may have ${v} additional ${who}`,
};
const conditionText = (c: Condition): string =>
  'channeling' in c ? (c.channeling === true ? 'while channelling' : `while channelling ${skillName(c.channeling)}`)
  : 'targetState' in c ? `against ${c.targetState} enemies`
  : 'perSummon' in c ? `for each active ${skillName(c.perSummon)} (max ${c.max})`
  : 'element' in c ? `with ${c.element.map(cap).join(' or ')} damage`
  : 'buff' in c ? `while ${skillName(c.buff)} is active`
  : 'lifeBelowPct' in c ? `while below ${c.lifeBelowPct}% Life` : `while above ${c.lifeAbovePct}% Life`;

/** Generated English for one effect ({v} = rolled value). Flags/vars describe code behaviour and need authored text. */
export function describeEffect(e: PowerEffect): string {
  switch (e.kind) {
    case 'skillMods': {
      const who = names(e.skills), parts: string[] = [];
      for (const k of NUMERIC_MOD_KEYS) {
        const rolled = e.roll?.field === k, v = e.mods?.[k];
        if (rolled) parts.push(MOD_TEXT[k]('{v}', who));
        if (v !== undefined) parts.push(MOD_TEXT[k](fmt(v), who));
      }
      if (e.mods?.element) parts.push(`${who} deal${e.skills.length > 1 ? '' : 's'} ${cap(e.mods.element)} damage`);
      if (e.roll?.field.startsWith('var:')) parts.push(`${who}: ${e.roll.field.slice(4)} {v}`);
      return parts.length ? parts.join('; ') + '.' : '';
    }
    case 'ownMult': return `${names(e.skills)} deal ${Math.round((e.mult - 1) * 100).toLocaleString('en-US')}% increased damage.`;
    case 'conditional': return `${e.skills ? names(e.skills) + ' deal' : 'You deal'} ${fmt(e.pct)}% increased damage ${conditionText(e.when)}.`;
    case 'stat': return `Increases ${STAT_TEXT[e.stat] ?? e.stat} by ${fmt(e.value)}${['str', 'dex', 'int', 'vit', 'armor', 'allRes'].includes(e.stat) ? '' : '%'}.`;
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
    case 'conditional': return [...a(e.pct), ...('perSummon' in e.when ? [n(e.when.max)] : [])];
    case 'stat': return a(e.value);
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
