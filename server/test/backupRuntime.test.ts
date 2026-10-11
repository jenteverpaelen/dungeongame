import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { createCharacter } from '../../shared/src/character';
import { PROTOCOL_VERSION, type S2C } from '../../shared/src/protocol';
import { restoreCharacterBackup, verifyCharacterBackup } from '../src/backups';
import { ServerClock, testTimeout } from './loadClock';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Quiet-machine deadlines as before (6 s per wait), scaled by the load this server's own start-up measured
// (server/test/loadClock.ts): unchanged on a quiet machine, a real hang still fails.
async function start(saveDir: string, backupDir = '', keepCount = 0) {
  const reservation = net.createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(err => err ? reject(err) : resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DATA_DIR: saveDir, BACKUP_DIR: backupDir, BACKUP_KEEP: String(keepCount), WS_ALLOWED_ORIGINS: undefined, PORT: String(port), ENABLE_DEBUG: '0' },
  });
  let log = '', startupError: Error | undefined;
  child.on('error', error => { startupError = error; });
  child.stdout!.on('data', data => { log += data; });
  child.stderr!.on('data', data => { log += data; });
  const closed = new Promise<number | null>(resolve => child.once('close', resolve));
  const clock = new ServerClock(() => log, () => { if (startupError) throw startupError; if (child.exitCode !== null) throw new Error(log); });
  return { child, closed, port, clock, log: () => log, ready: () => clock.ready(6000, 'Backup/restore drill start-up'),
  until: (predicate: () => boolean) => clock.until(predicate, 6000, 'Backup/restore drill'),
  async stop() {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve, reject) => child.send('hearthfall:shutdown', err => err ? reject(err) : resolve()));
    }
    return closed;
  }, async cleanup() {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  } };
}

test('configured real server backup restores through CLI and reconnects with the same owned items', { timeout: testTimeout(30000) }, async () => {
  assert.ok(process.env.DATA_DIR, 'Runtime restore test requires an isolated DATA_DIR');
  const runDir = await fs.mkdtemp(path.join(process.env.DATA_DIR, 'restore-drill-'));
  const saveDir = path.join(runDir, 'saves'), backups = path.join(runDir, 'backups');
  await fs.mkdir(saveDir);
  const c = createCharacter('RestoreDrill', 'mage', 45);
  c.gold = 719; c.xp = 27;
  c.stash[0] = structuredClone(Object.values(c.equipment).find(Boolean) ?? null);
  assert.ok(c.stash[0], 'round-trip fixture must own an actual item in stash');
  const bytes = Buffer.from(JSON.stringify(c) + '\n');
  await fs.writeFile(path.join(saveDir, c.id + '.json'), bytes);
  const first = await start(saveDir, backups);
  try {
    await first.ready();
    await first.until(() => first.log().includes('[backup] verified 1 characters'));
    assert.equal(await first.stop(), 0);
  } finally { await first.cleanup(); await fs.writeFile(path.join(runDir, 'before.log'), first.log()); }
  const bundle = path.join(backups, (await fs.readdir(backups))[0]);
  const restored = path.join(runDir, 'restored');
  const cli = async (args: string[]) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/restore-saves.ts', ...args], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DATA_DIR: saveDir, BACKUP_DIR: '', BACKUP_KEEP: '0' },
    });
    let output = '';
    child.stdout!.on('data', data => { output += data; });
    child.stderr!.on('data', data => { output += data; });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.equal(code, 0, output);
    return output;
  };
  const verification = await cli(['verify', bundle]);
  const restoration = await cli(['restore', bundle, restored]);
  assert.deepEqual(await fs.readFile(path.join(restored, c.id + '.json')), bytes);
  assert.deepEqual(await fs.readFile(path.join(saveDir, c.id + '.json')), bytes);
  const second = await start(restored);
  let ws: WebSocket | undefined;
  try {
    await second.ready();
    ws = new WebSocket(`ws://127.0.0.1:${second.port}/ws`, { origin: `http://127.0.0.1:${second.port}` });
    await second.clock.waitEvent(ws!, 'open', 6000, 'WebSocket open');
    const codec = new Packr({ useRecords: false }), messages: S2C[] = [];
    ws.on('message', data => messages.push(codec.unpack(Buffer.from(data as Buffer)) as S2C));
    ws.send(codec.pack({ t: 'hello', name: c.name, classId: c.classId, v: PROTOCOL_VERSION }));
    await second.until(() => messages.some(m => m.t === 'welcome'));
    const restoredChar = messages.find(m => m.t === 'welcome');
    assert.ok(restoredChar?.t === 'welcome');
    assert.equal(restoredChar.char.gold, c.gold);
    assert.equal(restoredChar.char.xp, c.xp);
    assert.deepEqual([restoredChar.char.equipment, restoredChar.char.inventory, restoredChar.char.stash], [c.equipment, c.inventory, c.stash]);
    assert.equal(await second.stop(), 0);
    assert.doesNotMatch(second.log(), /\[backup\]/);
    await fs.writeFile(path.join(runDir, 'report.json'), JSON.stringify({
      node: process.version, platform: process.platform, runDir, syntheticOnly: true,
      configuredStartupBackup: true, verifyCli: verification, restoreCli: restoration,
      originalBytesUnchanged: true, restoredBytesEqual: true, reconnectItemsAndProgressEqual: true,
      backupsDisabledWhenUnconfigured: true,
      scope: 'Local Node child processes, private IPC shutdown and WebSocket reconnect; not crash/power-loss or off-device recovery',
    }, null, 2) + '\n');
    console.log(`Restore drill evidence: ${runDir}`);
  } finally { ws?.terminate(); await second.cleanup(); await fs.writeFile(path.join(runDir, 'after.log'), second.log()); }
});

test('real startup rotation is opt-in, scoped by source and previewed without deletion', { timeout: testTimeout(30000) }, async () => {
  assert.ok(process.env.DATA_DIR, 'Runtime rotation requires an isolated DATA_DIR');
  const runDir = await fs.mkdtemp(path.join(process.env.DATA_DIR, 'rotation-runtime-'));
  const saveDir = path.join(runDir, 'saves'), backups = path.join(runDir, 'backups');
  await fs.mkdir(saveDir);
  const c = createCharacter('RotationRuntime', 'ranger', 53), counts: number[] = [], removed: string[] = [];
  let previous: string[] = [];
  for (const [i, keep] of [0, 0, 2, 0].entries()) {
    c.gold = 10 + i; await fs.writeFile(path.join(saveDir, c.id + '.json'), JSON.stringify(c));
    const server = await start(saveDir, backups, keep);
    try {
      await server.ready();
      await server.until(() => server.log().includes(keep ? '[backup] rotation kept' : '[backup] verified'));
      assert.equal(await server.stop(), 0);
    } finally { await server.cleanup(); await fs.writeFile(path.join(runDir, `run-${i}.log`), server.log()); }
    const names = (await fs.readdir(backups)).sort(); counts.push(names.length);
    removed.push(...previous.filter(n => !names.includes(n))); previous = names;
    for (const name of names) await verifyCharacterBackup(path.join(backups, name));
  }
  assert.deepEqual(counts, [1, 2, 2, 3]); assert.equal(removed.length, 1);
  const newest = path.join(backups, previous.at(-1)!);
  const restored = await restoreCharacterBackup(newest, path.join(runDir, 'restored'));
  assert.deepEqual(await fs.readFile(path.join(restored.directory, c.id + '.json')), await fs.readFile(path.join(saveDir, c.id + '.json')));
  const cli = spawn(process.execPath, ['--import', 'tsx', 'scripts/restore-saves.ts', 'plan', backups, newest, '1'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DATA_DIR: saveDir, BACKUP_DIR: '', BACKUP_KEEP: '0' },
  });
  let output = ''; cli.stdout!.on('data', data => { output += data; }); cli.stderr!.on('data', data => { output += data; });
  assert.equal(await new Promise<number | null>((resolve, reject) => { cli.once('close', resolve); cli.once('error', reject); }), 0, output);
  assert.match(output, /Read-only rotation plan/); assert.deepEqual((await fs.readdir(backups)).sort(), previous);
  const differentSource = await start(restored.directory, backups, 1);
  try {
    await differentSource.ready(); await differentSource.until(() => differentSource.log().includes('[backup] rotation kept'));
    assert.match(differentSource.log(), /preserved 3 excluded entries/); assert.equal(await differentSource.stop(), 0);
  } finally { await differentSource.cleanup(); await fs.writeFile(path.join(runDir, 'other-source.log'), differentSource.log()); }
  assert.equal((await fs.readdir(backups)).length, 4);
  for (const name of previous) await verifyCharacterBackup(path.join(backups, name));
  await fs.writeFile(path.join(runDir, 'report.json'), JSON.stringify({ runDir, node: process.version, counts, removed, plan: output,
    sourceIsolation: true, restoredBytesEqual: true, syntheticOnly: true, scope: 'Actual local child servers; not hostile filesystem races or power-loss simulation' }, null, 2) + '\n');
  console.log(`Rotation runtime evidence: ${runDir}`);
});
