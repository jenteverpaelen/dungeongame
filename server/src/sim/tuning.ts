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
export const GOBLIN_FIELD_CHANCE = 0.02;
export const GOBLIN_RIFT_CHANCE = 0.25;
/** Treasure goblins: escape this long after first noticing a player. */
export const GOBLIN_ESCAPE_MS = 25000;
/** Goblins use only ELITE_HP_MULT[5] (×9) × this, not def.hp, which would double count. */
export const GOBLIN_HP_MULT = 1.2;

/** Rifts: number of packs placed (spread over the map) and the fraction of monsters needed for 100%. */
export const RIFT_PACKS = 34;
export const RIFT_KILL_FRACTION = 0.85;

/** Field respawns are placed out of every player's view but preferably close to the action. */
export const RESPAWN_MIN_DIST = 1250;
export const RESPAWN_PREF_DIST = 2600;

/** Extra monster life per extra nearby player (D3: +50% per player, max party of 4). */
export const HP_PER_EXTRA_PLAYER = 0.5;

/** Health globe heal fraction and radius. */
export const GLOBE_HEAL = 0.2;
export const GLOBE_RADIUS = 260;

/** Rift guardian: ability timers. */
export const BOSS_RING_MS = 6000;
export const BOSS_ADDS_MS = 12000;
export const BOSS_RING_COUNT = 16;
