// Per-player combat context: derived stats + every slotted skill's merged mods (rune + tiers + legendary powers
// + set bonuses). Rebuilt whenever the save changes.

import { CLASSES, SKILLS, computeStats, loadoutMods, mergeMods, type DerivedStats, type SkillMods } from '../shared';
import type { Player, PlayerCtx, SaveX, SkillRuntime } from './types';

/** Legendary-power and set-bonus modifications for one skill (see ARCHITECTURE 1.5). */
function extraMods(d: DerivedStats, skillId: string): SkillMods {
  const m: SkillMods = { flags: [] };
  const pw = d.powers, sets = d.sets;
  const add = (k: 'dmg' | 'radius' | 'cost' | 'cooldown' | 'duration' | 'projectiles' | 'maxSummons', v: number) => { m[k] = (m[k] ?? 0) + v; };
  switch (skillId) {
    case 'whirlwind':
      if (pw.eternal_gyre) add('cost', -pw.eternal_gyre);
      if (pw.ninefold_gale) m.flags!.push('dustDevils');
      if ((sets.endless_storm ?? 0) >= 2) m.flags!.push('dustDevils');
      if ((sets.endless_storm ?? 0) >= 4) m.flags!.push('whirlRend');
      break;
    case 'rend':
      if (pw.bloodwake) add('dmg', pw.bloodwake);
      break;
    case 'ground_stomp':
      if (pw.last_light) { add('dmg', pw.last_light); m.flags!.push('pull'); }
      break;
    case 'sentry':
      if (pw.sappers_pack) { add('maxSummons', 2); add('dmg', pw.sappers_pack); }
      if (pw.gearwright_heart) { add('cooldown', -pw.gearwright_heart); m.flags!.push('fastSentry'); }
      if ((sets.siegebreaker ?? 0) >= 2) { add('maxSummons', 1); add('cooldown', -30); }
      break;
    case 'multishot':
      if (pw.thunderhead) { m.element = 'lightning'; add('dmg', pw.thunderhead); }
      break;
    case 'hungering_arrow':
      if (pw.hunters_mark) m.flags!.push('huntersMark');
      break;
    case 'meteor':
      if (pw.cindervane) { add('dmg', pw.cindervane); m.flags!.push('moltenDouble'); }
      if (pw.starfall_mantle) { add('cost', -pw.starfall_mantle); m.flags!.push('fastMeteor'); }
      if ((sets.fallen_star ?? 0) >= 2) m.flags!.push('secondMeteor');
      break;
    case 'black_hole':
      if (pw.void_heart) { add('radius', 30); m.flags!.push('voidHeart'); }
      break;
    case 'magic_missile':
      if (pw.thousand_missiles) { add('projectiles', 2); add('dmg', pw.thousand_missiles); }
      break;
  }
  return m;
}

function runtime(save: SaveX, d: DerivedStats, skillId: string): SkillRuntime {
  const def = SKILLS[skillId];
  const mods = mergeMods(loadoutMods(save, skillId), extraMods(d, skillId));
  return { def, mods, flags: new Set(mods.flags ?? []) };
}

export function buildCtx(save: SaveX): PlayerCtx {
  const d = computeStats(save);
  const cache = new Map<string, SkillRuntime>();
  const get = (id: string) => {
    let r = cache.get(id);
    if (!r) { r = runtime(save, d, id); cache.set(id, r); }
    return r;
  };
  const slots = save.skills.slots.map((id) => (id && SKILLS[id] && SKILLS[id].classId === save.classId && SKILLS[id].unlock <= save.level ? get(id) : null));
  const primary = get(save.skills.primary || CLASSES[save.classId].primary);
  const all = [primary, ...slots.filter((s): s is SkillRuntime => !!s)];
  const flagSet = new Set<string>();
  for (const r of all) for (const f of r.flags) flagSet.add(f);

  const stomp = slots.find((s) => s?.def.id === 'ground_stomp');
  const nova = slots.find((s) => s?.def.id === 'frost_nova');
  const jarring = stomp && stomp.flags.has('vulnerable') ? 1.3 : 1;
  const anvil = d.powers.anvil_vambraces ? 1 + d.powers.anvil_vambraces / 100 : 1;
  const boneChill = nova && nova.flags.has('vulnerable') ? 1.33 : 1;

  return {
    d, slots, primary,
    modsOf: get,
    anyFlag: (f) => flagSet.has(f),
    setCount: (id) => d.sets[id] ?? 0,
    power: (id) => d.powers[id] ?? 0,
    stunMult: jarring * anvil,
    frozenMult: boneChill,
    attackRange: CLASSES[save.classId].attackRange,
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
  return rt.def.maxSummons + (rt.mods.maxSummons ?? 0);
}

/** Own-bucket multipliers (set bonuses and Tal-style power stacking). */
export function skillMult(p: Player, skillId: string): number {
  const c = p.ctx;
  let m = 1;
  switch (skillId) {
    case 'whirlwind':
    case 'dust_devil':
      if (c.setCount('endless_storm') >= 6) m *= 16;
      break;
    case 'sentry':
    case 'multishot':
    case 'cluster_arrow':
      if (c.setCount('siegebreaker') >= 6) {
        let sentries = 0;
        for (const s of p.summons) if (s.type === 'sentry' && !s.dead) sentries++;
        m *= 1 + 6 * sentries;
      }
      break;
    case 'meteor':
      if (c.setCount('fallen_star') >= 6) m *= 21;
      break;
  }
  return m;
}
