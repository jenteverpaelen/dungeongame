// Simulation & world constants shared by server and client.

export const TICK_RATE = 20; // authoritative server ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const DT = 1 / TICK_RATE;

/** World units per map tile. Characters are ~64 units tall. */
export const TILE = 64;

/** Entities inside this half-extent rectangle around a player are replicated to them. */
export const AOI_HALF_W = 1150;
export const AOI_HALF_H = 760;

/** Client renders remote entities this far in the past to interpolate between snapshots. */
export const INTERP_DELAY_MS = 110;

export const MAX_LEVEL = 70;
export const PLAYER_RADIUS = 16;
export const BASE_MOVE_SPEED = 250; // units / second

export const DASH = {
  distance: 230,
  durationMs: 170,
  cooldownMs: 2800,
  invulnMs: 220,
} as const;

/** Gold and materials fly to the player inside this radius (D3 pickup radius analogue). */
export const MAGNET_RADIUS = 110;
/** Items are picked up when the player walks within this radius. */
export const ITEM_PICKUP_RADIUS = 46;

export const INVENTORY_COLS = 10;
export const INVENTORY_ROWS = 6;
export const INVENTORY_SIZE = INVENTORY_COLS * INVENTORY_ROWS;

/** Combat engagement: auto-attack acquires targets inside weapon range + this buffer. */
export const ACQUIRE_BUFFER = 40;

/** Offline (AFK) progression cap, Legends of Idleon style. */
export const AFK_MAX_HOURS = 12;
export const AFK_EFFICIENCY = 0.25; // fraction of active kill rate earned while offline

/** Channel capacities (MapleStory-style channels). */
export const TOWN_CHANNEL_CAP = 100;
export const FIELD_CHANNEL_CAP = 30;
export const PARTY_MAX = 4;
