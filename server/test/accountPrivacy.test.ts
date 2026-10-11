// Accounts part 2 (F-ACC-01/02/05/06): sessions that survive restarts safely, device list, activity log, refined
// lockout, scheduled deletion with grace period, erasure ledger, re-applied erasures after a restore, data export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AccountStore, deviceLabel } from '../src/accounts';
import { PrivacyLedger, erasureDigest, parseGraceDays } from '../src/privacy';
import { Telemetry } from '../src/telemetry';
import { Community } from '../src/community';
import { applyErasuresToDirectory, buildAccountExport, eraseAccountNow, purgeDue, reapplyErasures, type ErasureDeps } from '../src/erasure';
import { ensureDataDir, flushSaves, loadCharacter, saveCharacter } from '../src/persistence';
import { DATA_DIR } from '../src/config';
import { createCharacter } from '../../shared/src/character';
import { client, runDir, startServer } from './serverHarness';

assert.ok(process.env.DATA_DIR, 'Account privacy checks require an isolated DATA_DIR');
ensureDataDir();
const GOOD = 'correct horse battery';
const DAY = 86_400_000;

async function store(now?: () => number, dir?: string) {
  const d = dir ?? await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'acct-'));
  const s = new AccountStore(d, now);
  await s.init();
  return { s, dir: d };
}

test('device labels are coarse and never echo the header', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'), 'Chrome on Windows');
  assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'), 'Safari on macOS');
  assert.equal(deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'), 'Firefox on Linux');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141 Safari/537.36 Edg/141'), 'Edge on Windows');
  assert.equal(deviceLabel(undefined), 'Unknown device');
  assert.equal(deviceLabel('<script>alert(1)</script>'), 'Browser');
});

test('sessions survive a restart, but only their hashes are on disk; logout, revoke and password change persist too', async () => {
  let clock = 10 * DAY;
  const { s, dir } = await store(() => clock);
  assert.ok((await s.register('sam_s', GOOD)).ok);
  const laptop = s.issueToken('sam_s', 'Chrome on Windows'), phone = s.issueToken('sam_s', 'Safari on iOS'), tablet = s.issueToken('sam_s', 'Firefox on Android');
  await s.settled();
  const raw = await fs.readFile(path.join(dir, '.sessions.json'), 'utf8');
  for (const t of [laptop, phone, tablet]) assert.ok(!raw.includes(t), 'raw tokens are never written');
  assert.equal(JSON.parse(raw).sessions.length, 3);

  const again = new AccountStore(dir, () => clock);
  await again.init();
  assert.equal(again.resume(laptop), 'sam_s', 'a restart keeps the session');
  assert.deepEqual(again.usernames(), ['sam_s'], 'the session file is not mistaken for an account');
  const list = again.sessionsOf('sam_s', laptop);
  assert.equal(list.length, 3);
  assert.equal(list.find(x => x.current)?.device, 'Chrome on Windows');
  assert.ok(list.every(x => /^[a-f0-9]{16}$/.test(x.id)));
  // Sign out one other device, then everyone else; the caller's own session stays.
  assert.equal(again.revokeSession('sam_s', list.find(x => x.device === 'Safari on iOS')!.id, laptop), 1);
  assert.equal(again.resume(phone), null);
  assert.equal(again.revokeSession('sam_s', 'others', laptop), 1);
  assert.equal(again.resume(tablet), null);
  assert.equal(again.resume(laptop), 'sam_s');
  assert.equal(again.revokeSession('sam_s', 'zz', laptop), 0, 'malformed ids revoke nothing');
  again.revoke(laptop);
  await again.settled();
  const third = new AccountStore(dir, () => clock);
  await third.init();
  assert.equal(third.resume(laptop), null, 'logout is durable across a restart');

  // Expired or tampered entries are dropped at load.
  const t = third.issueToken('sam_s', 'x');
  await third.settled();
  clock += 31 * DAY;
  const fourth = new AccountStore(dir, () => clock);
  await fourth.init();
  assert.equal(fourth.resume(t), null, 'expired sessions do not come back');
  await fs.writeFile(path.join(dir, '.sessions.json'), '{"version":1,"sessions":[{"h":"nothex","u":"sam_s","c":0,"l":0,"e":1e15,"d":"x"}]}');
  const fifth = new AccountStore(dir, () => clock);
  await fifth.init();
  assert.equal(fifth.sessionsOf('sam_s').length, 0, 'tampered entries are ignored');
});

test('ACCOUNT_SESSIONS=memory keeps the old behaviour (no file, restart signs everyone out)', async () => {
  const dir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'acct-mem-'));
  const s = new AccountStore(dir, Date.now, false);
  await s.init();
  assert.ok((await s.register('mia_m', GOOD)).ok);
  const t = s.issueToken('mia_m');
  await s.settled();
  await assert.rejects(fs.access(path.join(dir, '.sessions.json')));
  const again = new AccountStore(dir, Date.now, false);
  await again.init();
  assert.equal(again.resume(t), null);
});

test('a stranger cannot lock a player out: failures lock the username for that connection only, until the account ceiling', async () => {
  let clock = 50 * DAY;
  const { s } = await store(() => clock);
  assert.ok((await s.register('vic_v', GOOD)).ok);
  for (let i = 0; i < 5; i++) await s.login('vic_v', 'not my password', '203.0.113.9');
  const attacker = await s.login('vic_v', GOOD, '203.0.113.9');
  assert.ok(!attacker.ok && /Too many attempts/.test(attacker.err), 'the guessing connection is locked');
  assert.ok((await s.login('vic_v', GOOD, '198.51.100.7')).ok, 'the owner on another connection still gets in');
  // Many connections together: 50 failures lock the account itself (well before NIST's 100).
  for (let i = 0; i < 46; i++) await s.login('vic_v', 'not my password', `10.1.${Math.floor(i / 4)}.${i % 4}`);
  const locked = await s.login('vic_v', GOOD, '198.51.100.7');
  assert.ok(!locked.ok && /Too many attempts/.test(locked.err), 'the per-account ceiling engages');
  clock += 16 * 60_000;
  assert.ok((await s.login('vic_v', GOOD, '198.51.100.7')).ok, 'and expires');
});

test('the activity list records security events without IPs, and recovery is visible to the owner', async () => {
  const { s } = await store();
  const reg = await s.register('ada_a', GOOD, '192.0.2.1', 'Chrome on Windows');
  assert.ok(reg.ok);
  assert.ok((await s.login('ada_a', GOOD, '192.0.2.1', 'Firefox on Linux')).ok);
  assert.ok((await s.recover('ada_a', reg.ok ? reg.recoveryCodes[0] : '', 'a new long password')).ok);
  assert.ok((await s.newRecoveryCodes('ada_a', 'a new long password')).ok);
  await s.settled();
  const kinds = s.events('ada_a').map(e => e.k);
  assert.deepEqual(kinds, ['created', 'login', 'recovery', 'codes']);
  assert.equal(s.events('ada_a')[1].d, 'Firefox on Linux');
  assert.ok(!JSON.stringify(s.events('ada_a')).includes('192.0.2.1'), 'no IP address is stored');
  assert.equal(s.recoveryLeft('ada_a'), 8);
  const exported = s.exportRecord('ada_a')!, file = JSON.parse(await fs.readFile(path.join(s.dir, 'ada_a.json'), 'utf8'));
  for (const key of ['hash', 'salt', 'recovery', 'kdf']) assert.ok(!(key in exported), `export has no ${key} field`);
  for (const secret of [file.hash, file.salt, ...file.recovery]) assert.ok(!JSON.stringify(exported).includes(secret), 'no secret value leaks');
});

test('the grace period setting is bounded', () => {
  assert.equal(parseGraceDays(undefined), 14);
  assert.equal(parseGraceDays('0'), 0);
  assert.equal(parseGraceDays('30'), 30);
  for (const bad of ['31', '-1', '1.5', 'x']) assert.throws(() => parseGraceDays(bad));
});

async function privacyRig(now: () => number) {
  const base = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'privacy-'));
  const { s } = await store(now, path.join(base, 'accounts'));
  const ledger = new PrivacyLedger(path.join(base, 'privacy'), now, 14 * DAY);
  await ledger.init();
  const telemetry = new Telemetry(path.join(base, 'telemetry'), true, now);
  const community = new Community(() => [], () => false, () => true, path.join(base, 'social'));
  await community.init();
  const deps: ErasureDeps = { accounts: s, ledger, telemetry, community };
  return { base, s, ledger, telemetry, community, deps };
}

test('account deletion waits out the grace period, can be cancelled, then erases account, heroes, sessions and telemetry', async () => {
  let clock = Date.now();
  const { s, ledger, telemetry, deps, base } = await privacyRig(() => clock);
  assert.ok((await s.register('del_me', GOOD)).ok && (await s.register('keep_me', GOOD)).ok);
  const mine = createCharacter('Doomed', 'mage', 3), theirs = createCharacter('Keeper', 'ranger', 4);
  await saveCharacter(mine); await saveCharacter(theirs); await flushSaves();
  assert.ok((await s.link('del_me', mine.id)).ok && (await s.link('keep_me', theirs.id)).ok);
  const token = s.issueToken('del_me');
  telemetry.log({ e: 'logout', c: mine.id, lvl: 1, playMs: 1, kills: 0, deaths: 0 });
  telemetry.log({ e: 'logout', c: theirs.id, lvl: 1, playMs: 1, kills: 0, deaths: 0 });
  await telemetry.flush();

  const p = await ledger.schedule('account', 'del_me', { by: 'player' });
  assert.equal(p.purgeAt - p.requestedAt, 14 * DAY);
  assert.equal((await ledger.schedule('account', 'del_me')).requestedAt, p.requestedAt, 'idempotent');
  assert.equal((await purgeDue(deps, clock + 13 * DAY)).accounts.length, 0, 'nothing happens inside the grace period');
  assert.ok(await ledger.cancel('account', 'del_me'));
  assert.equal((await purgeDue(deps, clock + 15 * DAY)).accounts.length, 0, 'a cancelled request is gone');

  await ledger.schedule('account', 'del_me');
  clock += 15 * DAY;
  const done = await purgeDue(deps, clock);
  assert.deepEqual(done, { accounts: ['del_me'], characters: [mine.id] });
  assert.equal(s.has('del_me'), false);
  assert.equal(s.resume(token), null, 'its sessions are gone');
  assert.equal(await loadCharacter(mine.id), null, 'its hero is gone');
  assert.ok(await loadCharacter(theirs.id), 'other heroes are untouched');
  assert.deepEqual((await telemetry.eventsFor([mine.id, theirs.id])).map(e => e.c), [theirs.id], 'only its telemetry lines are scrubbed');
  assert.ok(ledger.isErased('account', 'del_me') && ledger.isErased('character', mine.id));
  const ledgerText = await fs.readFile(path.join(base, 'privacy', 'ledger.json'), 'utf8');
  assert.ok(!ledgerText.includes('del_me') && !ledgerText.includes(mine.id), 'the ledger keeps digests, not names');
  assert.ok(ledgerText.includes(erasureDigest('account', 'del_me')));
});

test('a restored backup cannot bring an erased hero back, but a new hero who took the freed name stays', async () => {
  // Real clock: save files carry the real `lastSeen`, which is what the re-apply rule compares.
  const tick = () => new Promise(r => setTimeout(r, 5));
  const { s, ledger, deps } = await privacyRig(Date.now);
  const old = createCharacter('Phoenix', 'warrior', 9);
  await saveCharacter(old); await flushSaves();
  const restoredBytes = await fs.readFile(path.join(DATA_DIR, `${old.id}.json`));
  await tick();
  await ledger.schedule('character', old.id, { graceMs: 0, by: 'owner' });
  await purgeDue(deps);
  assert.equal(await loadCharacter(old.id), null);
  // Operator restores yesterday's backup into the live directory:
  await fs.writeFile(path.join(DATA_DIR, `${old.id}.json`), restoredBytes);
  assert.deepEqual((await reapplyErasures(deps)).characters, [old.id]);
  assert.equal(await loadCharacter(old.id), null, 'erased again at start-up');
  // Someone creates a new hero with the freed name later:
  await tick();
  const fresh = createCharacter('Phoenix', 'mage', 10);
  await saveCharacter(fresh); await flushSaves();
  assert.deepEqual((await reapplyErasures(deps)).characters, [], 'a newer save is not erased');
  assert.equal((await loadCharacter(fresh.id))?.classId, 'mage');
  void s;
});

test('restore tooling applies erasures to a restored directory before it goes live', async () => {
  let clock = Date.now();
  const { ledger, deps, base } = await privacyRig(() => clock);
  const gone = createCharacter('Vanish', 'ranger', 11), kept = createCharacter('Remain', 'ranger', 12);
  await saveCharacter(gone); await saveCharacter(kept); await flushSaves();
  const restored = path.join(base, 'restored');
  await fs.mkdir(restored);
  for (const c of [gone, kept]) await fs.copyFile(path.join(DATA_DIR, `${c.id}.json`), path.join(restored, `${c.id}.json`));
  await ledger.schedule('character', gone.id, { graceMs: 0 });
  clock += 1000;
  await purgeDue(deps, clock);
  const r = await applyErasuresToDirectory(restored, path.join(base, 'privacy', 'ledger.json'));
  assert.deepEqual(r.characters, [gone.id]);
  assert.deepEqual((await fs.readdir(restored)).sort(), [`${kept.id}.json`]);
});

test('the export holds the account, every hero save, guild data and telemetry, but no secrets', async () => {
  const clock = Date.now();
  const { s, telemetry, deps } = await privacyRig(() => clock);
  assert.ok((await s.register('exp_e', GOOD, '', 'Chrome on Windows')).ok);
  const hero = createCharacter('Exporter', 'warrior', 13);
  hero.gold = 4242;
  await saveCharacter(hero); await flushSaves();
  assert.ok((await s.link('exp_e', hero.id)).ok);
  telemetry.log({ e: 'level', c: hero.id, lvl: 2, playMs: 5, zone: 'hearthmere', kills: 1, deaths: 0, gold: 3 });
  await telemetry.flush();
  const data = await buildAccountExport(deps, 'exp_e') as { format: string; account: { username: string }; characters: { save: { gold: number } }[]; telemetry: unknown[] };
  assert.equal(data.format, 'hearthfall-personal-data');
  assert.equal(data.account.username, 'exp_e');
  assert.equal(data.characters[0].save.gold, 4242);
  assert.equal(data.telemetry.length, 1);
  const text = JSON.stringify(data), file = JSON.parse(await fs.readFile(path.join(s.dir, 'exp_e.json'), 'utf8'));
  for (const secret of [file.hash, file.salt, ...file.recovery]) assert.ok(!text.includes(secret), 'no secret value leaks');
  assert.deepEqual(await eraseAccountNow(deps, 'exp_e'), [hero.id]);
});

// ───────────────── real server: restart, devices, deletion flow, export ─────────────────

test('real server: a session survives a restart; deletion blocks play until cancelled; export over the socket', { timeout: 120000 }, async () => {
  const dir = await runDir('privacy-run-');
  const saves = path.join(dir, 'saves');
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36' };
  let server = await startServer(saves, { ACCOUNTS: 'required' });
  let token = '';
  try {
    const a = await client(server.port, ua);
    const reg = await a.auth({ op: 'register', username: 'rita_r', password: GOOD });
    assert.ok(reg.ok && reg.token && reg.info?.recoveryLeft === 8 && reg.info.graceDays === 14, JSON.stringify(reg));
    token = reg.token!;
    assert.deepEqual(await a.hello('RitaHero'), { ok: true });
    a.close();
  } finally { await server.stop(); }

  server = await startServer(saves, { ACCOUNTS: 'required' });
  try {
    const b = await client(server.port, ua);
    const resumed = await b.auth({ op: 'resume', token });
    assert.ok(resumed.ok && resumed.username === 'rita_r', 'the token still works after a restart');
    const devices = await b.auth({ op: 'sessions' });
    assert.equal(devices.sessions?.length, 1);
    assert.deepEqual([devices.sessions![0].device, devices.sessions![0].current], ['Chrome on Windows', true]);
    assert.ok(devices.events?.some(e => e.k === 'created'));

    const wrong = await b.auth({ op: 'export', password: 'not the password' });
    assert.ok(!wrong.ok, 'export re-asks the password');
    const exp = await b.auth({ op: 'export', password: GOOD });
    assert.ok(exp.ok && (exp.data as { characters: { id: string }[] }).characters[0].id === 'ritahero');

    const noConfirm = await b.auth({ op: 'deleteCharacter', character: 'RitaHero', password: 'wrong wrong wrong' });
    assert.ok(!noConfirm.ok);
    const del = await b.auth({ op: 'deleteCharacter', character: 'RitaHero', password: GOOD });
    assert.ok(del.ok && del.characters?.[0].deleteAt, 'the hero shows its deletion date');
    assert.match(String((await b.hello('RitaHero') as { err?: string }).err), /scheduled for deletion/);

    const c = await client(server.port, ua);
    assert.ok((await c.auth({ op: 'resume', token })).ok);
    const restored = await c.auth({ op: 'restoreCharacter', character: 'RitaHero' });
    assert.ok(restored.ok && !restored.characters?.[0].deleteAt);
    const badConfirm = await c.auth({ op: 'deleteAccount', password: GOOD, confirm: 'someone' });
    assert.ok(!badConfirm.ok && /Type your username/.test(badConfirm.err ?? ''));
    const delAcc = await c.auth({ op: 'deleteAccount', password: GOOD, confirm: 'rita_r' });
    assert.ok(delAcc.ok && delAcc.info?.deletionAt, 'the account shows its erase date');
    assert.match(String((await c.hello('RitaHero') as { err?: string }).err), /account is scheduled for deletion/);

    const d = await client(server.port, ua);
    assert.ok((await d.auth({ op: 'login', username: 'rita_r', password: GOOD })).ok, 'login still works during the grace period');
    const cancel = await d.auth({ op: 'cancelDeletion' });
    assert.ok(cancel.ok && !cancel.info?.deletionAt);
    assert.deepEqual(await d.hello('RitaHero'), { ok: true }, 'play works again after cancelling');
    for (const x of [b, c, d]) x.close();
  } finally { await server.stop(); }
});
