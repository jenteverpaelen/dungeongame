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

const root = fileURLToPath(new URL('../../', import.meta.url));
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 6000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out during backup/restore drill');
    await new Promise(resolve => setTimeout(resolve, 15));
  }
}
async function start(saveDir: string, backupDir = '') {
  const reservation = net.createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(err => err ? reject(err) : resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DATA_DIR: saveDir, BACKUP_DIR: backupDir, PORT: String(port), ENABLE_DEBUG: '0' },
  });
  let log = '', startupError: Error | undefined;
  child.on('error', error => { startupError = error; });
  child.stdout!.on('data', data => { log += data; });
  child.stderr!.on('data', data => { log += data; });
  const closed = new Promise<number | null>(resolve => child.once('close', resolve));
  return { child, closed, port, log: () => log, ready: () => {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw new Error(log);
    return log.includes('listening on');
  }, async stop() {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve, reject) => child.send('hearthfall:shutdown', err => err ? reject(err) : resolve()));
    }
    return closed;
  }, async cleanup() {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  } };
}

test('configured real server backup restores through CLI and reconnects with the same owned items', { timeout: 30000 }, async () => {
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
    await until(first.ready);
    await until(() => first.log().includes('[backup] verified 1 characters'));
    assert.equal(await first.stop(), 0);
  } finally { await first.cleanup(); await fs.writeFile(path.join(runDir, 'before.log'), first.log()); }
  const bundle = path.join(backups, (await fs.readdir(backups))[0]);
  const restored = path.join(runDir, 'restored');
  const cli = async (args: string[]) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/restore-saves.ts', ...args], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DATA_DIR: saveDir, BACKUP_DIR: '' },
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
    await until(second.ready);
    ws = new WebSocket(`ws://127.0.0.1:${second.port}/ws`);
    await new Promise<void>((resolve, reject) => { ws!.once('open', resolve); ws!.once('error', reject); });
    const codec = new Packr({ useRecords: false }), messages: S2C[] = [];
    ws.on('message', data => messages.push(codec.unpack(Buffer.from(data as Buffer)) as S2C));
    ws.send(codec.pack({ t: 'hello', name: c.name, classId: c.classId, v: PROTOCOL_VERSION }));
    await until(() => messages.some(m => m.t === 'welcome'));
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
