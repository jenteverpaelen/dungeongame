import { autoSlotSkills } from '../../shared/src/progression';
// Character persistence: one JSON file per character in DATA_DIR (server/data/characters/<id>.json).
// Writes are atomic (temp file + rename) and serialised per character, so a load that follows a logout
// always observes the latest save. Nothing here blocks the tick loop except the one-off startup mkdir.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './config';
import { INVENTORY_SIZE, MAX_LEVEL } from '../../shared/src/constants';
import { CLASSES } from '../../shared/src/data/classes';
import { ZONES } from '../../shared/src/data/zones';
import type { CharacterSave } from '../../shared/src/types';

export const NAME_RE = /^[A-Za-z0-9]{2,16}$/;
const ID_RE = /^[a-z0-9]{2,16}$/;

/** Characters are identified case-insensitively by name. */
export function characterId(name: string): string {
  return name.toLowerCase();
}

export function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fileFor(id: string): string {
  if (!ID_RE.test(id)) throw new Error(`invalid character id "${id}"`);
  return path.join(DATA_DIR, `${id}.json`);
}

/** In-flight writes per character id (the tail of a promise chain). */
const chains = new Map<string, Promise<void>>();
let tmpCounter = 0;

async function writeAtomic(id: string, json: string): Promise<void> {
  const file = fileFor(id);
  const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
  try {
    await fsp.writeFile(tmp, json);
    await fsp.rename(tmp, file);
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

/** Persist a character. The JSON snapshot is taken synchronously; the write happens asynchronously. */
export function saveCharacter(save: CharacterSave): Promise<void> {
  save.lastSeen = Date.now();
  const id = save.id;
  const json = JSON.stringify(save);
  const prev = chains.get(id) ?? Promise.resolve();
  const next: Promise<void> = prev
    .then(() => writeAtomic(id, json))
    .catch((err) => { console.error(`[persist] failed to save ${id}:`, err); })
    .finally(() => { if (chains.get(id) === next) chains.delete(id); });
  chains.set(id, next);
  return next;
}

/** Resolves when every queued write has hit the disk. */
export async function flushSaves(): Promise<void> {
  while (chains.size) await Promise.all([...chains.values()]);
}

export class CorruptCharacterError extends Error {}

/** Load a character or return null if it does not exist. A corrupt file is moved aside and reported. */
export async function loadCharacter(id: string): Promise<CharacterSave | null> {
  const file = fileFor(id);
  const pending = chains.get(id);
  if (pending) await pending;
  let text: string;
  try {
    text = await fsp.readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  try {
    const parsed = JSON.parse(text) as CharacterSave;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string' || !CLASSES[parsed.classId]) throw new Error('not a character');
    parsed.id = id;
    return normalizeSave(parsed);
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    await fsp.rename(file, backup).catch(() => undefined);
    console.error(`[persist] ${id}.json is corrupt (${(err as Error).message}); moved to ${path.basename(backup)}`);
    throw new CorruptCharacterError(`character ${id} is corrupt`);
  }
}

const num = (v: unknown, d: number, lo = 0, hi = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

/** Repair saves written by older builds (missing fields, wrong array lengths). Mutates and returns the save. */
export function normalizeSave(save: CharacterSave): CharacterSave {
  save.level = Math.floor(num(save.level, 1, 1, MAX_LEVEL));
  if (save.skills?.slots) autoSlotSkills(save);
  save.xp = num(save.xp, 0);
  save.gold = Math.floor(num(save.gold, 0));
  save.skillPoints = Math.floor(num(save.skillPoints, 0));
  save.difficulty = Math.floor(num(save.difficulty, 0, 0, 13));
  save.lastSeen = num(save.lastSeen, Date.now());
  if (!ZONES[save.lastZone]) save.lastZone = 'hearthmere';

  const m = (save.materials ??= { scrap: 0, dust: 0, crystal: 0, soul: 0, deathsBreath: 0 });
  for (const k of ['scrap', 'dust', 'crystal', 'soul', 'deathsBreath'] as const) m[k] = Math.floor(num(m[k], 0));
  save.gems ??= {};
  save.equipment ??= {};

  if (!Array.isArray(save.inventory)) save.inventory = [];
  save.inventory = save.inventory.map((i) => (i && typeof i === 'object' ? i : null));
  while (save.inventory.length < INVENTORY_SIZE) save.inventory.push(null);

  const sk = (save.skills ??= { slots: [null, null, null, null], runes: {}, tiers: {}, primary: CLASSES[save.classId].primary });
  if (!Array.isArray(sk.slots)) sk.slots = [];
  while (sk.slots.length < 4) sk.slots.push(null);
  sk.slots.length = 4;
  sk.runes ??= {};
  sk.tiers ??= {};
  sk.primary ||= CLASSES[save.classId].primary;

  const p = (save.paragon ??= { level: 0, xp: 0, spent: {} });
  p.level = Math.floor(num(p.level, 0));
  p.xp = num(p.xp, 0);
  p.spent ??= {};

  const c = (save.cube ??= { level: 1, xp: 0, learned: [], equipped: [null, null, null] });
  c.level = Math.floor(num(c.level, 1, 1));
  c.xp = num(c.xp, 0);
  if (!Array.isArray(c.learned)) c.learned = [];
  if (!Array.isArray(c.equipped)) c.equipped = [];
  while (c.equipped.length < 3) c.equipped.push(null);
  c.equipped.length = 3;

  const st = (save.stats ??= { kills: 0, elites: 0, legendaries: 0, rifts: 0, playMs: 0, deaths: 0 });
  for (const k of ['kills', 'elites', 'legendaries', 'rifts', 'playMs', 'deaths'] as const) st[k] = num(st[k], 0);
  return save;
}
