import { SKILL_SLOTS, type SkillDef } from './data/skills';
import type { SkillLoadout } from './types';

export const AUTO_CAST_MODES = ['auto', 'still', 'paused'] as const;
export type AutoCastMode = typeof AUTO_CAST_MODES[number];
export const AUTO_CAST_LABEL: Record<AutoCastMode, string> = { auto: 'Automatic', still: 'While still', paused: 'Paused' };
export const AUTO_CAST_NOTE: Record<AutoCastMode, string> = {
  auto: 'Uses the normal skill rule. Cooldown, resource and target checks still apply.',
  still: 'Automatic casts require standing still. Moving stops an automatic channel. Optional manual keys still work.',
  paused: 'Stops automatic casts and automatic channels. Optional manual keys still work. Existing effects continue.',
};
export const isAutoCastMode = (value: unknown): value is AutoCastMode =>
  value === 'auto' || value === 'still' || value === 'paused';

/** Missing legacy values keep automatic combat; malformed present values fail closed. */
export function normalizeAutoCast(value: unknown): AutoCastMode[] {
  return Array.from({ length: SKILL_SLOTS }, (_, i) => {
    const mode: unknown = Array.isArray(value) ? value[i] : value === undefined ? undefined : null;
    return mode === undefined ? 'auto' : isAutoCastMode(mode) ? mode : 'paused';
  });
}

export function autoCastMode(skills: SkillLoadout, slot: number): AutoCastMode {
  const mode = skills.autoCast?.[slot];
  return mode === undefined ? 'auto' : isAutoCastMode(mode) ? mode : 'paused';
}

/** Describes existing authored rules, not a second combat calculation. */
export function autoCastRuleText(skill: SkillDef, resource: string): string {
  const rule = skill.auto;
  switch (rule.when) {
    case 'always': return 'Fires automatically while enemies are in range.';
    case 'enemiesNear': return `Needs enemy weight ${rule.count} within ${rule.within} base units. Ordinary enemies count as 1, elites and treasure goblins as 3, and bosses as 10.${['rend', 'ground_stomp', 'frost_nova'].includes(skill.id) ? ' This range can grow with skill radius.' : ''}${skill.id === 'rend' ? ' Enemies already bleeding from your Rend do not count.' : ''}`;
    case 'maintainBuff': return 'Refreshes its buff near enemies when at most 2 seconds remain.';
    case 'maintainSummon': return skill.id === 'companion' ? 'Maintains your companion, including outside combat.' : 'Replaces missing or distant summons when enemies are in skill range.';
    case 'channel': return `Starts at ${rule.startAt} ${resource} with enemies within ${rule.within} units, then uses the normal channel upkeep.`;
  }
}
