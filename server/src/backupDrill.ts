// Restore drill (roadmap P3 acceptance 5 "a backup restore drill is documented and timed", P16 "drills tested"):
// restore a verified backup into a scratch directory exactly as an operator would, then load every character the
// way the server does (parse, version check, migration) and compare custody signatures before/after. A backup whose
// checksums match but whose content would not load (logical corruption written by a bug) fails the drill.
//
// Mirror: an optional second copy of every verified backup in another directory (a second disk, a NAS share or a
// folder a free sync client already uploads). Copied file by file with exclusive creates, then verified there.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { restoreCharacterBackup, rotateCharacterBackups, verifyCharacterBackup } from './backups';
import { restoreAuxBackup, rotateAuxBackups, verifyAuxBackup } from './backupAux';
import { normalizeSave, UnsupportedSaveVersionError } from './persistence';
import { custodySummary } from './saveIntegrity';
import { DATA_DIR } from './config';
import type { CharacterSave } from '../../shared/src/types';

export interface DrillResult {
  at: string; backup: string; ok: boolean; characters: number; items: number; ms: number;
  /** Per-character problems (id: reason); never character contents. */
  problems: string[];
  aux?: { backup: string; ok: boolean; files: number; problem?: string };
}

/** Default drill log: DATA_DIR/ops/backup-drills.jsonl (never inside the backup root, whose entries are all backups). */
export const DEFAULT_DRILL_LOG = path.join(DATA_DIR, 'ops', 'backup-drills.jsonl');
const DRILL_LOG_MAX_BYTES = 512 * 1024;

/** Restores `backup` (and optionally an aux snapshot) into a scratch directory, loads everything, times it, cleans up. */
export async function drillBackup(backup: string, opts: { aux?: string; scratchRoot?: string; now?: () => number } = {}): Promise<DrillResult> {
  const now = opts.now ?? Date.now;
  const started = performance.now();
  const result: DrillResult = { at: new Date(now()).toISOString(), backup: path.basename(backup), ok: false, characters: 0, items: 0, ms: 0, problems: [] };
  const scratch = await fs.mkdtemp(path.join(opts.scratchRoot ?? os.tmpdir(), 'hearthfall-drill-'));
  try {
    const restored = path.join(scratch, 'characters');
    try { await restoreCharacterBackup(backup, restored); }
    catch (error) { result.problems.push(`restore: ${error instanceof Error ? error.message : String(error)}`); return result; }
    for (const file of (await fs.readdir(restored)).filter(f => f.endsWith('.json')).sort()) {
      const id = file.slice(0, -5);
      result.characters++;
      try {
        const parsed = JSON.parse(await fs.readFile(path.join(restored, file), 'utf8')) as CharacterSave;
        if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') throw new Error('not a character');
        parsed.id = id;
        const before = custodySummary(parsed);
        const loaded = normalizeSave(structuredClone(parsed));
        const after = custodySummary(loaded);
        result.items += after.items;
        if (after.sha256 !== before.sha256) result.problems.push(`${id}: items or currencies changed while loading`);
      } catch (error) {
        result.problems.push(`${id}: ${error instanceof UnsupportedSaveVersionError ? 'needs a newer server' : error instanceof SyntaxError ? 'invalid JSON' : 'invalid character data'}`);
      }
    }
    if (opts.aux) {
      const aux = { backup: path.basename(opts.aux), ok: false, files: 0 } as NonNullable<DrillResult['aux']>;
      try {
        const r = await restoreAuxBackup(opts.aux, path.join(scratch, 'aux'));
        aux.files = r.files;
        for (const group of ['accounts', 'social', 'privacy']) {
          let names: string[] = [];
          try { names = await fs.readdir(path.join(scratch, 'aux', group)); } catch { continue; }
          for (const name of names) JSON.parse(await fs.readFile(path.join(scratch, 'aux', group, name), 'utf8'));
        }
        aux.ok = true;
      } catch (error) { aux.problem = error instanceof Error ? error.message : String(error); }
      result.aux = aux;
    }
    result.ok = result.problems.length === 0 && (!result.aux || result.aux.ok);
    return result;
  } finally {
    result.ms = Math.round(performance.now() - started);
    // Only the directory this function created (mkdtemp) is removed.
    await fs.rm(scratch, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Appends one line per drill; keeps the newest half when the file grows past 512 KB. */
export async function appendDrillLog(file: string, result: DrillResult): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(result) + '\n');
  const { size } = await fs.stat(file);
  if (size > DRILL_LOG_MAX_BYTES) {
    const lines = (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean);
    await fs.writeFile(file, lines.slice(-Math.floor(lines.length / 2)).join('\n') + '\n');
  }
}

export async function readDrillLog(file: string, limit = 20): Promise<DrillResult[]> {
  try { return (await fs.readFile(file, 'utf8')).split('\n').filter(Boolean).slice(-limit).map(l => JSON.parse(l) as DrillResult); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

async function copyTree(from: string, to: string): Promise<void> {
  await fs.mkdir(to);
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to mirror a link: ${a}`);
    if (entry.isDirectory()) await copyTree(a, b);
    else if (entry.isFile()) await fs.copyFile(a, b, fs.constants.COPYFILE_EXCL);
  }
}

/** Copies a verified backup (character `backup-*` or `aux-*`) into `mirrorRoot`, verifies the copy, rotates there. */
export async function mirrorBackup(source: string, mirrorRoot: string, keepCount = 0): Promise<{ directory: string; verified: boolean; removed: number }> {
  const aux = path.basename(source).startsWith('aux-');
  if (aux) await verifyAuxBackup(source); else await verifyCharacterBackup(source);
  await fs.mkdir(mirrorRoot, { recursive: true });
  const directory = path.join(mirrorRoot, path.basename(source));
  await copyTree(source, directory);
  if (aux) await verifyAuxBackup(directory); else await verifyCharacterBackup(directory);
  let removed = 0;
  if (keepCount > 0) {
    removed = aux ? (await rotateAuxBackups(mirrorRoot, keepCount)).removed.length
      : (await rotateCharacterBackups(mirrorRoot, directory, keepCount, true)).removed.length;
  }
  return { directory, verified: true, removed };
}
