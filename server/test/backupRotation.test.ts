import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR } from '../src/config';
import { createCharacter } from '../../shared/src/character';
import { ensureDataDir, saveCharacter } from '../src/persistence';
import { createCharacterBackup, restoreCharacterBackup, rotateCharacterBackups, verifyCharacterBackup } from '../src/backups';
import { parseBackupKeep } from '../src/backupPolicy';
import { startCharacterBackups } from '../src/backupSchedule';

assert.ok(process.env.DATA_DIR, 'Rotation tests require an explicit isolated DATA_DIR');
ensureDataDir();
const lab = await fs.realpath(await fs.mkdtemp(path.join(DATA_DIR, 'rotation-tests-')));
const fresh = () => fs.mkdtemp(path.join(lab, 'case-'));
const readManifest = async (b: string) => JSON.parse(await fs.readFile(path.join(b, 'manifest.json'), 'utf8'));
const writeManifest = (b: string, m: unknown) => fs.writeFile(path.join(b, 'manifest.json'), JSON.stringify(m));
const name = () => `backup-2026-10-09T00-00-00-000Z-${randomUUID()}`;
const c = createCharacter('RotationFixture', 'mage', 41);
await saveCharacter(c);

test('retention is disabled by default and rejects ambiguous or unsafe counts', async () => {
  for (const value of [undefined, '', '0']) assert.equal(parseBackupKeep(value), 0);
  assert.equal(parseBackupKeep('2'), 2);
  for (const value of ['-1', '1.5', '1e2', 'Infinity', 'NaN', ' 2', '02', '9007199254740992']) assert.throws(() => parseBackupKeep(value));
  assert.deepEqual(await rotateCharacterBackups('absent', 'absent', 0, true), { keep: [], remove: [], excluded: [], removed: [] });
  for (const count of [-1, NaN, Infinity, .5]) await assert.rejects(rotateCharacterBackups('absent', 'absent', count));
});

test('read-only plan changes no bytes; rotation retains the anchor and newest eligible backup with restorable items', async () => {
  const root = await fresh(), bundles: string[] = [];
  for (const gold of [1, 2, 3]) {
    c.gold = gold; await saveCharacter(c);
    const b = (await createCharacterBackup(root)).directory;
    const m = await readManifest(b); m.createdAt = `2026-10-0${gold}T00:00:00.000Z`; await writeManifest(b, m);
    bundles.push(b);
  }
  const before = await Promise.all(bundles.map(b => fs.readFile(path.join(b, 'characters', c.id + '.json'))));
  const plan = await rotateCharacterBackups(root, bundles[2], 2);
  assert.deepEqual(plan.keep, [bundles[2], bundles[1]]); assert.deepEqual(plan.remove, [bundles[0]]); assert.deepEqual(plan.removed, []);
  assert.deepEqual(await Promise.all(bundles.map(b => fs.readFile(path.join(b, 'characters', c.id + '.json')))), before);
  const applied = await rotateCharacterBackups(root, bundles[2], 2, true);
  assert.deepEqual(applied.removed, [bundles[0]]); await assert.rejects(fs.stat(bundles[0]), { code: 'ENOENT' });
  for (const [i, b] of bundles.entries()) if (i > 0) {
    await verifyCharacterBackup(b);
    const restored = await restoreCharacterBackup(b, path.join(lab, 'restored-' + randomUUID()));
    assert.deepEqual(await fs.readFile(path.join(restored.directory, c.id + '.json')), before[i]);
  }
});

test('legacy, foreign, corrupt, incomplete, unknown, future and missing-character histories are all preserved', async () => {
  const root = await fresh(), source = (await createCharacterBackup(root)).directory;
  const clones = new Map<string, string>();
  for (const kind of ['legacy', 'foreign', 'corrupt', 'incomplete', 'unknown', 'future', 'missing', 'extra']) {
    const b = path.join(root, name()); await fs.cp(source, b, { recursive: true }); clones.set(kind, b);
    const m = await readManifest(b);
    if (kind === 'legacy') delete m.source;
    if (kind === 'foreign') m.source = '0'.repeat(64);
    if (kind === 'unknown') m.version = 99;
    if (kind === 'future') m.createdAt = '2099-01-01T00:00:00.000Z';
    if (kind === 'missing') {
      const file = m.files.find((f: { id: string }) => f.id === c.id); file.id = 'missingcharacter';
      await fs.rename(path.join(b, 'characters', c.id + '.json'), path.join(b, 'characters', file.id + '.json'));
    }
    await writeManifest(b, m);
    if (kind === 'corrupt') await fs.appendFile(path.join(b, 'characters', c.id + '.json'), ' ');
    if (kind === 'incomplete') await fs.writeFile(path.join(b, '.hearthfall-backup-incomplete'), 'keep');
    if (kind === 'extra') await fs.writeFile(path.join(b, 'owner-note'), 'keep');
  }
  const outside = await fresh(), sentinel = path.join(outside, 'keep'); await fs.writeFile(sentinel, 'untouched');
  const link = path.join(root, name()); await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  await fs.writeFile(path.join(root, 'unrelated.txt'), 'untouched');
  const names = (await fs.readdir(root)).sort();
  const result = await rotateCharacterBackups(root, source, 1, true);
  assert.deepEqual(result.keep, [source]); assert.deepEqual(result.remove, []); assert.equal(result.excluded.length, 10);
  assert.equal(result.excluded.find(e => e.directory === clones.get('missing'))?.reason, 'contains-missing-character');
  assert.equal(result.excluded.find(e => e.directory === clones.get('legacy'))?.reason, 'legacy-unscoped');
  assert.deepEqual((await fs.readdir(root)).sort(), names); assert.equal(await fs.readFile(sentinel, 'utf8'), 'untouched');
  await verifyCharacterBackup(source);
  const legacy = await restoreCharacterBackup(clones.get('legacy')!, path.join(lab, 'legacy-restore-' + randomUUID()));
  assert.deepEqual(await fs.readFile(path.join(legacy.directory, c.id + '.json')), await fs.readFile(path.join(source, 'characters', c.id + '.json')));
});

test('invalid, empty, unscoped, linked and outside anchors fail before any deletion', async () => {
  const root = await fresh(), b = (await createCharacterBackup(root)).directory, original = await readManifest(b);
  const outsideRoot = await fresh(), outside = (await createCharacterBackup(outsideRoot)).directory;
  await assert.rejects(rotateCharacterBackups(root, outside, 1, true), /directly inside/);
  const linkedRoot = path.join(lab, randomUUID()); await fs.symlink(root, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(rotateCharacterBackups(linkedRoot, b, 1, true), /Unexpected/);
  const link = path.join(root, name()); await fs.symlink(b, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(rotateCharacterBackups(root, link, 1, true), /Unexpected/);
  await writeManifest(b, { ...original, source: undefined });
  await assert.rejects(rotateCharacterBackups(root, b, 1, true), /source-scoped/);
  await writeManifest(b, original);
  const empty = path.join(root, name()); await fs.mkdir(empty); await fs.mkdir(path.join(empty, 'characters'));
  await writeManifest(empty, { ...original, files: [] });
  await assert.rejects(rotateCharacterBackups(root, empty, 1, true), /nonempty/);
  await fs.appendFile(path.join(b, 'characters', c.id + '.json'), ' ');
  await assert.rejects(rotateCharacterBackups(root, b, 1, true), /checksum/);
  assert.equal((await fs.readdir(root)).length, 3); await verifyCharacterBackup(outside);
});

test('deletion failure leaves every selected survivor intact and the partial candidate is preserved next time', async t => {
  const root = await fresh(), old = (await createCharacterBackup(root)).directory, current = (await createCharacterBackup(root)).directory;
  const before = await fs.readFile(path.join(current, 'characters', c.id + '.json'));
  const unlink = fs.unlink;
  const mock = t.mock.method(fs, 'unlink', async (file: Parameters<typeof fs.unlink>[0]) => {
    if (String(file) === path.join(old, 'manifest.json')) throw new Error('Synthetic rotation delete failure');
    return unlink(file);
  });
  await assert.rejects(rotateCharacterBackups(root, current, 1, true), /Synthetic/); mock.mock.restore();
  await verifyCharacterBackup(current); assert.deepEqual(await fs.readFile(path.join(current, 'characters', c.id + '.json')), before);
  const retry = await rotateCharacterBackups(root, current, 1, true);
  assert.deepEqual(retry.remove, []); assert.equal(retry.excluded[0].directory, old);
  assert.ok(await fs.stat(path.join(old, 'manifest.json')));
});

test('a survivor changing after the plan aborts before the first candidate deletion', async t => {
  const root = await fresh(), old = (await createCharacterBackup(root)).directory, current = (await createCharacterBackup(root)).directory;
  const before = await fs.readFile(path.join(old, 'characters', c.id + '.json'));
  const readFile = fs.readFile; let anchorReads = 0;
  const mock = t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]) === path.join(current, 'manifest.json') && ++anchorReads === 2) {
      await fs.appendFile(path.join(current, 'characters', c.id + '.json'), ' ');
    }
    return readFile(...args);
  });
  await assert.rejects(rotateCharacterBackups(root, current, 1, true), /checksum/);
  mock.mock.restore();
  assert.equal(anchorReads, 2); assert.deepEqual(await fs.readFile(path.join(old, 'characters', c.id + '.json')), before);
  await verifyCharacterBackup(old);
});

test('a failed new capture cannot rotate older snapshots; rotation errors do not erase backup success', async t => {
  const root = await fresh(), old = (await createCharacterBackup(root)).directory;
  const errors: unknown[][] = [], logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args); });
  t.mock.method(console, 'log', (...args: unknown[]) => { logs.push(args); });
  const failed = startCharacterBackups(root, () => { throw new Error('Synthetic live save failure'); }, 1);
  await failed.run(); await failed.stop();
  assert.deepEqual(await fs.readdir(root), [path.basename(old)]); assert.equal(logs.length, 0); assert.equal(errors.length, 1);
  const unlink = fs.unlink;
  t.mock.method(fs, 'unlink', async (file: Parameters<typeof fs.unlink>[0]) => {
    if (String(file).startsWith(old + path.sep)) throw new Error('Synthetic rotation delete failure');
    return unlink(file);
  });
  const success = startCharacterBackups(root, () => {}, 1); await success.run(); await success.stop();
  assert.match(logs.flat().join(' '), /verified/); assert.match(errors.flat().join(' '), /rotation failed; new verified backup remains/);
  for (const name of await fs.readdir(root)) await verifyCharacterBackup(path.join(root, name));
});
