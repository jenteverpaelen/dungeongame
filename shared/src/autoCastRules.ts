import { SKILLS, SKILL_SLOTS, type SkillDef } from './data/skills';
import type { ClassId, SkillLoadout } from './types';
import { normalizeAutoCast } from './autoCast';

/** Preference bounds: existing boss weight and longest existing automatic scan (buff maintenance). */
export const MAX_RULE_WEIGHT = 10;
export const MAX_RULE_WITHIN = 700;
export interface AutoCastRule {
  enemyWeight: number | null;
  within: number | null;
  elitesOnly: boolean;
  reservePct: number;
  requireBuff: string | null;
}
export const DEFAULT_AUTO_RULE: Readonly<AutoCastRule> = Object.freeze({ enemyWeight:null, within:null, elitesOnly:false, reservePct:0, requireBuff:null });
const integer = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

export function isAutoCastRule(value: unknown, classId: ClassId): value is AutoCastRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).length !== 5 || Object.keys(r).some(k => !Object.hasOwn(DEFAULT_AUTO_RULE,k))) return false;
  if (r.enemyWeight !== null && !integer(r.enemyWeight,1,MAX_RULE_WEIGHT)) return false;
  if (r.within !== null && !integer(r.within,1,MAX_RULE_WITHIN)) return false;
  if (typeof r.elitesOnly !== 'boolean' || !integer(r.reservePct,0,100)) return false;
  if (r.requireBuff !== null) {
    if (typeof r.requireBuff !== 'string' || !Object.hasOwn(SKILLS,r.requireBuff)) return false;
    const buff = SKILLS[r.requireBuff];
    if (buff.kind !== 'buff' || buff.classId !== classId) return false;
  }
  return true;
}

/** Missing legacy conditions retain defaults. Invalid present conditions pause only that auto slot. */
export function normalizeSavedAutoRules(skills: SkillLoadout, classId: ClassId) {
  const raw: unknown = skills.autoRules;
  const modes = normalizeAutoCast(skills.autoCast);
  skills.autoRules = Array.from({length:SKILL_SLOTS},(_,i) => {
    const value: unknown = raw === undefined ? null : Array.isArray(raw) ? raw[i] ?? null : false;
    if (value === null) return null;
    if (isAutoCastRule(value,classId)) return { ...value };
    modes[i]='paused'; return null;
  });
  skills.autoCast = modes;
}

export const autoRuleForSlot = (skills: SkillLoadout, slot: number): Readonly<AutoCastRule> => skills.autoRules?.[slot] ?? DEFAULT_AUTO_RULE;

export function autoRuleSummary(rule: Readonly<AutoCastRule>, skill: SkillDef): string {
  const parts: string[] = [];
  if (skill.auto.when === 'enemiesNear') {
    if (rule.enemyWeight !== null) parts.push(`Enemy weight ≥ ${rule.enemyWeight}`);
    if (rule.within !== null) parts.push(`within ${Math.min(rule.within,skill.auto.within)} base units`);
  }
  if (rule.elitesOnly) parts.push('elite or boss nearby');
  if (rule.reservePct > 0) parts.push(`keep ${rule.reservePct}% resource after spending`);
  if (rule.requireBuff) parts.push(`wait for ${SKILLS[rule.requireBuff]?.name ?? rule.requireBuff}`);
  return parts.length ? parts.join(' · ') : 'Normal skill conditions';
}
