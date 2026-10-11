// F-SAV-03 / F-OPS-04: scheduled restore drills, logical-corruption detection, off-device mirror, privacy ledger in aux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCharacter } from '../../shared/src/character';
import { createCharacterBackup, verifyCharacterBackup } from '../src/backups';
import { createAuxBackup, verifyAuxBackup } from '../src/backupAux';
import { appendDrillLog, drillBackup, mirrorBackup, readDrillLog } from '../src/backupDrill';
import { startCharacterBackups } from '../src/backupSchedule';
import { ensureDataDir, flushSaves, saveCharacter } from '../src/persistence';

assert.ok(process.env.DATA_DIR, 'Backup drill checks require an isolated DATA_DIR');
ensureDataDir();
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function seeded(n = 3) {
  for (let i = 0; i < n; i++) {
    const c = createCharacter(`Drill${i}x${Math.floor(Math.random() * 1e5)}`, (['warrior', 'ranger', 'mage'] as const)[i % 3], 100 + i);
    c.gold = 1000 + i;
    await saveCharacter(c);
  }
  await flushSaves();
}

test('a drill restores every character, loads it like the server and times it', async () => {
  await seeded(3);
  const root = await fs.mkdtemp(path.join(process.env.DATA_DIR!, '..', 'drill-root-'));
  const backup = await createCharacterBackup(root);
  const result = await drillBackup(backup.directory);
  assert.ok(result.ok, JSON.stringify(result.problems));
  assert.equal(result.characters, backup.characters);
  assert.ok(result.items > 0 && result.ms >= 0);
  const log = path.join(root, '..', `${path.basename(root)}-drills.jsonl`);
  await appendDrillLog(log, result);
  assert.deepEqual((await readDrillLog(log)).map(r => r.backup), [path.basename(backup.directory)]);
});

test('a backup whose checksums match but whose content cannot load fails the drill (logical corruption)', async () => {
  await seeded(1);
  const root = await fs.mkdtemp(path.join(process.env.DATA_DIR!, '..', 'drill-bad-'));
  const backup = await createCharacterBackup(root);
  // Simulate a bug that wrote bad data before the backup: rewrite one file AND its manifest checksum.
  const manifestFile = path.join(backup.directory, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  const victim = manifest.files[0];
  const broken = Buffer.from(JSON.stringify({ name: 42, classId: 'nobody' }));
  await fs.writeFile(path.join(backup.directory, 'characters', `${victim.id}.json`), broken);
  victim.bytes = broken.length; victim.sha256 = sha(broken);
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  await verifyCharacterBackup(backup.directory); // checksums alone say "fine"
  const result = await drillBackup(backup.directory);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(p => p.startsWith(`${victim.id}:`)), JSON.stringify(result.problems));
  assert.ok(!JSON.stringify(result).includes('nobody'), 'problems never quote character contents');

  // A damaged byte after capture is caught by the restore step itself.
  const backup2 = await createCharacterBackup(root);
  const m2 = JSON.parse(await fs.readFile(path.join(backup2.directory, 'manifest.json'), 'utf8'));
  await fs.appendFile(path.join(backup2.directory, 'characters', `${m2.files[0].id}.json`), ' ');
  const r2 = await drillBackup(backup2.directory);
  assert.equal(r2.ok, false);
  assert.match(r2.problems[0], /^restore: .*checksum/);
});

test('the mirror copy is verified in its own directory and rotated there', async () => {
  await seeded(2);
  const base = await fs.mkdtemp(path.join(process.env.DATA_DIR!, '..', 'drill-mirror-'));
  const root = path.join(base, 'local'), mirror = path.join(base, 'offsite');
  const first = await createCharacterBackup(root);
  await new Promise(r => setTimeout(r, 5));
  const second = await createCharacterBackup(root);
  await mirrorBackup(first.directory, mirror, 1);
  const r = await mirrorBackup(second.directory, mirror, 1);
  assert.equal(r.verified, true);
  assert.deepEqual(await fs.readdir(mirror), [path.basename(second.directory)], 'keep=1 leaves only the newest copy');
  await assert.rejects(mirrorBackup(second.directory, mirror), 'never overwrites an existing copy');
});

test('aux snapshots include the privacy ledger so erasures survive a lost disk', async () => {
  const base = await fs.mkdtemp(path.join(process.env.DATA_DIR!, '..', 'drill-aux-'));
  const data = path.join(base, 'data');
  await fs.mkdir(path.join(data, 'privacy'), { recursive: true });
  await fs.writeFile(path.join(data, 'privacy', 'ledger.json'), JSON.stringify({ version: 1, pending: [], erased: [] }));
  const made = await createAuxBackup(path.join(base, 'backups'), data);
  assert.ok(made);
  assert.equal((await verifyAuxBackup(made.directory)).files, 1);
});

test('the schedule runs backup, drill and mirror in order and reports status', async () => {
  await seeded(1);
  const base = await fs.mkdtemp(path.join(process.env.DATA_DIR!, '..', 'drill-sched-'));
  const root = path.join(base, 'backups'), mirror = path.join(base, 'mirror');
  let saved = 0;
  const drillLog = path.join(base, 'ops', 'drills.jsonl');
  const schedule = startCharacterBackups(root, () => { saved++; }, 3, { mirror, drillLog });
  await schedule.run();
  await schedule.stop();
  const status = schedule.status();
  assert.equal(saved, 1);
  assert.ok(status.lastBackup && status.lastDrill?.ok && status.lastMirror?.ok, JSON.stringify(status));
  assert.equal((await readDrillLog(drillLog)).length, 1);
  assert.ok((await fs.readdir(root)).every(n => n.startsWith('backup-') || n.startsWith('aux-')), 'nothing but backups in the backup root');
  assert.equal((await fs.readdir(mirror)).filter(n => n.startsWith('backup-')).length, 1);
});
