// Skill registry: the per-class data files composed into one SKILLS record (registry order = warrior, ranger,
// mage, each in file order), plus the helpers every consumer uses. Import from 'shared/src/data/skills'.

import type { ClassId } from '../../types';
import type { SkillDef, SkillMods } from './types';
import { RUNE_UNLOCK_OFFSETS } from './types';
import { WARRIOR_SKILLS } from './warrior';
import { RANGER_SKILLS } from './ranger';
import { MAGE_SKILLS } from './mage';

export * from './types';

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  [...WARRIOR_SKILLS, ...RANGER_SKILLS, ...MAGE_SKILLS].map((s) => [s.id, s]),
);

export function skillsForClass(classId: ClassId): SkillDef[] {
  return Object.values(SKILLS).filter((s) => s.classId === classId).sort((a, b) => a.unlock - b.unlock);
}

export function runeUnlockLevel(skill: SkillDef, runeIndex: number): number {
  return skill.unlock + RUNE_UNLOCK_OFFSETS[runeIndex];
}

/** Merge rune + purchased tiers into a single mods object (legendary/set mods are merged by the server). */
export function collectSkillMods(skill: SkillDef, runeId: string | null | undefined, tiers: number): SkillMods {
  const out: SkillMods = { flags: [] };
  const add = (m: SkillMods) => {
    for (const k of ['dmg', 'radius', 'cost', 'cooldown', 'duration', 'projectiles', 'pierce', 'gen', 'maxSummons'] as const) {
      if (m[k] !== undefined) out[k] = (out[k] ?? 0) + (m[k] as number);
    }
    if (m.element) out.element = m.element;
    if (m.flags) out.flags!.push(...m.flags);
  };
  const rune = skill.runes.find((r) => r.id === runeId);
  if (rune) add(rune.mods);
  for (let i = 0; i < Math.min(tiers, skill.tiers.length); i++) add(skill.tiers[i].mods);
  return out;
}

export function mergeMods(a: SkillMods, b: SkillMods): SkillMods {
  const out: SkillMods = { ...a, flags: [...(a.flags ?? [])] };
  for (const k of ['dmg', 'radius', 'cost', 'cooldown', 'duration', 'projectiles', 'pierce', 'gen', 'maxSummons'] as const) {
    if (b[k] !== undefined) out[k] = (out[k] ?? 0) + (b[k] as number);
  }
  if (b.element) out.element = b.element;
  if (b.flags) out.flags!.push(...b.flags);
  return out;
}

/** The same bonuses are applied by the server and shown in skill summaries. */
export function skillBuffBonuses(id: 'battle_rage' | 'magic_weapon', flags: ReadonlySet<string>): { dmg: number; chc?: number; chd?: number } {
  if (id === 'battle_rage') return {
    dmg: (flags.has('rageDmg') ? 25 : 10) + (flags.has('rageExtra') ? 5 : 0),
    chc: 3, chd: flags.has('rageChd') ? 25 : 0,
  };
  return { dmg: (flags.has('forceWeapon') ? 20 : 10) + (flags.has('weaponExtra') ? 5 : 0) };
}

/** Render rune/tier numbers; equipment-specific modifiers require the caller to supply them. */
export function describeSkill(skill: SkillDef, mods?: SkillMods): string {
  const m = mods ?? {};
  const coef = skill.coef * (1 + (m.dmg ?? 0) / 100);
  const buff = skill.id === 'battle_rage' || skill.id === 'magic_weapon'
    ? skillBuffBonuses(skill.id, new Set(m.flags ?? [])) : undefined;
  const element = m.element ?? skill.element;
  return skill.desc
    .replace('{coef}', `${Math.round(coef * 100)}%`)
    .replace('{element}', element[0].toUpperCase() + element.slice(1))
    .replace('{buffDamage}', `${buff?.dmg ?? 0}%`)
    .replace('{buffCritChance}', `${buff?.chc ?? 0}%`)
    .replace('{buffCritDamage}', buff?.chd ? ` and Critical Hit Damage by ${buff.chd}%` : '')
    .replace('{gen}', String(skill.gen + (m.gen ?? 0)))
    .replace('{cost}', String(Math.round(skill.cost * (1 + (m.cost ?? 0) / 100))))
    .replace('{duration}', String(+(skill.duration * (1 + (m.duration ?? 0) / 100)).toFixed(1)))
    .replace('{radius}', String(Math.round(skill.radius * (1 + (m.radius ?? 0) / 100))))
    .replace('{max}', String(skill.maxSummons + (m.maxSummons ?? 0)));
}
