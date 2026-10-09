import { ELITE_AFFIXES, MONSTERS } from './data/monsters';
import type { CharacterSave } from './types';

export interface BestiaryState { revision: 1; kills: Record<string, number>; affixes: string[] }
export function validBestiary(value: unknown): value is BestiaryState {
  if (!value || typeof value !== 'object') return false;
  const s = value as BestiaryState;
  return s.revision === 1 && !!s.kills && typeof s.kills === 'object' && !Array.isArray(s.kills)
    && Object.values(s.kills).every(n => Number.isSafeInteger(n) && n >= 0)
    && Array.isArray(s.affixes) && s.affixes.every(id => typeof id === 'string')
    && new Set(s.affixes).size === s.affixes.length;
}
/** Trusted death hook only. Future/unknown saved records survive unchanged. */
export function recordCreature(save: CharacterSave, type: string, affixes: readonly string[]): boolean {
  if (!Object.hasOwn(MONSTERS, type) || (save.bestiary && !validBestiary(save.bestiary))) return false;
  const s = save.bestiary ??= { revision: 1, kills: {}, affixes: [] };
  s.kills[type] = Math.min(Number.MAX_SAFE_INTEGER, (s.kills[type] ?? 0) + 1);
  for (const id of affixes) if (Object.hasOwn(ELITE_AFFIXES, id) && !s.affixes.includes(id)) s.affixes.push(id);
  return true;
}
