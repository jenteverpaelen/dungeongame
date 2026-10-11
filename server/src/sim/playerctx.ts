// Per-player combat context: derived stats + every slotted skill's merged mods (rune + tiers + legendary powers
// + set bonuses). Rebuilt whenever the save changes (level-up, equipment, skills, paragon, cube).

import { CLASSES, SKILLS, computeStats, loadoutMods, mergeMods, type DerivedStats, type SkillMods } from '../shared';
import { powerCounts } from '../../../shared/src/stats';
import { affixPowerSources, allPowerSources, type PowerSource } from '../../../shared/src/powerSources';
import { passivePowerSources } from '../../../shared/src/passives';
import { buildPowerRuntime, ownMultiplier, tagIndexFor, type PowerRuntime } from './powerRuntime';
import type { Player, PlayerCtx, SaveX, SkillRuntime } from './types';

const NO_MODS: SkillMods = { flags: [] };

function runtime(save: SaveX, powers: PowerRuntime, skillId: string): SkillRuntime {
  const def = SKILLS[skillId];
  const mods = mergeMods(loadoutMods(save, skillId), powers.mods.get(skillId) ?? NO_MODS);
  return { def, mods, flags: new Set(mods.flags ?? []) };
}

/** `extra` sources join after the save's own (tests, sandbox / build tools); the game never passes any. */
export function buildCtx(save: SaveX, d: DerivedStats = computeStats(save), extra: readonly PowerSource[] = []): PlayerCtx {
  // One interpreter for every power template (sets → legendaries → passives → nodes): shared/src/powerSources.ts.
  const sources = [...allPowerSources(save, d.powers, d.sets, passivePowerSources(save)), ...affixPowerSources(d)];
  const powers = buildPowerRuntime(extra.length ? [...sources, ...extra] : sources, tagIndexFor(save.classId, save.skills.runes),
    { ...powerCounts(save.equipment, d.sets, d.powers), slots: save.skills.slots });
  const cache = new Map<string, SkillRuntime>();
  const get = (id: string) => {
    let r = cache.get(id);
    if (!r) { r = runtime(save, powers, id); cache.set(id, r); }
    return r;
  };
  const slots = [0, 1, 2, 3].map((i) => {
    const id = save.skills.slots[i];
    return id && SKILLS[id] && SKILLS[id].classId === save.classId && SKILLS[id].unlock <= save.level && SKILLS[id].kind !== 'primary' ? get(id) : null;
  });
  const primaryId = save.skills.primary && SKILLS[save.skills.primary]?.classId === save.classId ? save.skills.primary : CLASSES[save.classId].primary;
  const primary = get(primaryId);
  const flagSet = new Set<string>();
  for (const r of [primary, ...slots]) if (r) for (const f of r.flags) flagSet.add(f);

  const stomp = slots.find((s) => s?.def.id === 'ground_stomp');
  const nova = slots.find((s) => s?.def.id === 'frost_nova');
  const jarring = stomp && stomp.flags.has('vulnerable') ? 1.3 : 1;
  const boneChill = nova && nova.flags.has('vulnerable') ? 1.33 : 1;

  return {
    d, slots, primary,
    modsOf: get,
    anyFlag: (f) => flagSet.has(f),
    slotted: (id) => slots.find((s) => s?.def.id === id) ?? null,
    setCount: (id) => d.sets[id] ?? 0,
    power: (id) => d.powers[id] ?? 0,
    stunMult: jarring * powers.stunFactor,
    frozenMult: boneChill * powers.frozenFactor,
    powers,
    attackRange: CLASSES[save.classId].attackRange,
    dashCdMs: d.dashCdMs,
  };
}

/** Additive skill bucket (rune/tier/legendary dmg% + gear "+x% skill damage"). */
export function skillPct(p: Player, rt: SkillRuntime): number {
  return (rt.mods.dmg ?? 0) + (p.ctx.d.skillDmg[rt.def.id] ?? 0);
}

/** Resource cost after skill mods, resource cost reduction and buff cost factors (Kilnheart). */
export function skillCost(p: Player, rt: SkillRuntime): number {
  const c = rt.def.cost * Math.max(0, 1 + (rt.mods.cost ?? 0) / 100) * (1 - p.ctx.d.rcr / 100) * (p.live?.cost ?? 1);
  return Math.max(0, c);
}

export function skillCooldownMs(p: Player, rt: SkillRuntime): number {
  const f = Math.max(0.1, 1 + (rt.mods.cooldown ?? 0) / 100) * (1 - p.ctx.d.cdr / 100);
  return rt.def.cooldown * 1000 * Math.max(0.05, f);
}

/** One attack at the player's current attack speed (the primary attack's interval). */
export function attackIntervalMs(p: Player): number {
  const aps = Math.max(0.2, p.ctx.d.aps * (1 + p.live.ias / 100));
  return 1000 / aps;
}

/**
 * [P] Shortest time between two casts of one skill that has no cooldown.
 * Measured [M] in all 216 kits of WARRIOR-PARITY.json (one encounter each, seed 101):
 *   * without a floor, Sawtooth Hatchet and Quakeline were cast on consecutive 50 ms ticks in bursts, and with
 *     unlimited resource a spender was cast every tick (20 per second);
 *   * with this floor, Sawtooth Hatchet fell from 2.42 to 1.13 casts per second, yet the kits cleared their encounters
 *     1.6 % faster in total (6979 → 6865 s): the bursts mostly wasted Fury on overlapping hatchets.
 * 250 ms = at most 4 casts per second per skill. The alternative is one cast per attack interval, the way D3, D4 and
 * PoE bind skills to attack speed [K] (the mage's Stormglass Orb uses it, mageM1.ts). Leveling sim, 9 seeds × 120 min
 * per class, paired against no floor (FOUNDATION.md §13.14) [M]:
 *   * this floor: levels reached and L25+ champion kill times within noise (warrior −0.7 ± 0.5 s, ranger −0.6 ± 0.5 s,
 *     mage +0.7 ± 0.9 s);
 *   * one cast per attack interval: kill times within noise as well, but one warrior run of nine collapsed (85 deaths,
 *     level 17 instead of 25–30), warrior deaths 107 vs 21 (no floor) and mage deaths 27 vs 19, so it is a balance
 *     decision, not this guard.
 */
export const MIN_RECAST_MS = 250;

export function skillRadius(rt: SkillRuntime): number {
  return rt.def.radius * Math.max(0.2, 1 + (rt.mods.radius ?? 0) / 100);
}

export function skillDurationMs(rt: SkillRuntime): number {
  return rt.def.duration * 1000 * Math.max(0.1, 1 + (rt.mods.duration ?? 0) / 100);
}

export function maxSummonsOf(rt: SkillRuntime): number {
  return Math.max(1, rt.def.maxSummons + (rt.mods.maxSummons ?? 0));
}

export function skillElement(rt: SkillRuntime) {
  return rt.mods.element ?? rt.def.element;
}

export function activeSentries(p: Player): number {
  let n = 0;
  for (const s of p.summons) if (s.type === 'sentry' && !s.dead) n++;
  return n;
}

/** Own-bucket multiplier (set bonuses, conditional power terms), capped by OWN_BUCKET_CAP. */
export function skillMult(p: Player, skillId: string): number {
  return ownMultiplier(p, skillId);
}
