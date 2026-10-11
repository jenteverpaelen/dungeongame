// Per-player combat context: derived stats + every slotted skill's merged mods (rune + tiers + legendary powers
// + set bonuses). Rebuilt whenever the save changes (level-up, equipment, skills, paragon, cube).

import { CLASSES, SKILLS, computeStats, loadoutMods, mergeMods, type DerivedStats, type SkillMods } from '../shared';
import { allPowerSources } from '../../../shared/src/powerSources';
import { passivePowerSources } from '../../../shared/src/passives';
import { buildPowerRuntime, ownMultiplier, type PowerRuntime } from './powerRuntime';
import type { Player, PlayerCtx, SaveX, SkillRuntime } from './types';

const NO_MODS: SkillMods = { flags: [] };

function runtime(save: SaveX, powers: PowerRuntime, skillId: string): SkillRuntime {
  const def = SKILLS[skillId];
  const mods = mergeMods(loadoutMods(save, skillId), powers.mods.get(skillId) ?? NO_MODS);
  return { def, mods, flags: new Set(mods.flags ?? []) };
}

export function buildCtx(save: SaveX, d: DerivedStats = computeStats(save)): PlayerCtx {
  // One interpreter for every power template (sets → legendaries → passives → nodes): shared/src/powerSources.ts.
  const powers = buildPowerRuntime(allPowerSources(save, d.powers, d.sets, passivePowerSources(save)));
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

/** Resource cost after skill mods and resource cost reduction. */
export function skillCost(p: Player, rt: SkillRuntime): number {
  const c = rt.def.cost * Math.max(0, 1 + (rt.mods.cost ?? 0) / 100) * (1 - p.ctx.d.rcr / 100);
  return Math.max(0, c);
}

export function skillCooldownMs(p: Player, rt: SkillRuntime): number {
  const f = Math.max(0.1, 1 + (rt.mods.cooldown ?? 0) / 100) * (1 - p.ctx.d.cdr / 100);
  return rt.def.cooldown * 1000 * Math.max(0.05, f);
}

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
