// Power templates: the small vocabulary legendary powers, set bonuses, passives and specialization nodes are composed
// from, as plain data (structured-cloneable, no functions). One interpreter on the server (server/src/sim/playerctx.ts)
// and the character sheet (shared/src/stats.ts) read these; tooltip text is generated from them or validated against
// them (powerTextIssues). Recipes: docs/rework/depth/FOUNDATION.md §5.

import { GROUND_DEFS } from './data/grounds';
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
/** The content bible's proposal (BUDGET.md R7), behind a flag for the pilot retune. */
export const ITEM_COUNT_CAP_BIBLE = { maxSummons: 2, projectiles: 2 } as const;
/** Flag: false keeps today's non-binding 3 / 2. The pilot flips it when it rebalances (wave 2 does not). */
export const USE_BIBLE_COUNT_CAP = false;
export const ITEM_COUNT_CAP: { readonly maxSummons: number; readonly projectiles: number } =
  USE_BIBLE_COUNT_CAP ? ITEM_COUNT_CAP_BIBLE : { maxSummons: 3, projectiles: 2 };

/**
 * Strike ids that are not skills but may be targeted by templates (`skills: [...]`): the skill that owns them and the
 * tags the spawned entity itself carries. A sub-strike's tags = its own ∪ its owner's, so Dust Devils count as summons
 * whether they come from the rune, an item or a set. Behaviour code builds these strikes; add an entry for new ids.
 * (Proc strikes and ground effects register their own ids and tags from data.)
 */
export const SUB_STRIKES: Record<string, { owner: string; tags?: SkillTag[] }> = {
  dust_devil: { owner: 'whirlwind', tags: ['summon', 'area'] },
  cleave_rupture: { owner: 'cleave', tags: ['area'] },
  // Lantern Garden 6 (MAGE.md §7): ember sprites claw as their own strike; Summon and Burn, never boosted by Cinderkin by name.
  ember_sprite: { owner: 'cinderkin', tags: ['summon', 'burn'] },
};
export const subStrikeOwner = (id: string): string => (Object.hasOwn(SUB_STRIKES, id) ? SUB_STRIKES[id].owner : id);

/** A literal number, or `roll × k` where roll is the item's rolled value (Cube: maximum), a node's rank, or 1. */
export type Amount = number | { roll: number };

export type NumericModKey = (typeof NUMERIC_MOD_KEYS)[number];

/**
 * Who an effect applies to: named skills / sub-strikes, a tag query, or both (union). Templates with neither apply to
 * every strike (conditional only). Tag queries are resolved once when the combat context is built (powerRuntime.ts).
 */
export type Targets = { skills?: string[]; tags?: TagQuery };
/** immobilised = stunned or frozen (and any future root); inBlackHole = inside any Black Hole; marked = marked/spotted. */
export type TargetState = 'stunned' | 'frozen' | 'chilled' | 'bleeding' | 'burning' | 'immobilised' | 'inBlackHole' | 'marked' | 'weakened';

/**
 * The one condition predicate shared by `conditional`, `skillMore`, vulnerability and set bonuses. Target conditions are
 * evaluated per hit against the enemy; player conditions when the strike is made (own bucket) or per hit. Scaling
 * conditions (perSummon, buffStacks) multiply the bonus by a capped count: factor = 1 + pct % × count.
 */
export type Condition =
  // composition: all children hold (a scaling child scales the result) / any child holds (largest count)
  | { all: Condition[] }
  | { any: Condition[] }
  // target (per hit)
  | { targetState: TargetState }
  | { targetElite: true }                   // champion, rare or boss
  | { targetControlledWithinMs: number }    // stunned, frozen, knocked back or pulled within the last N ms
  | { targetLifeAbovePct: number }         // the enemy is above X % life
  | { targetFartherThan: number }          // the enemy is more than X units from you
  // player
  | { channeling: string | true | TagQuery } // while channelling (that skill, any skill, or a skill matching the tags)
  | { buff: string }                       // while you have this buff
  | { buffStacks: string; max: number }    // × stacks of this buff, capped (e.g. 6 % per stack, max 5)
  | { perSummon: string; max: number }     // × your active summons of this type, capped
  | { standingStill: true }
  | { standingStillMs: number }            // not moved for at least N ms
  | { noEnemyWithin: number }              // no living enemy within N units (tracked per tick while used)
  | { inDebt: true }                       // resource below zero (resourceDebt)
  | { inOwnGround: true }                  // standing inside one of your own ground effects
  | { lifeBelowPct: number }
  | { lifeAbovePct: number }
  // strike
  | { element: Element[] };                // the strike's element is one of these (per hit)

export const isTargetCondition = (c: Condition): boolean => 'all' in c ? c.all.some(isTargetCondition) : 'any' in c ? c.any.some(isTargetCondition)
  : 'targetState' in c || 'targetLifeAbovePct' in c || 'targetFartherThan' in c || 'targetElite' in c || 'targetControlledWithinMs' in c;
/** Element conditions need the strike; composite conditions inherit from their children. */
export const usesElement = (c: Condition): boolean => 'all' in c ? c.all.some(usesElement) : 'any' in c ? c.any.some(usesElement) : 'element' in c;

/**
 * A buff a power grants. `dr`: % less damage taken while it lasts; `ccImmune`: cannot be stunned, frozen or pulled;
 * `maxStacks`: each grant adds a stack (refreshing the duration) and `stackDmg` / `stackIas` count per stack.
 */
export interface BuffGrant {
  id: string; ms: number; dmg?: Amount; chc?: Amount; chd?: Amount; ias?: Amount;
  dr?: Amount; ccImmune?: boolean; maxStacks?: number; stackDmg?: Amount; stackIas?: Amount;
  /** Cooldowns recover this % faster while the buff lasts. */
  cdRecovery?: Amount;
}
/** `attack` = a primary attack was made (the automatic attack; slot casts are `cast`). */
export type ProcTrigger = 'hit' | 'crit' | 'kill' | 'eliteKill' | 'spend' | 'cast' | 'attack' | 'dash' | 'takeDamage' | 'applyStatus';
/** Player control effects a controlImmunity template can block. */
export type ControlKind = 'stun' | 'freeze' | 'pull';

/**
 * Rule changes that are not numbers on a skill (docs/rework/depth/ITEMS-SHARED.md §7 Inscriptions):
 * - charges: the targets store `extra` more charges (one recharges per cooldown);
 * - channelMove: while channelling a target, move at least at `pct`% of normal speed (100 = full; overrides a skill's
 *   `vars.channelMovePct` slow);
 * - buffUpkeep: the targets' buffs (buff id = skill id) do not run out while in combat; every `everyMs` they cost the
 *   skill's resource again instead (they end when it cannot be paid);
 * - spendRefund: a cast of a target that hits `minHits` different enemies within `windowMs` refunds `pct`% of its cost;
 * - groundsFollow: your ground effects follow you at `scale` × their radius;
 * - countsAs: for your powers, enemies in state `state` also count as `as` (e.g. chilled counts as stunned);
 * - markSpread: when you mark an enemy, the nearest other enemy within `range` gets the same mark;
 * - statusLonger: your chills / stuns / freezes last `pct`% longer (Chill Margin: "your Chills last 25% longer").
 */
export type RuleChange =
  | { id: 'charges'; extra: number }
  | { id: 'channelMove'; pct: number }
  | { id: 'buffUpkeep'; everyMs: number }
  | { id: 'spendRefund'; pct: number; minHits: number; windowMs?: number }
  | { id: 'groundsFollow'; scale: number }
  | { id: 'countsAs'; state: TargetState; as: TargetState }
  | { id: 'markSpread'; range: number }
  | { id: 'statusLonger'; status: 'chill' | 'stun' | 'freeze'; pct: number };

/** Monster statuses a power (proc, ground, class code) can apply. */
export type StatusKind = 'stun' | 'freeze' | 'chill' | 'knockback' | 'pull' | 'weaken' | 'vulnerable' | 'taunt' | 'bleed' | 'burn' | 'freezeBuild' | 'mark';
export interface StatusSpec {
  kind: StatusKind;
  /** Duration (stun, freeze, chill, weaken, vulnerable, taunt, mark; bleed / burn: dot duration). */
  ms?: number;
  /** weaken: % less damage dealt; vulnerable: % more damage taken; freezeBuild: build-up points (100 freezes). */
  pct?: Amount;
  /** knockback: units away from the source (negative = toward); pull: units toward the source. */
  dist?: number;
  /** bleed / burn: weapon-damage coefficient over `ms`. */
  coef?: Amount;
  /** vulnerable: only damage from these skills / tags counts (resolved when applied); `exceptSource` inverts it. */
  skills?: string[]; tags?: TagQuery; exceptSource?: boolean;
  /** Apply to every enemy within this radius of the point instead of the one target. */
  radius?: number;
  /** freezeBuild: build-up older than this no longer counts (e.g. "6 hits within 2 s"). */
  windowMs?: number;
  /** knockback / pull / taunt: measured from the player instead of the ground or proc point ("pushes them toward you"). */
  origin?: 'owner';
  /** vulnerable: removed after the first matching hit from the applying player ("your next Seismic Slam hit"). */
  consume?: boolean;
}
/** A strike a proc deals: its own strike id (for tags and attribution), a weapon-damage coefficient, an optional area. */
export interface ProcStrike { id: string; coef: Amount; radius?: number; element?: Element; at?: 'target' | 'self'; tags?: SkillTag[]; visual?: string }

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
  /**
   * Each distinct listed element dealt within the window multiplies hits by (1 + perStack %), D3 Tal Rasha style.
   * `bucket: 'generic'`: instead +perStack % per element in the generic (additive) damage bucket, carried by the buff.
   */
  | { kind: 'elementStacks'; elements: Element[]; windowMs: number; perStack: number; buff?: string; bucket?: 'generic' }
  /** One element of the cycle is boosted at a time; the boost moves on every periodMs (buff `${buffPrefix}_${el}`). */
  | { kind: 'elementCycle'; elements: Element[]; periodMs: number; pct: Amount; buffPrefix: string }
  /**
   * On a trigger, optionally filtered (skills / tags of the triggering strike, applied status kinds, minimum hit size
   * as % of max life for takeDamage), with an internal cooldown and a chance (RNG only when `chance` is set): shorten
   * or reset cooldowns, gain resource, gain a buff, deal a strike, spawn a summon, place a ground, apply a status,
   * clear hostile projectiles in front of you.
   */
  | { kind: 'proc'; on: ProcTrigger; chance?: number; icdMs?: number; skills?: string[]; tags?: TagQuery; status?: StatusKind[]; minHitPct?: number;
      /** Fire only on every Nth trigger that passes the filters ("every 5th Primary attack"). */
      every?: number;
      /** attack trigger only: make the same primary attack again at the same enemy ("repeats once"). */
      repeat?: boolean;
      /** Fires only while this holds (player state, or the trigger's enemy for target conditions). */
      when?: Condition;
      reduceCooldownsMs?: Amount; resetCooldowns?: string[]; resource?: Amount; buff?: BuffGrant; strike?: ProcStrike;
      summon?: { type: string; skill: string; lifeMs: number; at?: 'target' | 'self'; max?: number };
      ground?: { def: string; at?: 'target' | 'self'; scale?: Amount };
      applyStatus?: StatusSpec & { at?: 'target' | 'self' };
      clearProjectiles?: { range: number; halfAngleDeg: number } }
  /** % more (positive) or less (negative) damage taken, optionally while a condition holds or per equipped legendary. */
  | { kind: 'damageTaken'; pct: Amount; when?: Condition; perLegendary?: { max: number }; noSetBonus?: boolean }
  /** The first hit taken every `windowMs` is changed by pct (negative = reduced); applying a listed status resets it. */
  | { kind: 'firstHit'; pct: Amount; windowMs: number; resetOnStatus?: StatusKind[] }
  /** Fatal damage leaves you at lifePct of max life instead (once per cooldown), optionally invulnerable and resetting skills. */
  | { kind: 'cheatDeath'; lifePct: number; cooldownMs: number; invulnMs?: number; when?: Condition; resetCooldowns?: string[]; buff?: BuffGrant }
  /** Cannot be stunned, frozen or pulled (or only the listed kinds) while the condition holds (always without one). */
  | { kind: 'controlImmunity'; when?: Condition; kinds?: ControlKind[] }
  /** Projectile behaviour for the targets: damage by distance flown, wall bounces, new target on death, homing to marked enemies. */
  | { kind: 'projectile'; skills?: string[]; tags?: TagQuery; distBonus?: { pct: Amount; atUnits: number }; bounces?: number; bounceScale?: number; retarget?: boolean;
      /** Home in on the nearest marked enemy within `range` when fired (`turn` rad/s, like ProjSpec.turn). */
      seekMarked?: { turn: number; range: number };
      /** After its last hit (or at the end of its flight) the projectile flies back to you once, hitting enemies again. */
      returns?: boolean;
      /** Bounces are also spent at maximum range: the projectile ricochets toward the nearest enemy it has not hit. */
      rangeRicochet?: boolean }
  /** Hostile projectiles inside a cone in front of you are destroyed each tick (while the condition holds). */
  | { kind: 'deflect'; range: number; halfAngleDeg: number; when?: Condition }
  /** Damage-over-time rules for the targets' dots of one kind: separate instances (`stacks`), strength, carry-over on refresh. */
  | { kind: 'dot'; dot: 'bleed' | 'burn' | 'poison'; skills?: string[]; tags?: TagQuery; stacks?: number; strengthPct?: number; carryPct?: Amount }
  /**
   * The targets gain tags: `add`, and / or every tag of the skill in bar slot `fromSlot` (0-based). Resolved before any
   * other tag-keyed effect (order in docs/rework/depth/FOUNDATION.md §11.2): all grants read the ungranted index at once.
   */
  | { kind: 'tagGrant'; skills?: string[]; tags?: TagQuery; add?: SkillTag[]; fromSlot?: number }
  /** A rule change (Inscriptions, rules-changing passives): see RuleChange. */
  | { kind: 'rule'; skills?: string[]; tags?: TagQuery; rule: RuleChange }
  /** A stacking buff fed by distance moved or kills (optionally only by the targets), decaying after `decayMs` without gain. */
  | { kind: 'stacking'; buff: string; source: 'distance' | 'kills'; per: number; max: number; decayMs: number; decay?: 'all' | 'one';
      skills?: string[]; tags?: TagQuery; stackDmg?: Amount; stackIas?: Amount; onMax?: { buff?: BuffGrant; reset?: boolean };
      /** kills only: the killed enemy must meet this target condition (e.g. it was bleeding or burning). */
      when?: Condition }
  /** The targets may be cast with too little resource, down to -max; while in debt regeneration changes by regenPct. */
  | { kind: 'resourceDebt'; max: number; skills?: string[]; tags?: TagQuery; regenPct?: number }
  /** Dash cooldown multiplier (0.5 = halved). */
  | { kind: 'dashCooldown'; mult: number }
  /** Set bonuses need `by` (1) fewer worn pieces, never fewer than `min` (2). Does not stack (the largest applies). */
  | { kind: 'setReduce'; by?: number; min?: number };

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
    case 'proc': return r(e.reduceCooldownsMs) || r(e.resource) || !!e.buff && (r(e.buff.dmg) || r(e.buff.chc) || r(e.buff.chd) || r(e.buff.ias) || r(e.buff.dr) || r(e.buff.stackDmg) || r(e.buff.stackIas) || r(e.buff.cdRecovery))
      || !!e.strike && r(e.strike.coef) || !!e.ground && r(e.ground.scale) || !!e.applyStatus && (r(e.applyStatus.pct) || r(e.applyStatus.coef));
    case 'damageTaken': case 'firstHit': return r(e.pct);
    case 'cheatDeath': return !!e.buff && r(e.buff.dr);
    case 'projectile': return !!e.distBonus && r(e.distBonus.pct);
    case 'stacking': return r(e.stackDmg) || r(e.stackIas) || !!e.onMax?.buff && (r(e.onMax.buff.dmg) || r(e.onMax.buff.ias) || r(e.onMax.buff.cdRecovery));
    case 'dot': return r(e.carryPct);
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

const skillName = (id: string) => (Object.hasOwn(SKILLS, id) ? SKILLS[id].name : Object.hasOwn(GROUND_DEFS, id) ? GROUND_DEFS[id].name : id.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
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
const STATE_TEXT: Record<TargetState, string> = { stunned: 'stunned', frozen: 'frozen', chilled: 'chilled', bleeding: 'bleeding', burning: 'burning', immobilised: 'immobilised', inBlackHole: 'Black Hole-bound', marked: 'marked', weakened: 'weakened' };
const conditionText = (c: Condition): string =>
  'all' in c ? c.all.map(conditionText).join(' and ')
  : 'any' in c ? c.any.map(conditionText).join(' or ')
  : 'targetElite' in c ? 'against elites'
  : 'targetControlledWithinMs' in c ? `against enemies controlled in the last ${c.targetControlledWithinMs / 1000} seconds`
  : 'standingStillMs' in c ? `after standing still for ${c.standingStillMs / 1000} seconds`
  : 'inDebt' in c ? 'while your resource is below zero'
  : 'noEnemyWithin' in c ? `while no enemy is within ${c.noEnemyWithin} units`
  : 'channeling' in c ? (c.channeling === true ? 'while channelling' : typeof c.channeling === 'string' ? `while channelling ${skillName(c.channeling)}` : `while channelling ${tagText(c.channeling)}`)
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
  'all' in c ? c.all.flatMap((x) => conditionTokens(x, n)) : 'any' in c ? c.any.flatMap((x) => conditionTokens(x, n))
  : 'targetControlledWithinMs' in c ? [n(c.targetControlledWithinMs / 1000)] : 'standingStillMs' in c ? [n(c.standingStillMs / 1000)]
  : 'noEnemyWithin' in c ? [n(c.noEnemyWithin)]
  : 'perSummon' in c || 'buffStacks' in c ? [n(c.max)] : 'targetLifeAbovePct' in c ? [n(c.targetLifeAbovePct)] : 'targetFartherThan' in c ? [n(c.targetFartherThan)]
  : 'lifeBelowPct' in c ? [n(c.lifeBelowPct)] : 'lifeAbovePct' in c ? [n(c.lifeAbovePct)] : [];

const PROC_WHEN: Record<ProcTrigger, string> = {
  hit: 'Hitting an enemy', crit: 'Critical hits', kill: 'Killing an enemy', eliteKill: 'Killing an elite', spend: 'Each resource-spending skill',
  cast: 'Casting a skill', attack: 'Primary attacks', dash: 'Dashing', takeDamage: 'Taking damage', applyStatus: 'Applying a status',
};
const buffText = (b: BuffGrant): string => {
  const parts = [b.dmg !== undefined ? `${fmt(b.dmg)}% increased damage` : '', b.chc !== undefined ? `${fmt(b.chc)}% Critical Hit Chance` : '',
    b.chd !== undefined ? `${fmt(b.chd)}% Critical Hit Damage` : '', b.ias !== undefined ? `${fmt(b.ias)}% attack speed` : '',
    b.dr !== undefined ? `${fmt(b.dr)}% damage reduction` : '', b.ccImmune ? 'immunity to control effects' : '',
    b.stackDmg !== undefined ? `${fmt(b.stackDmg)}% increased damage per stack (max ${b.maxStacks ?? 1})` : '',
    b.stackIas !== undefined ? `${fmt(b.stackIas)}% attack speed per stack (max ${b.maxStacks ?? 1})` : '',
    b.cdRecovery !== undefined ? `${fmt(b.cdRecovery)}% faster cooldown recovery` : ''].filter(Boolean);
  return `grants ${parts.length ? list(parts) : skillName(b.id)} for ${b.ms / 1000} seconds`;
};
const ruleText = (r: RuleChange, who: string): string => {
  switch (r.id) {
    case 'charges': return `${who} store ${r.extra} extra charge${r.extra === 1 ? '' : 's'}`;
    case 'channelMove': return `While channelling ${who}, you move at ${r.pct}% movement speed or more`;
    case 'buffUpkeep': return `${who} do not expire in combat; they cost their resource again every ${r.everyMs / 1000} seconds instead`;
    case 'spendRefund': return `${who} refund ${r.pct}% of their cost when they hit ${r.minHits} or more enemies`;
    case 'groundsFollow': return `Your ground effects follow you at ${Math.round(r.scale * 100)}% size`;
    case 'countsAs': return `For your powers, ${STATE_TEXT[r.state]} enemies also count as ${STATE_TEXT[r.as]}`;
    case 'markSpread': return `Your Marks also apply to the nearest other enemy within ${r.range} units`;
    case 'statusLonger': return `Your ${({ chill: 'Chills', stun: 'Stuns', freeze: 'Freezes' })[r.status]} last ${r.pct}% longer`;
  }
};
const ruleTokens = (r: RuleChange, n: (v: number) => string): string[] => {
  switch (r.id) {
    case 'charges': return [n(r.extra)];
    case 'channelMove': return [n(r.pct)];
    case 'buffUpkeep': return [n(r.everyMs / 1000)];
    case 'spendRefund': return [n(r.pct), n(r.minHits)];
    case 'groundsFollow': return [n(Math.round(r.scale * 100))];
    case 'countsAs': return [];
    case 'markSpread': return [];
    case 'statusLonger': return [n(r.pct)];
  }
};
const STATUS_TEXT: Record<StatusKind, string> = {
  stun: 'stuns', freeze: 'freezes', chill: 'chills', knockback: 'knocks back', pull: 'pulls in', weaken: 'weakens', vulnerable: 'makes vulnerable',
  taunt: 'taunts', bleed: 'causes bleeding on', burn: 'burns', freezeBuild: 'builds Freeze on', mark: 'marks',
};
const statusText = (st: StatusSpec): string => `${STATUS_TEXT[st.kind]} ${st.radius ? `enemies within ${st.radius} units` : 'the enemy'}${st.ms ? ` for ${st.ms / 1000} seconds` : ''}`;

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
    case 'skillMore': return `${names(e)} deal ${fmt(e.pct)}% ${typeof e.pct === 'number' && e.pct < 0 ? 'less' : 'more'} damage${e.when ? ' ' + conditionText(e.when) : ''}.`;
    case 'stat': return `${e.noSetBonus ? 'While no set bonus is active, ' : ''}${e.perLegendary ? `each equipped legendary item increases ${STAT_TEXT[e.stat] ?? e.stat} by ${fmt(e.value)}% (max ${e.perLegendary.max} items)` : `increases ${STAT_TEXT[e.stat] ?? e.stat} by ${fmt(e.value)}${['str', 'dex', 'int', 'vit', 'armor', 'allRes'].includes(e.stat) ? '' : '%'}`}.`.replace(/^i/, 'I');
    case 'elementStacks': return `Dealing ${e.elements.map(cap).join(', ')} damage ${e.bucket === 'generic' ? 'grants' : 'increases your damage by'} ${e.perStack}%${e.bucket === 'generic' ? ' increased damage' : ''} for ${e.windowMs / 1000} seconds per element (max ${e.elements.length}).`;
    case 'elementCycle': return `Gain a ${fmt(e.pct)}% damage bonus to a single element that rotates every ${e.periodMs / 1000} seconds.`;
    case 'proc': {
      const when = PROC_WHEN[e.on];
      const parts: string[] = [];
      if (e.reduceCooldownsMs !== undefined) parts.push(`reduces your active cooldowns by ${typeof e.reduceCooldownsMs === 'object' ? '{v}' : fmt(e.reduceCooldownsMs / 1000)} seconds`);
      if (e.resource !== undefined) parts.push(`restores ${fmt(e.resource)} resource`);
      if (e.buff) parts.push(buffText(e.buff));
      if (e.resetCooldowns) parts.push(`resets the cooldown of ${list(e.resetCooldowns.map(skillName))}`);
      if (e.strike) parts.push(`deals ${fmt(e.strike.coef) === '{v}' ? '{v}' : fmt(typeof e.strike.coef === 'number' ? e.strike.coef * 100 : e.strike.coef)}% weapon damage${e.strike.element ? ` as ${cap(e.strike.element)}` : ''}${e.strike.radius ? ` to enemies within ${e.strike.radius} units` : ''}`);
      if (e.summon) parts.push(`summons a ${skillName(e.summon.type)} for ${e.summon.lifeMs / 1000} seconds`);
      if (e.ground) parts.push(`creates ${skillName(e.ground.def)}`);
      if (e.applyStatus) parts.push(statusText(e.applyStatus));
      if (e.clearProjectiles) parts.push(`destroys enemy projectiles within ${e.clearProjectiles.range} units in front of you`);
      if (e.repeat) parts.push('repeats once');
      const icd = e.icdMs ? ` (once every ${e.icdMs / 1000} seconds)` : '';
      const every = e.every && e.every > 1 ? `Every ${e.every}th: ` : '';
      return `${every}${e.chance !== undefined ? `${Math.round(e.chance * 100)}% chance: ` : ''}${when}${e.when ? ` ${conditionText(e.when)}` : ''} ${parts.join(' and ')}${icd}.`;
    }
    case 'damageTaken': {
      const v = typeof e.pct === 'number' ? fmt(e.pct) : '{v}', more = typeof e.pct === 'number' && e.pct < 0 ? 'less' : 'more';
      const base = e.perLegendary ? `Each equipped legendary item makes you take ${v}% ${more} damage (max ${e.perLegendary.max} items)` : `You take ${v}% ${more} damage${e.when ? ' ' + conditionText(e.when) : ''}`;
      return `${e.noSetBonus ? 'While no set bonus is active, ' + base[0].toLowerCase() + base.slice(1) : base}.`;
    }
    case 'firstHit': return `The first hit you take every ${e.windowMs / 1000} seconds deals ${fmt(e.pct)}% ${typeof e.pct === 'number' && e.pct > 0 ? 'more' : 'less'} damage.`;
    case 'cheatDeath': return `Fatal damage instead leaves you at ${e.lifePct}% Life${e.invulnMs ? ` and invulnerable for ${e.invulnMs / 1000} seconds` : ''}${e.when ? ' ' + conditionText(e.when) : ''}. This can happen once every ${e.cooldownMs / 1000} seconds.`;
    case 'controlImmunity': return `You cannot be ${e.kinds ? list(e.kinds.map((k) => ({ stun: 'stunned', freeze: 'frozen', pull: 'pulled or knocked back' })[k]), 'or') : 'stunned, frozen or pulled'}${e.when ? ' ' + conditionText(e.when) : ''}.`;
    case 'projectile': {
      const who = names(e), parts: string[] = [];
      if (e.distBonus) parts.push(`${who} deal up to ${fmt(e.distBonus.pct)}% more damage the farther they travel (full at ${e.distBonus.atUnits} units)`);
      if (e.bounces) parts.push(`${who} bounce off walls up to ${e.bounces} times`);
      if (e.retarget) parts.push(`${who} seek a new target when theirs dies`);
      if (e.seekMarked) parts.push(`${who} home in on marked enemies`);
      if (e.returns) parts.push(`${who} return to you once after their last hit`);
      if (e.rangeRicochet) parts.push(`${who} also ricochet at maximum range`);
      return parts.join('; ') + '.';
    }
    case 'deflect': return `Enemy projectiles within ${e.range} units in front of you are destroyed${e.when ? ' ' + conditionText(e.when) : ''}.`;
    case 'tagGrant': return `${names(e)} also count${plural(e) ? '' : 's'} as ${[...(e.add ?? []).map(cap), ...(e.fromSlot !== undefined ? [`the skill in slot ${e.fromSlot + 1}`] : [])].join(' and ')}.`;
    case 'rule': return ruleText(e.rule, names(e)) + '.';
    case 'dot': {
      const parts = [e.stacks && e.stacks > 1 ? `stack up to ${e.stacks} times instead of refreshing` : '', e.strengthPct !== undefined ? `deal ${e.strengthPct}% of their damage` : '',
        e.carryPct !== undefined ? `carry ${fmt(e.carryPct)}% of the remaining damage into a new application` : ''].filter(Boolean);
      return `${cap(e.dot === 'bleed' ? 'bleeds' : e.dot === 'burn' ? 'burns' : 'poisons')}${e.skills || e.tags ? ' from ' + names(e) : ''} ${list(parts)}.`;
    }
    case 'stacking': {
      const src = e.source === 'distance' ? `every ${e.per} units you move` : `every ${e.per === 1 ? '' : e.per + ' '}kill${e.per === 1 ? '' : 's'}${e.skills || e.tags ? ' with ' + names(e) : ''}`;
      const per = [e.stackDmg !== undefined ? `${fmt(e.stackDmg)}% increased damage` : '', e.stackIas !== undefined ? `${fmt(e.stackIas)}% attack speed` : ''].filter(Boolean).join(' and ');
      const max = e.onMax?.buff ? ` At ${e.max} stacks, ${buffText(e.onMax.buff)}${e.onMax.reset ? ' and the stacks reset' : ''}.` : '';
      return `Gain a stack of ${skillName(e.buff)} ${src}${e.when ? ' ' + conditionText(e.when) : ''} (max ${e.max})${per ? `, each granting ${per}` : ''}.${Number.isFinite(e.decayMs) ? ` Stacks fade after ${e.decayMs / 1000} seconds without gaining one.` : ''}${max}`;
    }
    case 'resourceDebt': return `${names(e)} can be cast without enough resource, down to -${e.max}${e.regenPct ? `; while below zero, resource regenerates ${Math.abs(e.regenPct)}% ${e.regenPct > 0 ? 'faster' : 'slower'}` : ''}.`;
    case 'dashCooldown': return `Dash cooldown is reduced by ${Math.round((1 - e.mult) * 100)}%.`;
    case 'setReduce': return `Set bonuses require ${e.by ?? 1} fewer item${(e.by ?? 1) === 1 ? '' : 's'} (minimum ${e.min ?? 2}).`;
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
    case 'proc': return [...(typeof e.reduceCooldownsMs === 'number' ? [n(e.reduceCooldownsMs / 1000)] : []), ...a(e.resource), ...(e.buff ? [n(e.buff.ms / 1000), ...a(e.buff.dmg)] : []),
      ...(e.icdMs ? [n(e.icdMs / 1000)] : []), ...(e.strike && typeof e.strike.coef === 'number' ? [n(e.strike.coef * 100)] : []),
      ...(e.every && e.every > 1 ? [n(e.every)] : []), ...(e.summon ? [n(e.summon.lifeMs / 1000)] : []), ...(e.applyStatus?.ms ? [n(e.applyStatus.ms / 1000)] : []), ...(e.applyStatus ? a(e.applyStatus.pct) : []),
      ...(e.when ? conditionTokens(e.when, n) : [])];
    case 'damageTaken': return [...a(e.pct), ...(e.perLegendary ? [n(e.perLegendary.max)] : []), ...(e.when ? conditionTokens(e.when, n) : [])];
    case 'firstHit': return [...a(e.pct), n(e.windowMs / 1000)];
    case 'cheatDeath': return [n(e.lifePct), n(e.cooldownMs / 1000), ...(e.invulnMs ? [n(e.invulnMs / 1000)] : [])];
    case 'controlImmunity': return e.when ? conditionTokens(e.when, n) : [];
    case 'projectile': return [...(e.distBonus ? [...a(e.distBonus.pct), n(e.distBonus.atUnits)] : []), ...(e.bounces ? [n(e.bounces)] : [])];
    case 'stacking': return [n(e.max), ...(Number.isFinite(e.decayMs) ? [n(e.decayMs / 1000)] : []), ...a(e.stackDmg), ...a(e.stackIas), ...(e.onMax?.buff ? [n(e.onMax.buff.ms / 1000)] : [])];
    case 'resourceDebt': return [n(e.max)];
    case 'deflect': return [n(e.range), ...(e.when ? conditionTokens(e.when, n) : [])];
    case 'tagGrant': return [...(e.add ?? []).map(cap), ...(e.fromSlot !== undefined ? [n(e.fromSlot + 1)] : [])];
    case 'rule': return ruleTokens(e.rule, n);
    case 'dot': return [...(e.stacks && e.stacks > 1 ? [n(e.stacks)] : []), ...(e.strengthPct !== undefined ? [n(e.strengthPct)] : []), ...a(e.carryPct)];
    case 'dashCooldown': return [n((1 - e.mult) * 100)];
    case 'setReduce': return [n(e.by ?? 1), n(e.min ?? 2)];
  }
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Problems with an authored text for these effects: missing numbers / elements, or a {v} that does (not) belong. */
export function powerTextIssues(text: string, effects: readonly PowerEffect[], rolled: boolean): string[] {
  const issues: string[] = [];
  const plain = text.replaceAll(',', '');
  const hasNumber = (tok: string) => /^[A-Z]/.test(tok) ? plain.includes(tok)
    : new RegExp(`(^|[^0-9.])${tok.replace('.', '\\.')}([^0-9]|$)`).test(plain) || (Number.isInteger(+tok) && +tok <= 10 && new RegExp(`\\b${WORDS[+tok]}\\b`, 'i').test(plain))
      || (tok === '50' && /\bhalf\b/i.test(plain)) || (tok === '100' && /\bfull\b/i.test(plain));
  for (const e of effects) for (const tok of effectTokens(e)) if (!hasNumber(tok)) issues.push(`text does not mention ${tok} (${e.kind})`);
  const needsV = effects.some(usesRoll);
  if (rolled && needsV !== text.includes('{v}')) issues.push(needsV ? 'rolled effect but no {v} in text' : '{v} in text but no rolled effect');
  if (!rolled && text.includes('{v}')) issues.push('{v} in text but this source has no roll');
  return issues;
}
