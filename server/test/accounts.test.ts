import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { AccountStore, MAX_CHARACTERS_PER_ACCOUNT } from '../src/accounts';
import { createCharacter } from '../../shared/src/character';
import { PROTOCOL_VERSION, type S2C } from '../../shared/src/protocol';

assert.ok(process.env.DATA_DIR, 'Account checks require an isolated DATA_DIR');
const root = fileURLToPath(new URL('../../', import.meta.url));
const GOOD = 'correct horse battery';

async function store(now?: () => number) {
  const dir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'accounts-'));
  const s = new AccountStore(dir, now);
  await s.init();
  return { s, dir };
}

test('registration validates names and passwords, is case-insensitive and refuses reserved or path-like names', async () => {
  const { s } = await store();
  for (const bad of ['', 'ab', 'x'.repeat(21), '../evil', 'a b c', 'ali/ce', 'ali.ce', 'admin', 'CON', 'com1', null, 42]) {
    const r = await s.register(bad as string, GOOD);
    assert.equal(r.ok, false, `refused ${String(bad)}`);
  }
  for (const weak of ['short', 'aaaaaaaaaaaa', 'alice01 is my password', undefined, 12345678901234]) {
    assert.equal((await s.register('alice01', weak as string)).ok, false, `weak ${String(weak)}`);
  }
  const ok = await s.register('Alice01', GOOD);
  assert.ok(ok.ok && ok.username === 'alice01' && ok.recoveryCodes.length === 8 && /^[A-Z2-9]{4}(-[A-Z2-9]{4}){2}$/.test(ok.recoveryCodes[0]));
  assert.equal((await s.register('ALICE01', GOOD)).ok, false, 'case-insensitive duplicate');
});

test('login answers identically for a wrong password and an unknown user, and locks after repeated failures', async () => {
  let clock = 1_000_000;
  const { s } = await store(() => clock);
  assert.ok((await s.register('bob_the_b', GOOD)).ok);
  const wrong = await s.login('bob_the_b', 'not the password');
  const unknown = await s.login('nobody_here', 'not the password');
  assert.deepEqual(wrong, unknown);
  assert.ok(!wrong.ok && wrong.err === 'Wrong username or password.');
  for (let i = 0; i < 4; i++) await s.login('bob_the_b', 'still wrong');
  const locked = await s.login('bob_the_b', GOOD);
  assert.ok(!locked.ok && /Too many attempts/.test(locked.err), 'even the right password waits out the lock');
  clock += 16 * 60_000;
  assert.ok((await s.login('bob_the_b', GOOD)).ok, 'the lock expires');
});

test('racing registrations for one name produce exactly one account', async () => {
  const { s } = await store();
  const results = await Promise.all(Array.from({ length: 6 }, () => s.register('racer_one', GOOD)));
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.deepEqual(s.usernames(), ['racer_one']);
});

test('recovery codes are single use, replace the password and revoke every session', async () => {
  const { s } = await store();
  const reg = await s.register('carol_c', GOOD);
  assert.ok(reg.ok);
  const token = s.issueToken('carol_c');
  assert.equal(s.resume(token), 'carol_c');
  const code = reg.ok ? reg.recoveryCodes[0] : '';
  const fresh = 'a brand new password';
  const rec = await s.recover('CAROL_C', code.toLowerCase().replace(/-/g, ' '), fresh);
  assert.ok(rec.ok && rec.remaining === 7);
  assert.equal(s.resume(token), null, 'old sessions are gone');
  assert.ok(!(await s.login('carol_c', GOOD)).ok);
  assert.ok((await s.login('carol_c', fresh)).ok);
  const again = await s.recover('carol_c', code, 'yet another password');
  assert.ok(!again.ok, 'a used code cannot be replayed');
  const codes = await s.newRecoveryCodes('carol_c', fresh);
  assert.ok(codes.ok && codes.recoveryCodes.length === 8);
  assert.ok(!(await s.recover('carol_c', reg.ok ? reg.recoveryCodes[1] : '', 'zzzzzzzzzzzz9')).ok, 'regenerating invalidates the old set');
});

test('tokens resume until they expire, are capped per account and die on logout or password change', async () => {
  let clock = 5_000_000;
  const { s } = await store(() => clock);
  assert.ok((await s.register('dave_d', GOOD)).ok);
  const first = s.issueToken('dave_d');
  const more = Array.from({ length: 5 }, () => s.issueToken('dave_d'));
  assert.equal(s.resume(first), null, 'the oldest token is dropped past the cap');
  assert.equal(s.resume(more[4]), 'dave_d');
  s.revoke(more[4]);
  assert.equal(s.resume(more[4]), null);
  assert.equal(s.resume('x'.repeat(40)), null);
  clock += 31 * 24 * 3600_000;
  assert.equal(s.resume(more[3]), null, 'expired');
  const t = s.issueToken('dave_d');
  assert.ok((await s.changePassword('dave_d', GOOD, 'another long password')).ok);
  assert.equal(s.resume(t), null, 'a password change revokes sessions');
  assert.ok(!(await s.changePassword('dave_d', 'wrong', 'whatever long password')).ok);
});

test('character ownership is exclusive, capped, race-safe and survives a restart; tampered files are ignored', async () => {
  const { s, dir } = await store();
  assert.ok((await s.register('erin_e', GOOD)).ok && (await s.register('finn_f', GOOD)).ok);
  const [a, b] = await Promise.all([s.link('erin_e', 'hero'), s.link('finn_f', 'hero')]);
  assert.equal([a, b].filter(r => r.ok).length, 1, 'only one account can claim a character');
  const owner = s.ownerOf('hero')!;
  assert.ok(['erin_e', 'finn_f'].includes(owner));
  for (let i = 0; i < MAX_CHARACTERS_PER_ACCOUNT; i++) await s.link('erin_e', `extra${i}`);
  assert.equal(s.charactersOf('erin_e').length, MAX_CHARACTERS_PER_ACCOUNT);
  assert.ok(!(await s.link('erin_e', 'oneTooMany')).ok);
  assert.ok((await s.unlink('erin_e', 'extra0')).ok);
  assert.equal(s.ownerOf('extra0'), undefined);

  const again = new AccountStore(dir);
  await again.init();
  assert.deepEqual(again.usernames(), ['erin_e', 'finn_f']);
  assert.equal(again.ownerOf('hero'), owner);
  await fs.writeFile(path.join(dir, 'mallory.json'), '{"version":1,"username":"someone_else"}');
  await fs.writeFile(path.join(dir, 'broken_x.json'), '{nope');
  const third = new AccountStore(dir);
  await third.init();
  assert.deepEqual(third.usernames(), ['erin_e', 'finn_f'], 'mismatched or malformed files are skipped');
});

// ───────────────── real server over WebSocket ─────────────────

async function startServer(env: Record<string, string>, seed?: (savesDir: string) => Promise<void>) {
  const runDir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'auth-run-'));
  const saves = path.join(runDir, 'saves');
  await fs.mkdir(saves, { recursive: true });
  if (seed) await seed(saves);
  const probe = net.createServer();
  await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>(r => probe.close(() => r()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DATA_DIR: saves, BACKUP_DIR: '', BACKUP_KEEP: '0', PORT: String(port), ENABLE_DEBUG: '0', ...env },
  });
  let log = '';
  child.stdout!.on('data', d => { log += d; });
  child.stderr!.on('data', d => { log += d; });
  const closed = new Promise<void>(r => child.once('close', () => r()));
  const deadline = Date.now() + 15000;
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
async function client(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
  const messages: S2C[] = [];
  let closeReason = '';
  ws.on('message', (data: Buffer) => { try { messages.push(packr.unpack(data) as S2C); } catch { /* ignore */ } });
  ws.on('close', () => { closeReason = 'closed'; });
  await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
  const until = async (pred: () => boolean, what: string) => {
    const end = Date.now() + 8000;
    while (!pred()) {
      if (Date.now() > end) throw new Error(`timed out waiting for ${what}; got ${JSON.stringify(messages.map(m => m.t))}`);
      await new Promise(r => setTimeout(r, 15));
    }
  };
  const send = (msg: object) => ws.send(packr.pack(msg));
  const auth = async (msg: Record<string, unknown>) => {
    const before = messages.filter(m => m.t === 'auth' && m.op !== 'status').length;
    send({ t: 'auth', ...msg });
    await until(() => messages.filter(m => m.t === 'auth' && m.op !== 'status').length > before, `auth ${String(msg.op)}`);
    return messages.filter(m => m.t === 'auth' && m.op !== 'status').at(-1) as Extract<S2C, { t: 'auth' }>;
  };
  const hello = async (name: string) => {
    send({ t: 'hello', name, classId: 'warrior', v: PROTOCOL_VERSION });
    await until(() => messages.some(m => m.t === 'welcome' || m.t === 'err') || closeReason !== '', 'welcome or error');
    const err = messages.find(m => m.t === 'err') as { msg: string } | undefined;
    return err ? { ok: false as const, err: err.msg } : messages.some(m => m.t === 'welcome') ? { ok: true as const } : { ok: false as const, err: 'closed' };
  };
  return { ws, messages, auth, hello, send, until, close: () => ws.close() };
}

test('required mode: no hello without an account, characters belong to their account, legacy ones stay closed', { timeout: 60000 }, async () => {
  const legacy = createCharacter('LegacyHero', 'warrior', 7);
  const server = await startServer({ ACCOUNTS: 'required' }, async saves => {
    await fs.writeFile(path.join(saves, 'legacyhero.json'), JSON.stringify(legacy));
  });
  try {
    const status = await client(server.port);
    await status.until(() => status.messages.some(m => m.t === 'auth' && m.op === 'status'), 'status notice');
    assert.equal((status.messages.find(m => m.t === 'auth') as Extract<S2C, { t: 'auth' }>).mode, 'required');
    const noAuth = await status.hello('AnonHero');
    assert.deepEqual(noAuth, { ok: false, err: 'Log in to your account first.' });

    const alice = await client(server.port);
    const reg = await alice.auth({ op: 'register', username: 'alice_a', password: GOOD });
    assert.ok(reg.ok && reg.token && reg.recoveryCodes?.length === 8, JSON.stringify(reg));
    assert.deepEqual(await alice.hello('AliceHero'), { ok: true });
    alice.close();

    // The same account can come back (token resume) and sees its character.
    const back = await client(server.port);
    const resumed = await back.auth({ op: 'resume', token: reg.token });
    assert.ok(resumed.ok && resumed.characters?.some(c => c.name === 'AliceHero'));
    assert.deepEqual(await back.hello('AliceHero'), { ok: true });
    back.close();

    // Another account cannot take the name; an unknown legacy character stays closed.
    const bob = await client(server.port);
    assert.ok((await bob.auth({ op: 'register', username: 'bob_b', password: GOOD })).ok);
    assert.deepEqual(await bob.hello('AliceHero'), { ok: false, err: 'That name is taken.' });
    const bob2 = await client(server.port);
    assert.ok((await bob2.auth({ op: 'login', username: 'bob_b', password: GOOD })).ok);
    const legacyTry = await bob2.hello('LegacyHero');
    assert.equal(legacyTry.ok, false);
    assert.match((legacyTry as { err: string }).err, /not linked to an account/);
    // Wrong password never authenticates and answers generically.
    const mallory = await client(server.port);
    const bad = await mallory.auth({ op: 'login', username: 'alice_a', password: 'wrong password!!' });
    assert.ok(!bad.ok && bad.err === 'Wrong username or password.');
    for (const c of [status, bob, bob2, mallory]) c.close();
  } finally {
    await server.stop();
  }
});

test('optional mode: name-only play still works, but a character linked to an account refuses name-only login', { timeout: 60000 }, async () => {
  const server = await startServer({ ACCOUNTS: 'optional' });
  try {
    const guest = await client(server.port);
    assert.deepEqual(await guest.hello('GuestHero'), { ok: true });
    guest.close();

    const alice = await client(server.port);
    assert.ok((await alice.auth({ op: 'register', username: 'alice_o', password: GOOD })).ok);
    assert.deepEqual(await alice.hello('LinkedHero'), { ok: true });
    alice.close();
    await new Promise(r => setTimeout(r, 300));

    const stranger = await client(server.port);
    const denied = await stranger.hello('LinkedHero');
    assert.equal(denied.ok, false);
    assert.match((denied as { err: string }).err, /belongs to an account/);
    stranger.close();
  } finally {
    await server.stop();
  }
});
