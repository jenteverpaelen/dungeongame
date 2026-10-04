// Server configuration (environment driven).
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 2567);
/** Dev multiplier on monster XP (prototype default 3). */
export const XP_MULT = Number(process.env.XP_MULT ?? 3) || 3;
export const ROOT_DIR = path.resolve(here, '..', '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'server', 'data', 'characters');
export const CLIENT_DIR = path.join(ROOT_DIR, 'dist', 'client');

export const AUTOSAVE_MS = 30_000;
export const EMPTY_RIFT_DESTROY_MS = 60_000;
export const RIFT_PORTAL_MS = 60_000;
export const RESPAWN_MS = 5_000;
export const LOOT_TTL_MS = 90_000;
export const AGGRO_RANGE = 520;
export const LEASH_RANGE = 1600;
export const XP_SHARE_RANGE = 1400;
export const MAX_NAME = 16;
