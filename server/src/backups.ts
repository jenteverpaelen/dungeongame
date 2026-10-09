import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { snapshotCharacters } from './persistence';
import { INCOMPLETE_RESTORE, validCharacterId } from './storage/characterStore';
import { DATA_DIR } from './config';

const INCOMPLETE_BACKUP = '.hearthfall-backup-incomplete';
interface BackupEntry { id: string; bytes: number; sha256: string }
interface BackupManifest { format: 'hearthfall-characters'; version: 1; createdAt: string; source?: string; files: BackupEntry[] }
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const exclusiveWrite = (file: string, bytes: string | Buffer) => fs.writeFile(file, bytes, { flag: 'wx', flush: true });

async function regular(file: string, directory = false): Promise<void> {
  const stat = await fs.lstat(file);
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) throw new Error(`Unexpected backup entry: ${file}`);
}
function parseManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup manifest');
  const m = value as Partial<BackupManifest>;
  if (m.format !== 'hearthfall-characters' || m.version !== 1) throw new Error('Unsupported backup format/version');
  if (typeof m.createdAt !== 'string' || !Number.isFinite(Date.parse(m.createdAt)) || !Array.isArray(m.files)) throw new Error('Invalid backup manifest fields');
  if (m.source !== undefined && (typeof m.source !== 'string' || !/^[a-f0-9]{64}$/.test(m.source))) throw new Error('Invalid backup source');
  const ids = new Set<string>();
  for (const entry of m.files) {
    if (!entry || !validCharacterId(entry.id) || ids.has(entry.id) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid or duplicate backup entry');
    ids.add(entry.id);
  }
  return m as BackupManifest;
}

async function readVerified(directory: string, allowIncomplete = false) {
  await regular(directory, true);
  const expectedRoot = ['characters', 'manifest.json', ...(allowIncomplete ? [INCOMPLETE_BACKUP] : [])].sort();
  const rootEntries = (await fs.readdir(directory)).sort();
  if (JSON.stringify(rootEntries) !== JSON.stringify(expectedRoot)) throw new Error('Backup is incomplete or has unexpected entries');
  const manifestPath = path.join(directory, 'manifest.json');
  await regular(manifestPath);
  const manifest = parseManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
  const characterDir = path.join(directory, 'characters');
  await regular(characterDir, true);
  const actual = (await fs.readdir(characterDir)).sort();
  const expected = manifest.files.map(f=>`${f.id}.json`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Backup character file list does not match manifest');
  const snapshots = new Map<string, Buffer>();
  for (const entry of manifest.files) {
    const file = path.join(characterDir, `${entry.id}.json`);
    await regular(file);
    const bytes = await fs.readFile(file);
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error(`Backup checksum mismatch: ${entry.id}`);
    snapshots.set(entry.id, bytes);
  }
  return { manifest, snapshots };
}

export async function verifyCharacterBackup(directory: string): Promise<{ characters: number; createdAt: string }> {
  const { manifest } = await readVerified(directory);
  return { characters: manifest.files.length, createdAt: manifest.createdAt };
}

/** Caller saves live sessions first. Captures through this process's persistence queues. */
export async function createCharacterBackup(root: string): Promise<{ directory: string; characters: number }> {
  const snapshots = await snapshotCharacters();
  const sourcePath = await fs.realpath(DATA_DIR);
  const source = digest(Buffer.from(JSON.stringify(['hearthfall-backup-source-v1', hostname().toLowerCase(),
    process.platform === 'win32' ? sourcePath.toLowerCase() : sourcePath])));
  await fs.mkdir(root, { recursive: true });
  const createdAt = new Date().toISOString();
  const directory = path.join(root, `backup-${createdAt.replace(/[:.]/g,'-')}-${randomUUID()}`);
  await fs.mkdir(directory); // No replacement, even on a name collision.
  await exclusiveWrite(path.join(directory, INCOMPLETE_BACKUP), 'Incomplete backup; never restore this directory.\n');
  const characterDir = path.join(directory, 'characters');
  await fs.mkdir(characterDir);
  const files: BackupEntry[] = [];
  for (const [id, bytes] of snapshots) {
    await exclusiveWrite(path.join(characterDir, `${id}.json`), bytes);
    files.push({ id, bytes:bytes.length, sha256:digest(bytes) });
  }
  const manifest: BackupManifest = { format:'hearthfall-characters', version:1, createdAt, source, files };
  await exclusiveWrite(path.join(directory, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
  await readVerified(directory, true);
  await fs.unlink(path.join(directory, INCOMPLETE_BACKUP));
  return { directory, characters:files.length };
}

/** Never activates or overwrites a save directory. Incomplete output stays marked. */
export async function restoreCharacterBackup(backup: string, destination: string): Promise<{ directory: string; characters: number }> {
  const { snapshots } = await readVerified(backup);
  const directory = path.resolve(destination);
  await fs.mkdir(directory); // Existing destinations, including empty ones, are refused.
  const marker = path.join(directory, INCOMPLETE_RESTORE);
  await exclusiveWrite(marker, 'Incomplete restore; do not start the server with this directory.\n');
  for (const [id, bytes] of snapshots) await exclusiveWrite(path.join(directory, `${id}.json`), bytes);
  for (const [id, bytes] of snapshots) {
    const restored = await fs.readFile(path.join(directory, `${id}.json`));
    if (!bytes.equals(restored)) throw new Error(`Restore verification failed: ${id}`);
  }
  await fs.unlink(marker);
  return { directory, characters:snapshots.size };
}

interface RotationEntry { directory: string; manifest: BackupManifest }
export interface BackupRotation {
  keep: string[];
  remove: string[];
  excluded: { directory: string; reason: string }[];
  removed: string[];
}
const backupName = /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const pathKey = (p: string) => process.platform === 'win32' ? p.toLowerCase() : p;
async function directBackupChild(root: string, directory: string): Promise<string> {
  await regular(directory, true);
  const resolved = await fs.realpath(directory);
  if (pathKey(path.dirname(resolved)) !== pathKey(root) || !backupName.test(path.basename(resolved))) {
    throw new Error('Rotation requires a generated backup directly inside its root');
  }
  return resolved;
}

/** One trusted writer owns the root. Default is read-only; the scheduler opts in after a verified capture. */
export async function rotateCharacterBackups(root: string, newest: string, keepCount: number, apply = false): Promise<BackupRotation> {
  if (!Number.isSafeInteger(keepCount) || keepCount < 0) throw new Error('Invalid backup retention count');
  const result: BackupRotation = { keep: [], remove: [], excluded: [], removed: [] };
  if (keepCount === 0) return result;
  await regular(root, true);
  const canonicalRoot = await fs.realpath(root);
  const anchor = await directBackupChild(canonicalRoot, newest);
  const { manifest } = await readVerified(anchor);
  if (!manifest.source || !manifest.files.length) throw new Error('Rotation needs a source-scoped nonempty verified backup');
  const ids = new Set(manifest.files.map(f => f.id));
  const eligible: RotationEntry[] = [];
  for (const name of (await fs.readdir(canonicalRoot)).sort()) {
    const directory = path.join(canonicalRoot, name);
    if (pathKey(directory) === pathKey(anchor)) continue;
    let reason = '';
    try {
      await directBackupChild(canonicalRoot, directory);
      const older = (await readVerified(directory)).manifest;
      if (!older.source) reason = 'legacy-unscoped';
      else if (older.source !== manifest.source) reason = 'different-source';
      else if (Date.parse(older.createdAt) > Date.parse(manifest.createdAt)) reason = 'later-than-new-backup';
      else if (older.files.some(f => !ids.has(f.id))) reason = 'contains-missing-character';
      else eligible.push({ directory, manifest: older });
    } catch { reason = 'unrecognized-or-unverified'; }
    if (reason) result.excluded.push({ directory, reason });
  }
  eligible.sort((a, b) => Date.parse(b.manifest.createdAt) - Date.parse(a.manifest.createdAt)
    || (a.directory < b.directory ? -1 : a.directory > b.directory ? 1 : 0));
  const survivors = [{ directory: anchor, manifest }, ...eligible.slice(0, keepCount - 1)];
  const candidates = eligible.slice(keepCount - 1);
  result.keep = survivors.map(e => e.directory); result.remove = candidates.map(e => e.directory);
  if (!apply || !candidates.length) return result;
  const reverify = async (entry: RotationEntry) => {
    await regular(root, true);
    if (pathKey(await fs.realpath(root)) !== pathKey(canonicalRoot)) throw new Error('Backup root changed during rotation');
    await directBackupChild(canonicalRoot, entry.directory);
    const current = await readVerified(entry.directory);
    if (JSON.stringify(current.manifest) !== JSON.stringify(entry.manifest)) throw new Error('Backup changed during rotation');
  };
  // Refuse the entire deletion phase if any recovery point selected to survive has changed.
  for (const entry of survivors) await reverify(entry);
  for (const entry of candidates) {
    await reverify(entry);
    const characters = path.join(entry.directory, 'characters');
    for (const file of entry.manifest.files) {
      await regular(characters, true);
      if (pathKey(await fs.realpath(characters)) !== pathKey(characters)) throw new Error('Backup character directory changed during rotation');
      const target = path.join(characters, `${file.id}.json`);
      await regular(target);
      await fs.unlink(target);
    }
    await fs.rmdir(characters);
    const manifestFile = path.join(entry.directory, 'manifest.json');
    await regular(manifestFile); await fs.unlink(manifestFile);
    await fs.rmdir(entry.directory); // Unexpected new entries cause refusal, never recursive deletion.
    result.removed.push(entry.directory);
  }
  return result;
}
