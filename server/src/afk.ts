// Idleon-style offline gains (ARCHITECTURE §1.10). If a character logged out while standing in a training
// field, the time they were away is converted into kills at AFK_EFFICIENCY of the active kill rate.

import { XP_MULT } from './config';
import { AFK_EFFICIENCY, AFK_MAX_HOURS } from '../../shared/src/constants';
import { ZONES } from '../../shared/src/data/zones';
import { clamp } from '../../shared/src/math';
import { addXp, monsterXp } from '../../shared/src/progression';
import { computeStats } from '../../shared/src/stats';
import type { S2C } from '../../shared/src/protocol';
import type { CharacterSave, Materials } from '../../shared/src/types';

export type AfkReport = Omit<Extract<S2C, { t: 'afk' }>, 't'>;

/** Away for at most this long counts; shorter absences are ignored. */
export const AFK_MIN_AWAY_MS = 2 * 60_000;
const AFK_MAX_AWAY_MS = AFK_MAX_HOURS * 3_600_000;
/** Fraction of kills dropping a gold pile, and the materials per kill (Idleon: stuff trickles in). */
const GOLD_DROP_RATE = 0.22;
const SCRAP_PER_KILL = 1 / 40;
const DUST_PER_KILL = 1 / 40;
const CRYSTAL_PER_KILL = 1 / 150;

/**
 * Applies the offline gains to the save (xp, levels, gold, materials, kill stats) and returns the report that is
 * sent to the client, or null when the character was not AFK-farming a field. Call this once per login, before
 * the save's lastZone / lastSeen are overwritten.
 */
export function applyAfkGains(save: CharacterSave, now: number): AfkReport | null {
  const away = Math.min(now - save.lastSeen, AFK_MAX_AWAY_MS);
  if (!(away > AFK_MIN_AWAY_MS)) return null;
  const zone = ZONES[save.lastZone];
  if (!zone || zone.kind !== 'field') return null;

  const minutes = away / 60_000;
  const kills = Math.floor(minutes * 60 * AFK_EFFICIENCY);
  if (kills <= 0) return null;

  // Monsters in a field level with the player, clamped to the zone's band.
  const level = clamp(save.level, zone.levelBand[0], zone.levelBand[1]);
  const d = computeStats(save);
  const xp = Math.round(kills * monsterXp(level, 0, 0) * (1 + d.xpPct / 100) * XP_MULT);
  // Mean of goldAmount(): (4 + 2.5 L) * 1.06^L, with the uniform 0.6..1.4 roll averaging 1.
  const avgGold = (4 + level * 2.5) * Math.pow(1.06, level) * (1 + d.goldFind / 100);
  const gold = Math.round(kills * GOLD_DROP_RATE * avgGold);
  const mats: Partial<Materials> = {};
  const scrap = Math.floor(kills * SCRAP_PER_KILL);
  const dust = Math.floor(kills * DUST_PER_KILL);
  const crystal = Math.floor(kills * CRYSTAL_PER_KILL);
  if (scrap) mats.scrap = scrap;
  if (dust) mats.dust = dust;
  if (crystal) mats.crystal = crystal;

  const res = addXp(save, xp);
  save.gold += gold;
  for (const [k, v] of Object.entries(mats)) save.materials[k as keyof Materials] += v ?? 0;
  save.stats.kills += kills;

  return { ms: Math.round(away), xp, gold, kills, mats, zone: save.lastZone, levels: res.levels + res.paragons };
}
