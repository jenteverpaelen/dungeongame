// Additive snapshots of the server-owned data the strict character backup (backups.ts) does not cover: the account
// files and the community ledger (guilds, moderation). They live next to the character backups as `aux-<time>-<uuid>`
// directories with their own manifest and checksums, so the character backup format, its verification and its
// rotation are untouched (rotation already ignores names that are not generated character backups).
//
// Layout:  aux-<ISO>-<uuid>/manifest.json
//          aux-<ISO>-<uuid>/files/accounts/<username>.json
//          aux-<ISO>-<uuid>/files/social/ledger.json
//
// Same safety posture as backups.ts: exclusive creates, a visible "incomplete" marker until the copy has been
// re-read and checked, refusal (never recursive deletion) when anything unexpected is present.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DATA_DIR } from './config';

const INCOMPLETE = '.hearthfall-aux-incomplete';
const MAX_FILE_BYTES = 16 * 1024 * 1024;
export const AUX_NAME = /^aux-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const ACCOUNT_FILE = /^[a-z0-9_]{3,20}\.json$/;

interface AuxEntry { path: string; bytes: number; sha256: string }
interface AuxManifest { format: 'hearthfall-aux'; version: 1; createdAt: string; files: AuxEntry[] }
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const exclusiveWrite = (file: string, bytes: string | Buffer) => fs.writeFile(file, bytes, { flag: 'wx', flush: true });

async function regular(file: string, directory = false): Promise<void> {
  const stat = await fs.lstat(file);
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) throw new Error(`Unexpected backup entry: ${file}`);
}

/** Every file that belongs in an aux snapshot, as relative POSIX paths (accounts/<name>.json, social/ledger.json). */
async function sourceFiles(dataDir: string): Promise<string[]> {
  const out: string[] = [];
  const accounts = path.join(dataDir, 'accounts');
  try {
    for (const name of (await fs.readdir(accounts)).sort()) if (ACCOUNT_FILE.test(name)) out.push(`accounts/${name}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await fs.stat(path.join(dataDir, 'social', 'ledger.json'));
    out.push('social/ledger.json');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return out;
}

function parseManifest(value: unknown): AuxManifest {
  const m = value as Partial<AuxManifest> | null;
  if (!m || m.format !== 'hearthfall-aux' || m.version !== 1) throw new Error('Unsupported aux backup format/version');
  if (typeof m.createdAt !== 'string' || !Number.isFinite(Date.parse(m.createdAt)) || !Array.isArray(m.files)) throw new Error('Invalid aux manifest fields');
  const seen = new Set<string>();
  for (const f of m.files) {
    const ok = !!f && typeof f.path === 'string' && (/^accounts\/[a-z0-9_]{3,20}\.json$/.test(f.path) || f.path === 'social/ledger.json')
      && Number.isSafeInteger(f.bytes) && f.bytes >= 0 && typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/.test(f.sha256);
    if (!ok || seen.has(f.path)) throw new Error('Invalid or duplicate aux backup entry');
    seen.add(f.path);
  }
  return m as AuxManifest;
}

async function readVerified(directory: string, allowIncomplete = false): Promise<{ manifest: AuxManifest; bytes: Map<string, Buffer> }> {
  await regular(directory, true);
  const expected = ['files', 'manifest.json', ...(allowIncomplete ? [INCOMPLETE] : [])].sort();
  if (JSON.stringify((await fs.readdir(directory)).sort()) !== JSON.stringify(expected)) throw new Error('Aux backup is incomplete or has unexpected entries');
  await regular(path.join(directory, 'manifest.json'));
  const manifest = parseManifest(JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')));
  const base = path.join(directory, 'files');
  await regular(base, true);
  const bytes = new Map<string, Buffer>();
  const present: string[] = [];
  for (const group of (await fs.readdir(base)).sort()) {
    if (group !== 'accounts' && group !== 'social') throw new Error(`Unexpected aux entry: ${group}`);
    await regular(path.join(base, group), true);
    for (const name of await fs.readdir(path.join(base, group))) present.push(`${group}/${name}`);
  }
  if (JSON.stringify(present.sort()) !== JSON.stringify(manifest.files.map(f => f.path).sort())) throw new Error('Aux backup file list does not match manifest');
  for (const entry of manifest.files) {
    const file = path.join(base, ...entry.path.split('/'));
    await regular(file);
    const data = await fs.readFile(file);
    if (data.length !== entry.bytes || digest(data) !== entry.sha256) throw new Error(`Aux backup checksum mismatch: ${entry.path}`);
    bytes.set(entry.path, data);
  }
  return { manifest, bytes };
}

export async function verifyAuxBackup(directory: string): Promise<{ files: number; createdAt: string }> {
  const { manifest } = await readVerified(directory);
  return { files: manifest.files.length, createdAt: manifest.createdAt };
}

/** Copies accounts and the social ledger from `dataDir`. Returns null when there is nothing to copy. */
export async function createAuxBackup(root: string, dataDir = DATA_DIR): Promise<{ directory: string; files: number } | null> {
  const sources = await sourceFiles(dataDir);
  if (!sources.length) return null;
  await fs.mkdir(root, { recursive: true });
  const createdAt = new Date().toISOString();
  const directory = path.join(root, `aux-${createdAt.replace(/[:.]/g, '-')}-${randomUUID()}`);
  await fs.mkdir(directory);
  await exclusiveWrite(path.join(directory, INCOMPLETE), 'Incomplete aux backup; never restore this directory.\n');
  const base = path.join(directory, 'files');
  await fs.mkdir(base);
  const files: AuxEntry[] = [];
  for (const rel of sources) {
    const from = path.join(dataDir, ...rel.split('/'));
    await regular(from);
    const bytes = await fs.readFile(from);
    if (bytes.length > MAX_FILE_BYTES) throw new Error(`Refusing to back up an oversized file: ${rel}`);
    const to = path.join(base, ...rel.split('/'));
    await fs.mkdir(path.dirname(to), { recursive: true });
    await exclusiveWrite(to, bytes);
    files.push({ path: rel, bytes: bytes.length, sha256: digest(bytes) });
  }
  const manifest: AuxManifest = { format: 'hearthfall-aux', version: 1, createdAt, files };
  await exclusiveWrite(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await readVerified(directory, true);
  await fs.unlink(path.join(directory, INCOMPLETE));
  return { directory, files: files.length };
}

/** Keeps the `keepCount` newest verified aux snapshots; older ones are removed, anything unverifiable is left alone. */
export async function rotateAuxBackups(root: string, keepCount: number): Promise<{ kept: string[]; removed: string[]; excluded: string[] }> {
  const result = { kept: [] as string[], removed: [] as string[], excluded: [] as string[] };
  if (!Number.isSafeInteger(keepCount) || keepCount < 1) return result;
  const entries: { directory: string; manifest: AuxManifest }[] = [];
  for (const name of (await fs.readdir(root)).sort()) {
    if (!AUX_NAME.test(name)) continue;
    const directory = path.join(root, name);
    try { entries.push({ directory, manifest: (await readVerified(directory)).manifest }); } catch { result.excluded.push(directory); }
  }
  entries.sort((a, b) => Date.parse(b.manifest.createdAt) - Date.parse(a.manifest.createdAt) || (a.directory < b.directory ? 1 : -1));
  result.kept = entries.slice(0, keepCount).map(e => e.directory);
  for (const entry of entries.slice(keepCount)) {
    try {
      const current = await readVerified(entry.directory); // re-verified immediately before deletion
      if (JSON.stringify(current.manifest) !== JSON.stringify(entry.manifest)) throw new Error('changed');
      for (const f of entry.manifest.files) await fs.unlink(path.join(entry.directory, 'files', ...f.path.split('/')));
      for (const group of ['accounts', 'social']) await fs.rmdir(path.join(entry.directory, 'files', group)).catch(() => undefined);
      await fs.rmdir(path.join(entry.directory, 'files'));
      await fs.unlink(path.join(entry.directory, 'manifest.json'));
      await fs.rmdir(entry.directory);
      result.removed.push(entry.directory);
    } catch { result.excluded.push(entry.directory); }
  }
  return result;
}

/** Writes the snapshot into a new directory laid out like DATA_DIR (accounts/…, social/…); never overwrites. */
export async function restoreAuxBackup(backup: string, destination: string): Promise<{ directory: string; files: number }> {
  const { bytes } = await readVerified(backup);
  const directory = path.resolve(destination);
  await fs.mkdir(directory); // existing destinations are refused
  for (const [rel, data] of bytes) {
    const to = path.join(directory, ...rel.split('/'));
    await fs.mkdir(path.dirname(to), { recursive: true });
    await exclusiveWrite(to, data);
  }
  for (const [rel, data] of bytes) {
    if (!data.equals(await fs.readFile(path.join(directory, ...rel.split('/'))))) throw new Error(`Restore verification failed: ${rel}`);
  }
  return { directory, files: bytes.size };
}
