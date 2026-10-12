// Balance knobs of the simulation (feel decisions live here; formulas and item/skill data live in shared/).

/** Monster windups are lengthened so attacks read and can be dodged with WASD / dash. */
export const WINDUP_MULT = 1.3;
export const MIN_WINDUP_MS = 320;
/** Melee attacks land if the target is still within reach + this slack when the windup ends. */
export const MELEE_SLACK = 14;
/** Monsters wake up when a player comes this close (or when hit). */
export const AGGRO_RANGE = 520;
export const LEASH_RANGE = 1600;
/** Packs alerted together: waking one monster wakes pack mates within this distance. */
export const PACK_ALERT_RANGE = 420;
/** Monsters beyond this distance from every player stop thinking (dormant). */
export const DORMANT_RANGE = 1500;

/** Player out-of-combat regeneration: after this long without taking damage, regenerate pct of life per second. */
export const OOC_REGEN_DELAY_MS = 5000;
export const OOC_REGEN_PCT = 0.04;
export const RESPAWN_MS = 5000;

/** Fury decays 3/s after this long without hitting. */
export const FURY_DECAY_DELAY_MS = 4000;

/** Champion / rare / goblin chances per pack (fields + rifts). */
export const CHAMPION_CHANCE = 0.18;
export const RARE_CHANCE = 0.1;
export const GOBLIN_FIELD_CHANCE = 0.012;
export const GOBLIN_RIFT_CHANCE = 0.25;
/** Treasure goblins: escape this long after first noticing a player. */
export const GOBLIN_ESCAPE_MS = 25000;
/** Goblins use only ELITE_HP_MULT[5] (×9) × this, not def.hp, which would double count. */
export const GOBLIN_HP_MULT = 2;

/** Damage per hit by elite tier (normal, champion, rare, minion, boss, goblin). Before 2026-10-12 elites only had more
 *  life, so a champion pack (3–4 monsters) hurt less than a trash pack (6–14) and could be stood in on Story [M,
 *  `sim.ts threat`]. Rare ×1.5: PoE's hidden rare-monster "50% more damage" [SN, poewiki Soul Conduit monster
 *  modifier table; flagged there as needing citations]; D3 rare leaders hit harder than their minions [SN, Diablo wiki].
 *  Champion ×1.25 [P]: between PoE magic monsters (−20% damage, +20% speed) and the rare. Minions keep trash damage.
 *  Full up to level 45, fading out by 60 like LEVEL_DAMAGE: the endgame keeps its tuning until the Ordeal re-fit. */
export const ELITE_DMG_MULT = [1, 1.25, 1.5, 1, 1, 1] as const;
export function eliteDamageMult(tier: number, level: number): number {
  const fade = Math.min(1, Math.max(0, (60 - level) / 15));
  return 1 + ((ELITE_DMG_MULT[tier] ?? 1) - 1) * fade;
}

/** Champions and rares get this on top of ELITE_HP_MULT so elites take a few seconds even for AoE builds.
 *  Ramped in over the first levels (fresh characters only have their primary attack). */
export const ELITE_TOUGHNESS = 2.5;
export const ELITE_TOUGHNESS_FULL_LEVEL = 15;
/** Factor at level 1. 0.85 since 2026-10-12: champions and rares now hit harder (ELITE_DMG_MULT), so the first elites are
 *  shorter, more dangerous fights; it also restores the margin on the owner's L1–4 champion time-to-kill target (4.8 s),
 *  which the game before met only on lucky seeds (median of 9 seeds 4.9 s) [M]. */
export const ELITE_TOUGHNESS_START = 0.85;
export function eliteToughness(level: number): number {
  return ELITE_TOUGHNESS_START + (ELITE_TOUGHNESS - ELITE_TOUGHNESS_START) * Math.min(1, Math.max(0, level - 1) / (ELITE_TOUGHNESS_FULL_LEVEL - 1));
}

/** Level toughness: weapon damage and main stats outgrow the base life curve (`monsterHp`, ×1.123 per level) by
 *  ~×1.2 per level, so an at-level character one-shot every ordinary monster from level ~10 on (measured in
 *  docs/rework/BALANCE.md). Monster life is multiplied by this per-level factor so that a character wearing
 *  level-appropriate rares needs about the same time to kill ordinary monsters at every level.
 *  Anchors are *calibrated*, not designed: `npx tsx server/test/sim.ts calibrate` reproduces them. Re-run after
 *  any change to item, skill or class scaling. Between anchors the factor is interpolated in log space. */
export const LEVEL_TOUGHNESS: readonly (readonly [level: number, factor: number])[] = [
  [1, 1], [3, 1.5], [5, 2.5], [8, 2.5], [10, 5], [13, 8], [15, 9], [18, 12], [20, 15], [25, 30], [30, 40], [35, 55],
  [40, 80], [45, 120], [50, 150], [60, 250], [70, 350],
];
/** Calibration harnesses substitute the factor; production code never touches this. */
export const tuningOverrides: {
  levelToughness: ((level: number) => number) | null;
  levelDamage: ((level: number) => number) | null;
} = { levelToughness: null, levelDamage: null };
export function levelToughness(level: number, table = LEVEL_TOUGHNESS): number {
  if (tuningOverrides.levelToughness) return tuningOverrides.levelToughness(level);
  return interpolateLog(level, table);
}

/** Monster damage per hit is multiplied by this per-level factor. 2026-10-10 it was cut to ×0.4–0.5 so the longer fights
 *  `levelToughness` creates would not multiply the damage taken per kill; the owner then found that levelling characters
 *  could stand in any pack on Story (2026-10-12). Measured with `sim.ts threat` (stand still beside one pack, auto attacks
 *  only, organic gear): at ×0.4–0.5 a Story champion pack cost 4–25 % of life; at ×1 at levels 1–5 it costs 40–75 % for
 *  the warrior and ranger, while the ranger and mage still lost under 15 % from level 10 (they clear elites in 4–5 s),
 *  hence ×1.2 for 20–35. Chosen over 9 seeds of the levelling bot (`scripts/bot-metrics.ts run`, 120 min): damage taken
 *  ×1.5–5, the level reached after two hours unchanged (warrior 26→27, ranger 28→27, mage 26→26); a bot that never
 *  dodges now dies 2–34 times an hour in the early bands. Levels 1–3 a little gentler for brand-new characters [M].
 *  Levels 60–70 stay at ×0.5 until the Ordeal ladder re-fit (endgame lane). */
export const LEVEL_DAMAGE: readonly (readonly [level: number, factor: number])[] = [[1, 0.6], [4, 0.8], [10, 1], [20, 1.2], [35, 1.2], [45, 1], [60, 0.5], [70, 0.5]];
export function levelDamage(level: number, table = LEVEL_DAMAGE): number {
  if (tuningOverrides.levelDamage) return tuningOverrides.levelDamage(level);
  return interpolateLog(level, table);
}
export function interpolateLog(level: number, table: readonly (readonly [number, number])[]): number {
  if (level <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [l1, f1] = table[i];
    if (level <= l1) {
      const [l0, f0] = table[i - 1];
      return Math.exp(Math.log(f0) + (Math.log(f1) - Math.log(f0)) * (level - l0) / (l1 - l0));
    }
  }
  return table[table.length - 1][1];
}

/** Rifts: number of packs placed (spread over the map) and the fraction of monsters needed for 100%. */
export const RIFT_PACKS = 60;
export const RIFT_KILL_FRACTION = 0.85;

/** Field respawns are placed out of every player's view but preferably close to the action. */
export const RESPAWN_MIN_DIST = 1250;
export const RESPAWN_PREF_DIST = 2600;
/** Fields keep at least this many live packs within FIELD_NEAR_DIST of every player. */
export const FIELD_NEAR_PACKS = 7;
export const FIELD_NEAR_DIST = 2200;
/** ...of which at least this many inside the player's view. */
export const FIELD_VISIBLE_PACKS = 2;
export const FIELD_VISIBLE_DIST = 1150;

/** Extra monster life per extra nearby player (D3: +50% per player, max party of 4). */
export const HP_PER_EXTRA_PLAYER = 0.5;

/** Health globe heal fraction and radius. */
export const GLOBE_HEAL = 0.2;
export const GLOBE_RADIUS = 260;

/** Rift guardian: ability timers. */
export const BOSS_RING_MS = 6000;
export const BOSS_ADDS_MS = 12000;
export const BOSS_RING_COUNT = 16;
