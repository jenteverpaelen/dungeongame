// Server configuration (environment driven).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseBackupKeep } from './backupPolicy';

const here = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT ?? 2567);
/** Multiplier on monster XP. 1 is the designed pace (the prototype shipped 3, which levelled a bot to 70 in ~20 min). */
export const XP_MULT = Number(process.env.XP_MULT ?? 1) || 1;
export const ROOT_DIR = path.resolve(here, '..', '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'server', 'data', 'characters');
/** Opt in to verified local backups; retention/off-device copies are operator policy. */
export const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : undefined;
export const BACKUP_KEEP = parseBackupKeep(process.env.BACKUP_KEEP);
if (BACKUP_KEEP > 0 && !BACKUP_DIR) throw new Error('BACKUP_KEEP requires an explicit BACKUP_DIR');
export const CLIENT_DIR = path.join(ROOT_DIR, 'dist', 'client');

/**
 * Accounts: `off` keeps name-only login (today's default); `optional` lets players register and protects any character
 * that is linked to an account; `required` demands an account for every login. In `required` mode characters that no
 * account owns yet stay closed unless ALLOW_LEGACY_LOGIN=1 (a migration window while the owner links them).
 */
const accountEnv = (process.env.ACCOUNTS ?? 'off').toLowerCase();
export const ACCOUNT_MODE: 'off' | 'optional' | 'required' = accountEnv === 'required' ? 'required' : accountEnv === 'optional' || accountEnv === '1' ? 'optional' : 'off';
export const ALLOW_LEGACY_LOGIN = process.env.ALLOW_LEGACY_LOGIN === '1';

export const AUTOSAVE_MS = 30_000;
export const EMPTY_RIFT_DESTROY_MS = 60_000;
export const RIFT_PORTAL_MS = 60_000;
export const RESPAWN_MS = 5_000;
export const LOOT_TTL_MS = 90_000;
export const AGGRO_RANGE = 520;
export const LEASH_RANGE = 1600;
export const XP_SHARE_RANGE = 1400;
export const MAX_NAME = 16;
