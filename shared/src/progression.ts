// Leveling (1-70), Paragon (infinite), difficulty tiers and monster scaling.

import { MAX_LEVEL } from './constants';
import { SKILL_SLOTS, skillsForClass } from './data/skills';
import type { CharacterSave, ParagonCategory, StatId } from './types';

/** XP to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(120 * Math.pow(level, 2.6) + 300 * level);
}

/** XP for the first paragon levels is similar to the last regular level, then grows linearly (D3 2.0 behaviour). */
export function paragonXpToNext(p: number): number {
  return Math.round(7_500_000 * (1 + 0.04 * p));
}

export const ELITE_XP_MULT = [1, 4, 6, 1.5, 40, 8];

/** Kill XP is scaled by this on top of the designed curve. The shipped curve levelled a bot from 1 to 70 in about
 *  an hour (and a player in a Master rift +17 levels in five minutes); see docs/rework/BALANCE.md for the
 *  measurements and the reference points this was set against. Story awards are unaffected (see `storyXp`). */
export const KILL_XP_SCALE = 0.2;

export function monsterXp(level: number, eliteTier: number, difficulty: number): number {
  return Math.round(KILL_XP_SCALE * (12 * Math.pow(level, 1.7) + 10) * (ELITE_XP_MULT[eliteTier] ?? 1) * (1 + DIFFICULTIES[difficulty].xpBonus / 100));
}

/** Base monster life at a level, before monster type, elite and difficulty multipliers. */
export function monsterHp(level: number): number {
  return 10 * Math.pow(1.123, level - 1);
}

export function monsterDmg(level: number): number {
  return 6 * Math.pow(1.15, level - 1);
}

export const ELITE_HP_MULT = [1, 4, 6, 1.3, 70, 9];

// ─────────────────────────── Difficulty (D3 Normal → Torment) ───────────────────────────

export interface Difficulty {
  name: string;
  hp: number;
  dmg: number;
  xpBonus: number;      // %
  goldBonus: number;    // %
  legendaryBonus: number; // multiplier applied by the drop roller via ctx.difficulty
  minLevel: number;
}

const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const DIFFICULTIES: Difficulty[] = [
  { name: 'Normal', hp: 1, dmg: 1, xpBonus: 0, goldBonus: 0, legendaryBonus: 0, minLevel: 1 },
  { name: 'Hard', hp: 2, dmg: 1.3, xpBonus: 75, goldBonus: 75, legendaryBonus: 0, minLevel: 1 },
  { name: 'Expert', hp: 4, dmg: 1.7, xpBonus: 150, goldBonus: 150, legendaryBonus: 0, minLevel: 1 },
  { name: 'Master', hp: 8, dmg: 2.2, xpBonus: 250, goldBonus: 250, legendaryBonus: 0, minLevel: 1 },
  ...roman.map((r, i) => ({
    name: `Torment ${r}`,
    hp: 16 * Math.pow(2, i),
    dmg: 2.8 * Math.pow(1.3, i),
    xpBonus: 400 + 250 * i,
    goldBonus: 400 + 250 * i,
    legendaryBonus: i + 1,
    minLevel: 60,
  })),
];

// ─────────────────────────── Paragon 2.0 ───────────────────────────

export interface ParagonStatDef {
  id: string;
  category: ParagonCategory;
  label: string;
  stat: StatId | 'main';
  perPoint: number;
  cap: number; // 0 = uncapped
  fmt: (v: number) => string;
}

const pct = (v: number) => `+${(Math.round(v * 10) / 10).toFixed(1)}%`;
const num = (v: number) => `+${Math.round(v)}`;

export const PARAGON_STATS: ParagonStatDef[] = [
  { id: 'p_main', category: 'core', label: 'Primary Stat', stat: 'main', perPoint: 5, cap: 0, fmt: num },
  { id: 'p_vit', category: 'core', label: 'Vitality', stat: 'vit', perPoint: 5, cap: 0, fmt: num },
  { id: 'p_ms', category: 'core', label: 'Movement Speed', stat: 'ms', perPoint: 0.5, cap: 50, fmt: pct },
  { id: 'p_res', category: 'core', label: 'Maximum Resource', stat: 'maxResource', perPoint: 0.5, cap: 50, fmt: num },
  { id: 'p_ias', category: 'offense', label: 'Attack Speed', stat: 'ias', perPoint: 0.2, cap: 50, fmt: pct },
  { id: 'p_cdr', category: 'offense', label: 'Cooldown Reduction', stat: 'cdr', perPoint: 0.2, cap: 50, fmt: pct },
  { id: 'p_chc', category: 'offense', label: 'Critical Hit Chance', stat: 'chc', perPoint: 0.1, cap: 50, fmt: pct },
  { id: 'p_chd', category: 'offense', label: 'Critical Hit Damage', stat: 'chd', perPoint: 1, cap: 50, fmt: pct },
  { id: 'p_life', category: 'defense', label: 'Life', stat: 'lifePct', perPoint: 0.5, cap: 50, fmt: pct },
  { id: 'p_armor', category: 'defense', label: 'Armor', stat: 'armor', perPoint: 0.5, cap: 50, fmt: pct },
  { id: 'p_allres', category: 'defense', label: 'All Resistance', stat: 'allRes', perPoint: 5, cap: 50, fmt: num },
  { id: 'p_regen', category: 'defense', label: 'Life Regeneration', stat: 'lifeRegen', perPoint: 0.1, cap: 50, fmt: (v) => `${pct(v)} of Life/s` },
  { id: 'p_area', category: 'utility', label: 'Area Damage', stat: 'area', perPoint: 1, cap: 50, fmt: pct },
  { id: 'p_rcr', category: 'utility', label: 'Resource Cost Reduction', stat: 'rcr', perPoint: 0.2, cap: 50, fmt: pct },
  { id: 'p_loh', category: 'utility', label: 'Life on Hit', stat: 'lifePerHit', perPoint: 0.02, cap: 50, fmt: (v) => `${pct(v)} of Life` },
  { id: 'p_gf', category: 'utility', label: 'Gold Find', stat: 'goldFind', perPoint: 1, cap: 50, fmt: pct },
];

export const PARAGON_CATEGORIES: { id: ParagonCategory; label: string; color: string }[] = [
  { id: 'core', label: 'Core', color: '#e8c070' },
  { id: 'offense', label: 'Offense', color: '#e05a3a' },
  { id: 'defense', label: 'Defense', color: '#4aa3df' },
  { id: 'utility', label: 'Utility', color: '#5fbf6a' },
];

/** D3 2.0: paragon levels hand out points in rotation Core → Offense → Defense → Utility.
 *  Once 800 points are reached every further point goes to Core (only uncapped stats remain). */
export function paragonPoints(level: number): Record<ParagonCategory, number> {
  const out: Record<ParagonCategory, number> = { core: 0, offense: 0, defense: 0, utility: 0 };
  const rotation = Math.min(level, 800);
  const order: ParagonCategory[] = ['core', 'offense', 'defense', 'utility'];
  for (let i = 0; i < rotation; i++) out[order[i % 4]]++;
  out.core += Math.max(0, level - 800);
  return out;
}

export function paragonSpent(save: CharacterSave, cat: ParagonCategory): number {
  let n = 0;
  for (const d of PARAGON_STATS) if (d.category === cat) n += save.paragon.spent[d.id] ?? 0;
  return n;
}

// ─────────────────────────── XP application ───────────────────────────

export interface XpResult { levels: number; paragons: number }

export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1);
}

/** Adds experience and handles level-ups and paragon level-ups (mutates save). */
export function addXp(save: CharacterSave, amount: number): XpResult {
  const res: XpResult = { levels: 0, paragons: 0 };
  let xp = amount;
  while (xp > 0 && save.level < MAX_LEVEL) {
    const need = xpToNext(save.level) - save.xp;
    if (xp >= need) {
      xp -= need;
      save.level++;
      save.xp = 0;
      save.skillPoints += 1;
      res.levels++;
    } else {
      save.xp += xp;
      xp = 0;
    }
  }
  if (res.levels) autoSlotSkills(save);
  if (save.level >= MAX_LEVEL && xp > 0) {
    save.xp = 0;
    let px = save.paragon.xp + xp;
    while (px >= paragonXpToNext(save.paragon.level)) {
      px -= paragonXpToNext(save.paragon.level);
      save.paragon.level++;
      res.paragons++;
    }
    save.paragon.xp = px;
  }
  return res;
}

/** Diablo 3-style: newly unlocked skills drop into empty auto-cast slots (players can rearrange later). */
export function autoSlotSkills(save: CharacterSave): boolean {
  let changed = false;
  const slots = save.skills.slots;
  while (slots.length < SKILL_SLOTS) slots.push(null);
  for (const s of skillsForClass(save.classId)) {
    if (s.kind === 'primary' || s.unlock > save.level || slots.includes(s.id)) continue;
    const free = slots.indexOf(null);
    if (free < 0) break;
    slots[free] = s.id;
    changed = true;
  }
  return changed;
}
