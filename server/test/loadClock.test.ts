// The load-scaled deadlines (loadClock.ts) still catch real hangs: a server that never becomes ready (with or without
// its module-load marker) and a socket that never closes all fail, within MAX_FACTOR × the quiet deadline. Same code
// path as connectionRuntime / backupRuntime, with short quiet deadlines so the proof is fast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket, WebSocketServer } from 'ws';
import { MAX_FACTOR, QUIET_BOOT_MS, ServerClock, bootFactor, loadFactor, scaled, until } from './loadClock';

function fakeServer(script: string) {
  const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let log = '';
  child.stdout!.on('data', (d) => { log += d; });
  const clock = new ServerClock(() => log, () => { if (child.exitCode !== null) throw new Error(`exited ${child.exitCode}`); });
  return { child, clock, log: () => log };
}
const marker = (ms: number) => `console.log('[server] modules loaded in ${ms} ms'); setInterval(() => {}, 1000)`;

test('factors stay between 1 (quiet or faster machine: the plain deadline) and MAX_FACTOR', () => {
  const f = loadFactor();
  assert.ok(f >= 1 && f <= MAX_FACTOR, String(f));
  assert.equal(scaled(6000, 1), 6000, 'a quiet machine keeps the exact quiet deadline');
  assert.equal(bootFactor(`[server] modules loaded in ${QUIET_BOOT_MS} ms`), 1);
  assert.equal(bootFactor('[server] modules loaded in 812 ms'), 1, 'a faster boot never shortens the deadline');
  assert.equal(bootFactor(`[server] modules loaded in ${QUIET_BOOT_MS * 3} ms`), 3);
  assert.equal(bootFactor(`[server] modules loaded in ${QUIET_BOOT_MS * 50} ms`), MAX_FACTOR);
  assert.equal(bootFactor('no marker yet'), null);
});

test('a server that loaded its modules but never listens fails at quiet × its own boot slowdown', async () => {
  for (const [bootMs, quiet] of [[QUIET_BOOT_MS, 400], [QUIET_BOOT_MS * 3, 300]] as const) {
    const s = fakeServer(marker(bootMs)), t0 = Date.now();
    try {
      await assert.rejects(s.clock.ready(quiet, 'Hung init'), /Hung init timed out after \d+ ms \(quiet \d+ ms × load/);
      const took = Date.now() - t0, factor = s.clock.factor;
      assert.ok(factor >= bootMs / QUIET_BOOT_MS - 1e-9, `factor ${factor} follows the boot`);
      assert.ok(took >= quiet * factor && took <= quiet * factor + 1500, `${bootMs} ms boot: failed after ${took} ms`);
    } finally { s.child.kill(); }
  }
});

test('a process that never prints the marker fails at the MAX_FACTOR cap', async () => {
  const s = fakeServer('setInterval(() => {}, 1000)'), t0 = Date.now(), quiet = 100;
  try {
    await assert.rejects(s.clock.ready(quiet, 'Hung load'), /cap \d+ before the module-load marker/);
    const took = Date.now() - t0;
    assert.ok(took >= quiet * MAX_FACTOR && took <= quiet * MAX_FACTOR + 1500, `failed after ${took} ms`);
  } finally { s.child.kill(); }
});

test('a socket that never closes fails the close wait', async () => {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  wss.on('connection', (socket) => socket.on('message', () => {})); // accepts everything, never closes
  const port = (wss.address() as { port: number }).port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  let closed = false;
  ws.on('close', () => { closed = true; });
  try {
    await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
    for (let i = 0; i < 700; i++) ws.send('unsupported');
    await assert.rejects(until(() => closed, 400, 'Never-closing socket'), /timed out/);
    assert.equal(closed, false);
  } finally { ws.terminate(); await new Promise<void>((resolve) => wss.close(() => resolve())); }
});
