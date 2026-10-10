import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { createCharacter } from '../../shared/src/character';
import { PROTOCOL_VERSION, type S2C } from '../../shared/src/protocol';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean | Promise<boolean>) {
  const end = Date.now() + 6000;
  while (!(await predicate())) {
    if (Date.now() > end) throw new Error('Timed out waiting for shutdown drill condition');
    await pause(15);
  }
}

test('real child shutdown reports failed storage, exits nonzero and never claims all saved', { timeout: 15000 }, async () => {
  assert.ok(process.env.DATA_DIR, 'Shutdown drill requires an isolated DATA_DIR');
  const runDir = await fs.mkdtemp(path.join(process.env.DATA_DIR, 'shutdown-fault-'));
  const saveDir = path.join(runDir, 'saves');
  await fs.mkdir(saveDir);
  const save = createCharacter('ShutdownFault', 'warrior', 123);
  const file = path.join(saveDir, save.id + '.json');
  await fs.writeFile(file, JSON.stringify(save));
  const reservation = net.createServer();
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) => reservation.close(err => err ? reject(err) : resolve()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, BACKUP_DIR: '', WS_ALLOWED_ORIGINS: undefined, DATA_DIR: saveDir, PORT: String(port), ENABLE_DEBUG: '1', DISABLE_DEBUG: '0' },
  });
  let log = '', startupError: Error | undefined;
  child.on('error', err => { startupError = err; });
  child.stdout!.on('data', chunk => { log += chunk; });
  child.stderr!.on('data', chunk => { log += chunk; });
  const closed = new Promise<number | null>(resolve => child.once('close', resolve));
  let ws: WebSocket | undefined;
  try {
    await until(() => { if (startupError) throw startupError; return log.includes('listening on'); });
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
    await new Promise<void>((resolve, reject) => { ws!.once('open', resolve); ws!.once('error', reject); });
    const codec = new Packr({ useRecords: false }), messages: S2C[] = [];
    ws.on('message', bytes => messages.push(codec.unpack(Buffer.from(bytes as Buffer)) as S2C));
    ws.send(codec.pack({ t: 'hello', name: save.name, classId: save.classId, v: PROTOCOL_VERSION }));
    await until(() => messages.some(m => m.t === 'welcome'));
    await until(async () => JSON.parse(await fs.readFile(file, 'utf8')).lastSeen > save.lastSeen);
    const previousBytes = await fs.readFile(file);
    // These are only this test's files. A directory at the final filename makes
    // the real atomic rename fail on Windows and POSIX without permission hacks.
    await fs.rename(file, file + '.previous');
    await fs.mkdir(file);
    const welcome=messages.find(m=>m.t==='welcome') as Extract<S2C,{t:'welcome'}>;
    ws.send(codec.pack({ t: 'cmd', id: 1, op: 'debug', a: { op: 'gold', n: 1234 },r:{epoch:welcome.char.commands!.epoch,sequence:welcome.char.commands!.sequence,token:'1'.repeat(32)} }));
    await until(() => messages.some(m => m.t === 'res' && m.id === 1 && !m.ok));
    await new Promise<void>((resolve, reject) => child.send('hearthfall:shutdown', err => err ? reject(err) : resolve()));
    const code = await closed;
    assert.equal(code, 1);
    assert.match(log, /error during shutdown/);
    assert.doesNotMatch(log, /all characters saved/);
    assert.deepEqual(await fs.readFile(file + '.previous'), previousBytes);
    assert.ok((await fs.stat(file)).isDirectory());
    assert.equal((await fs.readdir(saveDir)).filter(name => name.endsWith('.tmp')).length, 0);
    await fs.writeFile(path.join(runDir, 'report.json'), JSON.stringify({
      node: process.version, platform: process.platform, runDir, syntheticOnly: true,
      exitCode: code, successMessageAbsent: true, previousSavePreserved: true, tempOutputCleaned: true,
      scope: 'Private parent IPC with a synthetic rename obstruction; not power-loss durability',
    }, null, 2) + '\n');
    await fs.writeFile(path.join(runDir, 'server.log'), log);
    console.log(`Shutdown fault evidence: ${runDir}`);
  } finally {
    ws?.terminate();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  }
});
