import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { snapshotCharacters } from './persistence';
import { INCOMPLETE_RESTORE, validCharacterId } from './storage/characterStore';

const INCOMPLETE_BACKUP = '.hearthfall-backup-incomplete';
interface BackupEntry { id: string; bytes: number; sha256: string }
interface BackupManifest { format: 'hearthfall-characters'; version: 1; createdAt: string; files: BackupEntry[] }
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
  const manifest: BackupManifest = { format:'hearthfall-characters', version:1, createdAt, files };
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
