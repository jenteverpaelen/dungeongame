// Real-server helpers for tests: start server/src/main.ts on a free port with an isolated DATA_DIR, and a small
// MessagePack WebSocket client. Every run lives under a fresh directory below the test's DATA_DIR.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { PROTOCOL_VERSION, type S2C } from '../../shared/src/protocol';

export const root = fileURLToPath(new URL('../../', import.meta.url));
assert.ok(process.env.DATA_DIR, 'Server harness requires an isolated DATA_DIR');

export async function freePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>(r => probe.close(() => r()));
  return port;
}

export async function runDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(process.env.DATA_DIR!, prefix));
}

/** Starts a server on `saves` (created if missing). Stop it with `stop()`; start again on the same dir to test restarts. */
export async function startServer(saves: string, env: Record<string, string> = {}) {
  await fs.mkdir(saves, { recursive: true });
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DATA_DIR: saves, BACKUP_DIR: '', BACKUP_KEEP: '0', PORT: String(port), ENABLE_DEBUG: '0', WS_ALLOWED_ORIGINS: undefined, ...env },
  });
  let log = '';
  child.stdout!.on('data', d => { log += d; });
  child.stderr!.on('data', d => { log += d; });
  const closed = new Promise<void>(r => child.once('close', () => r()));
  const deadline = Date.now() + 20000;
  while (!log.includes('listening on')) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`server did not start:\n${log}`);
    await new Promise(r => setTimeout(r, 25));
  }
  return {
    port, saves, log: () => log,
    async stop() {
      if (child.exitCode === null && child.connected) child.send('hearthfall:shutdown');
      const timer = setTimeout(() => child.kill('SIGKILL'), 9000);
      await closed; clearTimeout(timer);
    },
  };
}

const packr = new Packr({ useRecords: false });
export async function client(port: number, headers: Record<string, string> = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}`, headers });
  const messages: S2C[] = [];
  let closed = false;
  ws.on('message', (data: Buffer) => { try { messages.push(packr.unpack(data) as S2C); } catch { /* ignore */ } });
  ws.on('close', () => { closed = true; });
  await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
  const until = async (pred: () => boolean, what: string, ms = 10000) => {
    const end = Date.now() + ms;
    while (!pred()) {
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}; got ${JSON.stringify(messages.map(m => m.t))}`);
      await new Promise(r => setTimeout(r, 15));
    }
  };
  const send = (msg: object) => ws.send(packr.pack(msg));
  const authReplies = () => messages.filter((m): m is Extract<S2C, { t: 'auth' }> => m.t === 'auth' && m.op !== 'status');
  const auth = async (msg: Record<string, unknown>) => {
    const before = authReplies().length;
    send({ t: 'auth', ...msg });
    await until(() => authReplies().length > before, `auth ${String(msg.op)}`);
    return authReplies().at(-1)!;
  };
  const hello = async (name: string, classId = 'warrior') => {
    send({ t: 'hello', name, classId, v: PROTOCOL_VERSION });
    await until(() => messages.some(m => m.t === 'welcome' || m.t === 'err') || closed, 'welcome or error');
    const err = messages.find(m => m.t === 'err') as { msg: string } | undefined;
    return err ? { ok: false as const, err: err.msg } : messages.some(m => m.t === 'welcome') ? { ok: true as const } : { ok: false as const, err: 'closed' };
  };
  let cmdId = 0;
  const cmd = async (op: string, a: Record<string, unknown> = {}) => {
    const id = ++cmdId;
    send({ t: 'cmd', id, op, a });
    await until(() => messages.some(m => m.t === 'res' && m.id === id), `cmd ${op}`);
    return messages.find((m): m is Extract<S2C, { t: 'res' }> => m.t === 'res' && m.id === id)!;
  };
  return { ws, messages, auth, hello, cmd, send, until, isClosed: () => closed, close: () => ws.close() };
}
