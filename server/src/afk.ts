// Idleon-style offline gains (ARCHITECTURE §1.10), v2 (F-MET-02). A character that logged out in a field keeps
// fighting at AFK_EFFICIENCY of an active kill rate for up to AFK_MAX_HOURS:
//   * the rate is the character's own measured field kill rate (last session with ≥ RATE_MIN_FIELD_MINUTES in fields),
//     never above the measured engaged-bot median for its level band (shared/src/data/afkRates.ts) — Idleon bases AFK
//     gains on the character's active rate [K]; without an own measurement the old 60 kills/min assumption is used,
//     again capped by the band median;
//   * per kill it earns what an ordinary (trash) kill earns under the live rules on Normal: monster XP, the trash gold
//     drop (NORMAL_GOLD_DROP_CHANCE × baseGoldAmount), and its expected equipment drops as if salvaged (drop chance,
//     field factors, rarity weights and salvage yields from shared/src/items.ts / cube.ts). Legendary / set finds,
//     gems, globes and elites only happen in play.
// Deterministic (no randomness; fractions are dropped), capped, per character: nothing an alt does changes another
// character's gains, and splitting an absence into several logins never earns more than one long absence.

import { XP_MULT } from './config';
import { economySnapshot, recordEconomy } from '../../shared/src/economy';
import { AFK_EFFICIENCY, AFK_MAX_HOURS } from '../../shared/src/constants';
import { AFK_BAND_KPM } from '../../shared/src/data/afkRates';
import { ZONES } from '../../shared/src/data/zones';
import { EQUIPMENT_DROP_SCALE, FIELD_DROP_FACTOR, NORMAL_GOLD_DROP_CHANCE, baseGoldAmount } from '../../shared/src/items';
import { clamp } from '../../shared/src/math';
import { addXp, monsterXp } from '../../shared/src/progression';
import { computeStats } from '../../shared/src/stats';
import type { S2C } from '../../shared/src/protocol';
import type { CharacterSave, Materials } from '../../shared/src/types';

export type AfkReport = Omit<Extract<S2C, { t: 'afk' }>, 't'>;

/** Absences must be strictly longer than this threshold to count. */
export const AFK_MIN_AWAY_MS = 2 * 60_000;
const AFK_MAX_AWAY_MS = AFK_MAX_HOURS * 3_600_000;
/** The previous fixed assumption (ARCHITECTURE §1.10); used only for characters without an own measured rate. */
export const LEGACY_KILLS_PER_MINUTE = 60;
/** [P] Minimum field time in one session before its kill rate becomes the character's own rate. */
export const RATE_MIN_FIELD_MINUTES = 5;
/** Ordinary-kill equipment drop chance before scaling (shared/src/items.ts rollDrops, elite 0, Normal). */
const TRASH_ITEM_CHANCE = 0.075;
/** Legendary / set share of ordinary drops before magic find (rollRarity); offline finds exclude it. */
const TRASH_LEGENDARY_SHARE = 0.012;

/** Measured engaged-bot kills/min for a level (the band containing it; the last band beyond the table). */
export function bandKillsPerMinute(level: number): number {
  let kpm = AFK_BAND_KPM[0][1];
  for (const [from, k] of AFK_BAND_KPM) if (level >= from) kpm = k;
  return kpm;
}

/** Active kill rate used offline and where it came from. */
export function afkRate(save: Pick<CharacterSave, 'afk' | 'level'>): { rate: number; basis: 'own' | 'assumed'; bandCap: number } {
  const bandCap = bandKillsPerMinute(save.level);
  const own = save.afk?.rate;
  if (typeof own === 'number' && Number.isFinite(own) && own >= 0) return { rate: Math.min(own, bandCap), basis: 'own', bandCap };
  return { rate: Math.min(LEGACY_KILLS_PER_MINUTE, bandCap), basis: 'assumed', bandCap };
}

/** Expected salvage materials per ordinary kill at a monster level (live drop, rarity and salvage rules). */
export function salvagePerKill(level: number): { scrap: number; dust: number; crystal: number } {
  const items = TRASH_ITEM_CHANCE * EQUIPMENT_DROP_SCALE * FIELD_DROP_FACTOR * (1 - TRASH_LEGENDARY_SHARE);
  const n = Math.max(8, 48 - level * 0.6), mg = 36, r = 10 + level * 0.25, sum = n + mg + r;
  const pN = n / sum, pM = mg / sum, pR = r / sum;
  return {
    scrap: items * pN * (1 + Math.floor(level / 25)),
    dust: items * (pM * (1 + Math.floor(level / 25)) + pR),
    crystal: items * pR * (1 + Math.floor(level / 30)),
  };
}

/**
 * Applies the offline gains to the save (xp, levels, gold, materials, kill stats) and returns the report that is
 * sent to the client, or null when the character was not AFK-farming a field. Call this once per login, before
 * the save's lastZone / lastSeen are overwritten.
 */
export function applyAfkGains(save: CharacterSave, now: number): AfkReport | null {
  const elapsed = now - save.lastSeen;
  const away = Math.min(elapsed, AFK_MAX_AWAY_MS);
  if (!(away > AFK_MIN_AWAY_MS)) return null;
  const zone = ZONES[save.lastZone];
  if (!zone || zone.kind !== 'field') return null;

  const minutes = away / 60_000;
  const { rate, basis } = afkRate(save);
  if (Math.floor(minutes * rate * AFK_EFFICIENCY) <= 0) return null;

  // Minute by minute, so levels gained while away raise the monsters' level (and their XP, gold and salvage) exactly as
  // they would have. Fractions carry over between minutes and are dropped only at the end, so splitting an absence into
  // several logins never adds up to more than one long absence.
  const d = computeStats(save);
  const before = economySnapshot(save);
  let killsF = 0, kills = 0, xpF = 0, xp = 0, goldF = 0, levels = 0;
  const matsF = { scrap: 0, dust: 0, crystal: 0 };
  for (let done = 0; done < minutes; done = Math.min(minutes, done + 1)) {
    const step = Math.min(1, minutes - done);
    killsF += step * rate * AFK_EFFICIENCY;
    const k = Math.floor(killsF) - kills;
    if (k <= 0) continue;
    kills += k;
    // Monsters in a field level with the player, clamped to the zone's band.
    const level = clamp(save.level, zone.levelBand[0], zone.levelBand[1]);
    xpF += k * monsterXp(level, 0, 0) * (1 + d.xpPct / 100) * XP_MULT;
    // Mean of goldAmount(): baseGoldAmount × the uniform 0.6..1.4 roll (mean 1) × gold find.
    goldF += k * NORMAL_GOLD_DROP_CHANCE * baseGoldAmount(level) * (1 + d.goldFind / 100);
    const per = salvagePerKill(level);
    for (const m of ['scrap', 'dust', 'crystal'] as const) matsF[m] += k * per[m];
    const gain = Math.floor(xpF) - xp;
    if (gain > 0) { const r = addXp(save, gain); levels += r.levels + r.paragons; xp += gain; }
  }
  const gold = Math.floor(goldF);
  const mats: Partial<Materials> = {};
  for (const m of ['scrap', 'dust', 'crystal'] as const) { const n = Math.floor(matsF[m]); if (n) mats[m] = n; }
  save.gold += gold;
  for (const [k, v] of Object.entries(mats)) save.materials[k as keyof Materials] += v ?? 0;
  save.stats.kills += kills;
  recordEconomy(save,'offline',before,now);

  return { ms: Math.round(away), xp, gold, kills, mats, zone: save.lastZone, levels,
    rate: Math.round(rate * 10) / 10, basis, efficiency: AFK_EFFICIENCY, capped: elapsed > AFK_MAX_AWAY_MS };
}

/**
 * Measures a character's own active kill rate in fields during one session (sampled once per second by the session).
 * Town, rifts and dungeons do not count; time spent dead in a field does (it is part of the real rate).
 */
export class FieldRateMeter {
  private fieldMs = 0;
  private fieldKills = 0;
  private lastT = 0;
  private lastKills = -1;
  sample(now: number, inField: boolean, kills: number) {
    if (this.lastKills >= 0 && inField && now > this.lastT) {
      this.fieldMs += Math.min(5_000, now - this.lastT); // a stalled loop never counts as a long fight
      this.fieldKills += Math.max(0, kills - this.lastKills);
    }
    this.lastT = now; this.lastKills = kills;
  }
  /** Writes the session's rate to the save once it has enough field time (kills per minute, one decimal). */
  record(save: CharacterSave, now: number): boolean {
    if (this.fieldMs < RATE_MIN_FIELD_MINUTES * 60_000) return false;
    save.afk = { rate: Math.round((this.fieldKills / (this.fieldMs / 60_000)) * 10) / 10, level: save.level, at: now };
    return true;
  }
}

/** Load-time validation of the optional measured rate (absent or invalid → no own rate). */
export function normalizeAfkRate(save: CharacterSave) {
  const a = save.afk as unknown as Record<string, unknown> | undefined;
  if (a === undefined) return;
  const ok = !!a && typeof a === 'object' && typeof a.rate === 'number' && Number.isFinite(a.rate) && a.rate >= 0 && a.rate <= 10_000
    && typeof a.level === 'number' && Number.isInteger(a.level) && typeof a.at === 'number' && Number.isFinite(a.at);
  if (!ok) delete save.afk;
}
