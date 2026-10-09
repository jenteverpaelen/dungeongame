import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createCharacter } from '../../shared/src/character';
import { DATA_DIR } from '../src/config';
import { ensureDataDir, saveCharacter, loadCharacter, snapshotCharacters, flushSaves, CorruptCharacterError } from '../src/persistence';
import { JsonCharacterStore } from '../src/storage/jsonCharacterStore';
import { INCOMPLETE_RESTORE } from '../src/storage/characterStore';
import { createCharacterBackup, restoreCharacterBackup, verifyCharacterBackup } from '../src/backups';
import { startCharacterBackups, BACKUP_INTERVAL_MS } from '../src/backupSchedule';

assert.ok(process.env.DATA_DIR, 'Backup tests require an isolated DATA_DIR');
ensureDataDir();
const lab = path.join(DATA_DIR, 'backup-tests');
await fs.mkdir(lab);
const fresh = () => fs.mkdtemp(path.join(lab, 'case-'));
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
const fault = () => new Error('Synthetic backup storage failure');

test('raw backup/restore retains items, progression, unknown fields and unsupported future bytes', async () => {
  const c = createCharacter('BackupRoundtrip', 'mage', 41);
  c.gold = 123; c.xp = 987; c.stash[0] = structuredClone(c.inventory.find(Boolean) ?? Object.values(c.equipment).find(Boolean) ?? null);
  await saveCharacter(c);
  const future = Buffer.from('{"version":999,"name":"FutureBytes","unknown":{"items":[1,2,3]}}\r\n');
  await fs.writeFile(path.join(DATA_DIR, 'futurebytes.json'), future);
  const before = await snapshotCharacters();
  const dir = await fresh(), backup = await createCharacterBackup(dir);
  assert.equal((await verifyCharacterBackup(backup.directory)).characters, before.size);
  const restored = await restoreCharacterBackup(backup.directory, path.join(dir, 'restored'));
  for (const [id, bytes] of before) assert.deepEqual(await fs.readFile(path.join(restored.directory, `${id}.json`)), bytes);
  assert.equal(restored.characters, before.size);
  new JsonCharacterStore(restored.directory).ensure();
  assert.deepEqual(await fs.readFile(path.join(restored.directory, 'futurebytes.json')), future);
});

test('snapshot cut orders prior reads/writes and later operations across overlapping barriers', { timeout: 5000 }, async t => {
  const c = createCharacter('BarrierOrder', 'warrior', 42);
  c.gold = 1;
  const priorWrite = saveCharacter(c), priorRead = loadCharacter(c.id);
  const entered = deferred(), release = deferred();
  const original = JsonCharacterStore.prototype.snapshot;
  let calls = 0;
  t.mock.method(JsonCharacterStore.prototype, 'snapshot', async function (this: JsonCharacterStore) {
    if (++calls === 1) { entered.resolve(); await release.promise; }
    return original.call(this);
  });
  const first = snapshotCharacters();
  await entered.promise;
  await priorWrite;
  assert.equal((await priorRead)!.gold, 1);
  c.gold = 2;
  let laterSettled = false;
  const laterWrite = saveCharacter(c).then(() => { laterSettled = true; });
  const laterRead = loadCharacter(c.id), second = snapshotCharacters();
  await nextTurn();
  assert.equal(laterSettled, false);
  release.resolve();
  assert.equal(JSON.parse((await first).get(c.id)!.toString()).gold, 1);
  assert.equal(JSON.parse((await second).get(c.id)!.toString()).gold, 2);
  await laterWrite;
  assert.equal((await laterRead)!.gold, 2);
});

test('snapshot failure releases the barrier, while unresolved progress prevents stale backup', { timeout: 5000 }, async t => {
  const c = createCharacter('BarrierFail', 'ranger', 43);
  await saveCharacter(c);
  const snapshotMock = t.mock.method(JsonCharacterStore.prototype, 'snapshot', async () => { throw fault(); });
  const rejection = assert.rejects(snapshotCharacters(), /Synthetic/);
  c.gold = 77; const after = saveCharacter(c);
  await Promise.all([rejection, after]);
  snapshotMock.mock.restore();
  const writeMock = t.mock.method(JsonCharacterStore.prototype, 'write', async () => { throw fault(); });
  try {
    c.gold = 88;
    await assert.rejects(saveCharacter(c));
    const dir = await fresh();
    await assert.rejects(createCharacterBackup(dir), /progress is unsaved/);
    assert.deepEqual(await fs.readdir(dir), []);
  } finally { writeMock.mock.restore(); await flushSaves(); }
  assert.equal((await loadCharacter(c.id))!.gold, 88);
});

test('invalid bundles fail before creating a restore destination', async t => {
  const dir = await fresh(), source = await createCharacterBackup(dir);
  const cases: [string, (bundle: string) => Promise<void>][] = [
    ['changed bytes', async b => { await fs.appendFile(path.join(b, 'characters', 'futurebytes.json'), ' '); }],
    ['missing file', async b => { await fs.unlink(path.join(b, 'characters', 'futurebytes.json')); }],
    ['extra file', async b => { await fs.writeFile(path.join(b, 'characters', 'extra.json'), '{}'); }],
    ['extra root entry', async b => { await fs.writeFile(path.join(b, 'unexpected'), ''); }],
    ['directory in place of file', async b => { const f = path.join(b, 'characters', 'futurebytes.json'); await fs.unlink(f); await fs.mkdir(f); }],
    ...(['duplicate', 'traversal', 'version', 'size'] as const).map(kind => [kind, async (b: string) => {
      const file = path.join(b, 'manifest.json'), m = JSON.parse(await fs.readFile(file, 'utf8'));
      if (kind === 'duplicate') m.files.push(m.files[0]);
      if (kind === 'traversal') m.files[0].id = '../outside';
      if (kind === 'version') m.version = 2;
      if (kind === 'size') m.files[0].bytes = -1;
      await fs.writeFile(file, JSON.stringify(m));
    }] as [string, (b: string) => Promise<void>]),
  ];
  for (const [name, change] of cases) await t.test(name, async () => {
    const caseDir = await fresh(), bundle = path.join(caseDir, 'bundle'), dest = path.join(caseDir, 'restore');
    await fs.cp(source.directory, bundle, { recursive: true });
    await change(bundle);
    await assert.rejects(verifyCharacterBackup(bundle));
    await assert.rejects(restoreCharacterBackup(bundle, dest));
    await assert.rejects(fs.stat(dest), { code: 'ENOENT' });
  });
});

test('existing empty/occupied restore destinations are untouched and linked bundles refused', async () => {
  const dir = await fresh(), backup = await createCharacterBackup(dir);
  for (const occupied of [false, true]) {
    const dest = path.join(dir, occupied ? 'occupied' : 'empty');
    await fs.mkdir(dest);
    if (occupied) await fs.writeFile(path.join(dest, 'owner-data'), 'keep');
    await assert.rejects(restoreCharacterBackup(backup.directory, dest), { code: 'EEXIST' });
    assert.deepEqual(await fs.readdir(dest), occupied ? ['owner-data'] : []);
    if (occupied) assert.equal(await fs.readFile(path.join(dest, 'owner-data'), 'utf8'), 'keep');
  }
  const link = path.join(dir, 'linked-backup');
  await fs.symlink(backup.directory, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(verifyCharacterBackup(link), /Unexpected backup entry/);
});

test('failed backup remains invalid; partial restore remains marked and cannot start', async t => {
  const dir = await fresh(), good = await createCharacterBackup(dir), failedRoot = path.join(dir, 'failed');
  const original = fs.writeFile;
  const mock = t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    const file = String(args[0]);
    if (file.startsWith(failedRoot) && file.endsWith('.json')) throw fault();
    return original(...args);
  });
  await assert.rejects(createCharacterBackup(failedRoot), /Synthetic/);
  mock.mock.restore();
  const failedBundle = path.join(failedRoot, (await fs.readdir(failedRoot))[0]);
  await assert.rejects(verifyCharacterBackup(failedBundle), /incomplete/);
  const dest = path.join(dir, 'partial');
  let writes = 0;
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).startsWith(dest) && String(args[0]).endsWith('.json') && ++writes === 2) throw fault();
    return original(...args);
  });
  await assert.rejects(restoreCharacterBackup(good.directory, dest), /Synthetic/);
  assert.ok((await fs.readdir(dest)).includes(INCOMPLETE_RESTORE));
  assert.throws(() => new JsonCharacterStore(dest).ensure(), /incomplete restore/);
});

test('snapshot refuses unexpected save entries and failed quarantine never claims a move', async t => {
  const dir = await fresh(), store = new JsonCharacterStore(dir);
  await fs.mkdir(path.join(dir, 'directory.json'));
  await assert.rejects(store.snapshot(), /unexpected character entry/);
  const file = path.join(DATA_DIR, 'quarantinefail.json');
  await fs.writeFile(file, '{broken');
  t.mock.method(JsonCharacterStore.prototype, 'quarantine', async () => { throw fault(); });
  const lines: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { lines.push(args); });
  await assert.rejects(loadCharacter('quarantinefail'), CorruptCharacterError);
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
  assert.match(lines.flat().join(' '), /could not quarantine/);
  assert.doesNotMatch(lines.flat().join(' '), /moved to/);
});

test('schedule captures live progress, coalesces requests, waits on stop and disables later runs', async t => {
  const dir = await fresh(), c = createCharacter('ScheduledSave', 'mage', 44);
  const entered = deferred(), release = deferred(), original = JsonCharacterStore.prototype.snapshot;
  t.mock.method(JsonCharacterStore.prototype, 'snapshot', async function (this: JsonCharacterStore) {
    entered.resolve(); await release.promise; return original.call(this);
  });
  let liveSaves = 0;
  const schedule = startCharacterBackups(dir, () => { liveSaves++; c.gold = 321; void saveCharacter(c); });
  await entered.promise;
  const first = schedule.run();
  assert.equal(schedule.run(), first);
  let stopped = false;
  const stop = schedule.stop().then(() => { stopped = true; });
  await nextTurn(); assert.equal(stopped, false);
  release.resolve(); await stop;
  await schedule.run();
  assert.equal(liveSaves, 1);
  const bundle = path.join(dir, (await fs.readdir(dir))[0]);
  assert.equal(JSON.parse(await fs.readFile(path.join(bundle, 'characters', c.id + '.json'), 'utf8')).gold, 321);
});

test('daily schedule retries after failure without claiming a completed backup', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const dir = await fresh(), errors: unknown[][] = [], logs: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args); });
  t.mock.method(console, 'log', (...args: unknown[]) => { logs.push(args); });
  let calls = 0;
  const schedule = startCharacterBackups(dir, () => { if (++calls === 1) throw fault(); });
  await schedule.run();
  assert.equal(errors.length, 1); assert.equal(logs.length, 0);
  t.mock.timers.tick(BACKUP_INTERVAL_MS);
  await schedule.run();
  assert.equal(calls, 2); assert.equal(logs.length, 1);
  await schedule.stop();
  t.mock.timers.tick(BACKUP_INTERVAL_MS);
  assert.equal(calls, 2);
});
