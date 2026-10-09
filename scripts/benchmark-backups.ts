// Local synthetic measurement only; never imported by the game or given real saves.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createCharacter } from '../shared/src/character';
import { generateItem } from '../shared/src/items';
import { CLASS_IDS } from '../shared/src/data/classes';
import { INVENTORY_SIZE, STASH_SIZE, MAX_LEVEL } from '../shared/src/constants';
import { Rng } from '../shared/src/math';
import type { CharacterSave, Rarity } from '../shared/src/types';

const filename = fileURLToPath(import.meta.url);
const marker = 'Synthetic backup measurement only.\n';
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const rounded = (value: number) => Math.round(value * 1000) / 1000;
const sizes = [3, 100, 1000];

async function observe<T>(action: () => Promise<T>) {
  const histogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  await pause(25);
  histogram.reset();
  const baselineRssBytes = process.memoryUsage().rss;
  let sampledPeakRssBytes = baselineRssBytes;
  const sample = () => { sampledPeakRssBytes = Math.max(sampledPeakRssBytes, process.memoryUsage().rss); };
  const sampler = setInterval(sample, 5);
  try {
    const started = performance.now(), value = await action();
    const elapsedMs = rounded(performance.now() - started);
    sample();
    await pause(10);
    return { value, elapsedMs, baselineRssBytes, sampledPeakRssBytes,
      loopDelayMs: { samples: histogram.count, p95: histogram.count ? rounded(histogram.percentile(95) / 1e6) : null,
        max: histogram.count ? rounded(histogram.max / 1e6) : null } };
  } finally { clearInterval(sampler); histogram.disable(); }
}

function fixture(index: number) {
  const classId = CLASS_IDS[index % CLASS_IDS.length];
  const save = createCharacter(`Archive${String(index).padStart(5, '0')}`, classId, 47 + index);
  save.level = MAX_LEVEL; save.lastSeen = 1700000000000;
  const rng = new Rng(73 + index), rarities: Rarity[] = ['normal', 'magic', 'rare', 'legendary', 'set'];
  save.inventory = Array.from({ length: INVENTORY_SIZE }, (_, i) => generateItem(rng, { ilvl: MAX_LEVEL, classId, rarity: rarities[i % rarities.length] }));
  save.stash = Array.from({ length: STASH_SIZE }, (_, i) => generateItem(rng, { ilvl: MAX_LEVEL, classId, rarity: rarities[i % rarities.length] }));
  const ids = [...Object.values(save.equipment), ...save.inventory, ...save.stash].filter(Boolean).map(item => item!.id);
  assert.equal(new Set(ids).size, ids.length);
  const body = JSON.stringify({ ...save, syntheticExtension: { purpose: 'backup measurement', keep: ['unknown', 17] } }) + '\n';
  return { save, body, itemCount: ids.length };
}

async function childMain() {
  const root = process.env.BACKUP_BENCH_ROOT!, directory = process.env.DATA_DIR!;
  const count = Number(process.argv[3]);
  assert.ok(root && directory && sizes.includes(count));
  assert.ok(path.basename(root).startsWith('hf-backup-scale-'));
  const realRoot = await fs.realpath(root), realData = await fs.realpath(directory);
  const relative = path.relative(realRoot, realData);
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.equal(await fs.readFile(path.join(realRoot, 'synthetic-only.txt'), 'utf8'), marker);
  assert.deepEqual(await fs.readdir(realData), []);
  assert.equal(process.env.BACKUP_DIR, '');
  // Import persistence only after proving this process owns a new synthetic directory.
  const { ensureDataDir, saveCharacter, flushSaves } = await import('../server/src/persistence');
  const { createCharacterBackup, verifyCharacterBackup, restoreCharacterBackup } = await import('../server/src/backups');
  const { JsonCharacterStore } = await import('../server/src/storage/jsonCharacterStore');
  ensureDataDir();
  const entries: { id: string; bytes: number; sha256: string; items: number }[] = [];
  let queuedSave!: CharacterSave;
  for (let i = 0; i < count; i++) {
    const f = fixture(i);
    if (i === 0) queuedSave = f.save;
    entries.push({ id: f.save.id, bytes: Buffer.byteLength(f.body), sha256: digest(f.body), items: f.itemCount });
    await fs.writeFile(path.join(realData, `${f.save.id}.json`), f.body, { flag: 'wx' });
  }
  const caseRoot = path.dirname(realData), originalSnapshot = JsonCharacterStore.prototype.snapshot;
  let snapshotMs = 0, queuedWriteMs = 0, write: Promise<void> | undefined;
  JsonCharacterStore.prototype.snapshot = async function () {
    const started = performance.now();
    // The enclosing persistence barrier already exists. This write must wait for capture.
    queuedSave.gold = 991;
    write = saveCharacter(queuedSave).then(() => { queuedWriteMs = performance.now() - started; });
    try { return await originalSnapshot.call(this); }
    finally { snapshotMs = performance.now() - started; }
  };
  let creation: Awaited<ReturnType<typeof observe<{ directory: string; characters: number }>>>;
  try { creation = await observe(() => createCharacterBackup(path.join(caseRoot, 'backups'))); }
  finally { JsonCharacterStore.prototype.snapshot = originalSnapshot; }
  assert.ok(write); await write; await flushSaves();
  assert.equal(JSON.parse(await fs.readFile(path.join(realData, `${queuedSave.id}.json`), 'utf8')).gold, 991);
  assert.equal(creation.value.characters, count);
  const verification = await observe(() => verifyCharacterBackup(creation.value.directory));
  const restoration = await observe(() => restoreCharacterBackup(creation.value.directory, path.join(caseRoot, 'restored')));
  assert.equal(verification.value.characters, count); assert.equal(restoration.value.characters, count);
  const restoredEntries = [];
  for (const entry of entries) {
    const restored = await fs.readFile(path.join(restoration.value.directory, `${entry.id}.json`));
    assert.equal(restored.length, entry.bytes); assert.equal(digest(restored), entry.sha256);
    const archived = await fs.readFile(path.join(creation.value.directory, 'characters', `${entry.id}.json`));
    assert.ok(archived.equals(restored));
    if (entry.id !== queuedSave.id) assert.ok((await fs.readFile(path.join(realData, `${entry.id}.json`))).equals(restored));
    restoredEntries.push({ id: entry.id, bytes: restored.length, sha256: digest(restored), items: entry.items });
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(restoration.value.directory, `${queuedSave.id}.json`), 'utf8')).gold, 0);
  assert.deepEqual((await fs.readdir(restoration.value.directory)).sort(), entries.map(e => `${e.id}.json`).sort());
  const report = { characters: count, dataDir: realData, node: process.version, platform: process.platform,
    syntheticOnly: true, classCounts: Object.fromEntries(CLASS_IDS.map((id, i) => [id, Math.floor((count + CLASS_IDS.length - 1 - i) / CLASS_IDS.length)])),
    characterBytes: entries.reduce((n, e) => n + e.bytes, 0), minCharacterBytes: Math.min(...entries.map(e => e.bytes)),
    maxCharacterBytes: Math.max(...entries.map(e => e.bytes)), items: entries.reduce((n, e) => n + e.items, 0),
    fixtureHash: digest(JSON.stringify(entries)), restoredHash: digest(JSON.stringify(restoredEntries)),
    snapshotMs: rounded(snapshotMs), queuedWriteMs: rounded(queuedWriteMs), creation, verification, restoration,
    assertions: { allBytesRestored: true, originalCutPreserved: true, laterWritePersisted: true, otherSourcesUnchanged: true },
  };
  await fs.writeFile(path.join(caseRoot, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ characters: count, snapshotMs: report.snapshotMs, backupMs: creation.elapsedMs, restoreMs: restoration.elapsedMs }));
}

async function main() {
  assert.equal(process.argv.length, 2, 'No existing path or custom input is accepted');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-backup-scale-'));
  await fs.writeFile(path.join(root, 'synthetic-only.txt'), marker, { flag: 'wx' });
  const results: any[] = [];
  const output = path.resolve(path.dirname(filename), '../docs/phase/P03-foundations/checks/backup-scale.json');
  const report = { root, source: 'actual JSON backup/restore; no server/tick load', node: process.version,
    platform: process.platform, cpu: os.cpus()[0]?.model, totalMemoryBytes: os.totalmem(),
    monitor: { resolutionMs: 1, rssIntervalMs: 5, warmupMs: 25, finalTurnMs: 10 }, results, complete: false };
  try {
    for (let round = 1; round <= 2; round++) for (const count of sizes) {
      const caseRoot = path.join(root, `round-${round}-count-${count}`), data = path.join(caseRoot, 'saves');
      await fs.mkdir(data, { recursive: true });
      const child = spawn(process.execPath, ['--import', 'tsx', filename, '--child', String(count)], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DATA_DIR: data, BACKUP_DIR: '', BACKUP_BENCH_ROOT: root },
      });
      let log = '';
      child.stdout.on('data', value => { log += value; process.stdout.write(value); });
      child.stderr.on('data', value => { log += value; process.stderr.write(value); });
      const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      await fs.writeFile(path.join(caseRoot, 'child.log'), log);
      assert.equal(code, 0, log);
      const result = JSON.parse(await fs.readFile(path.join(caseRoot, 'report.json'), 'utf8'));
      if (round === 2) assert.equal(result.fixtureHash, results.find(r => r.characters === count).fixtureHash);
      assert.equal(result.fixtureHash, result.restoredHash);
      results.push({ round, ...result });
    }
    report.complete = true;
  } finally {
    await fs.writeFile(path.join(root, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Backup scale evidence: ${root}`);
  }
}

if (process.argv[2] === '--child') await childMain(); else await main();
