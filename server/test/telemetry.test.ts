import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCharacter } from '../../shared/src/character';
import { writeQuestState } from '../../shared/src/quests';
import { Telemetry, diffEvents, observe, type StoredEvent } from '../src/telemetry';
import { summarize } from '../src/telemetryReport';

assert.ok(process.env.DATA_DIR, 'Telemetry checks require an isolated DATA_DIR');

test('level-ups, deaths, legendaries, zone changes and quest steps become events; no change, no events', () => {
  const save = createCharacter('Telem', 'mage', 3);
  const a = observe(save, 'hearthmere', 1000);
  assert.deepEqual(diffEvents(null, a, 'telem'), [], 'the first look has nothing to compare');
  assert.deepEqual(diffEvents(a, observe(save, 'hearthmere', 2000), 'telem'), [], 'a quiet second logs nothing');

  save.level = 3; save.stats.deaths = 2; save.stats.legendaries = 1; save.stats.kills = 40; save.gold = 90;
  writeQuestState(save, 'high_water', { revision: 1, step: 0, claimed: false });
  const b = observe(save, 'rillwake_crossing', 61_000);
  const events = diffEvents(a, b, 'telem');
  assert.deepEqual(events.filter(e => e.e === 'level').map(e => e.lvl), [2, 3], 'one event per level gained');
  assert.equal(events.find(e => e.e === 'death')!.n, 2);
  assert.equal(events.find(e => e.e === 'legendary')!.n, 1);
  assert.deepEqual(events.find(e => e.e === 'zone'), { e: 'zone', c: 'telem', lvl: 3, playMs: 61000, zone: 'rillwake_crossing', from: 'hearthmere', to: 'rillwake_crossing' });
  assert.deepEqual(events.filter(e => e.e === 'quest').map(e => [e.q, e.a]), [['high_water', 'accept']]);

  writeQuestState(save, 'high_water', { revision: 1, step: 1, claimed: false, progress: 0 });
  const c = observe(save, 'rillwake_crossing', 90_000);
  assert.deepEqual(diffEvents(b, c, 'telem').map(e => [e.e, e.a]), [['quest', 'step']]);
  writeQuestState(save, 'high_water', { revision: 1, step: 2, claimed: true });
  assert.deepEqual(diffEvents(c, observe(save, 'rillwake_crossing', 95_000), 'telem').map(e => [e.e, e.a]), [['quest', 'claim']]);
});

test('the writer is inert when disabled, groups events into one file per UTC day and never throws', async () => {
  const dir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'telemetry-'));
  const off = new Telemetry(path.join(dir, 'off'), false);
  off.log({ e: 'login', c: 'x' });
  await off.shutdown();
  await assert.rejects(fs.stat(path.join(dir, 'off')), 'disabled telemetry creates nothing');

  let clock = Date.UTC(2026, 9, 10, 23, 59, 0);
  const on = new Telemetry(path.join(dir, 'on'), true, () => clock);
  on.log({ e: 'login', c: 'hero' });
  clock = Date.UTC(2026, 9, 11, 0, 1, 0);
  on.log({ e: 'level', c: 'hero', lvl: 2 });
  await on.shutdown();
  const files = (await fs.readdir(path.join(dir, 'on'))).sort();
  assert.deepEqual(files, ['events-2026-10-10.jsonl', 'events-2026-10-11.jsonl']);
  const lines = (await fs.readFile(path.join(dir, 'on', files[1]), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  assert.deepEqual(lines, [{ t: clock, e: 'level', c: 'hero', lvl: 2 }]);

  const blocked = path.join(dir, 'file-not-folder');
  await fs.writeFile(blocked, 'x');
  const broken = new Telemetry(path.join(blocked, 'sub'), true);
  broken.log({ e: 'login', c: 'x' });
  await broken.shutdown(); // must resolve
});

test('the report reads like a playtest: time to level, deaths by zone and quest durations', () => {
  const t0 = Date.UTC(2026, 9, 10, 18, 0, 0);
  const ev = (minute: number, e: string, extra: Record<string, unknown>): StoredEvent => ({ t: t0 + minute * 60_000, e, c: 'hero', ...extra });
  const report = summarize([
    ev(0, 'login', { cls: 'mage', fresh: true, lvl: 1, playMs: 0 }),
    ev(2, 'quest', { q: 'first_road', a: 'accept', playMs: 120_000, lvl: 1, zone: 'rillwake_crossing', step: 0 }),
    ev(5, 'level', { lvl: 5, playMs: 300_000, kills: 30, deaths: 0, zone: 'rillwake_crossing' }),
    ev(6, 'death', { n: 2, playMs: 360_000, lvl: 5, zone: 'bracken_sluice' }),
    ev(9, 'quest', { q: 'first_road', a: 'claim', playMs: 540_000, lvl: 5, zone: 'rillwake_crossing', step: 1 }),
    ev(12, 'level', { lvl: 10, playMs: 720_000, kills: 90, deaths: 2, zone: 'bracken_sluice' }),
    ev(20, 'logout', { lvl: 10, playMs: 1_200_000, kills: 150, deaths: 2 }),
  ]);
  assert.match(report, /\| hero \| mage \| 10 \| 20\.0 \| 150 \| 2 \| 1 \|/);
  assert.match(report, /\| hero \| 5\.0 \| 12\.0 \|/, 'L5 at 5 min and L10 at 12 min of play');
  assert.match(report, /\| bracken_sluice \| 2 \|/);
  assert.match(report, /\| first_road \| 1 \| 1 \| 0 \| 7\.0 \| 7\.0 \|/, 'accepted at 2 min, claimed at 9 min of play');
  assert.match(summarize([]), /No telemetry events found/);
});

// ───────────────── real server: the hooks fire from a live session ─────────────────
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';
import { PROTOCOL_VERSION } from '../../shared/src/protocol';

test('a live session writes login, level and logout events to the day file', { timeout: 60000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const runDir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'telemetry-run-'));
  const saves = path.join(runDir, 'saves');
  await fs.mkdir(saves, { recursive: true });
  const probe = net.createServer();
  await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>(r => probe.close(() => r()));
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/main.ts'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DATA_DIR: saves, BACKUP_DIR: '', BACKUP_KEEP: '0', PORT: String(port), ENABLE_DEBUG: '1', TELEMETRY: '1' },
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
  try {
    const packr = new Packr({ useRecords: false });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
    const got: { t: string; char?: { commands?: { epoch: string; sequence: number } } }[] = [];
    ws.on('message', (d: Buffer) => { try { got.push(packr.unpack(d)); } catch { /* ignore */ } });
    await new Promise<void>((res, rej) => { ws.once('open', () => res()); ws.once('error', rej); });
    ws.send(packr.pack({ t: 'hello', name: 'TelemetryHero', classId: 'mage', v: PROTOCOL_VERSION }));
    while (!got.some(m => m.t === 'welcome')) await new Promise(r => setTimeout(r, 20));
    await new Promise(r => setTimeout(r, 1500));            // let one observation establish the baseline
    const commands = got.find(m => m.t === 'welcome')!.char!.commands!;
    const request = { epoch: commands.epoch, sequence: commands.sequence, token: randomBytes(16).toString('hex') };
    ws.send(packr.pack({ t: 'cmd', id: 1, op: 'debug', a: { op: 'level', n: 3 }, r: request }));
    await new Promise(r => setTimeout(r, 2500));            // the next per-second observation logs the levels
    ws.close();
    await new Promise(r => setTimeout(r, 1500));            // logout is processed
    child.send('hearthfall:shutdown');
  } finally {
    const timer = setTimeout(() => child.kill('SIGKILL'), 9000);
    await closed; clearTimeout(timer);
  }
  const dir = path.join(saves, 'telemetry');
  const files = await fs.readdir(dir);
  assert.equal(files.length, 1, `one day file, got ${files}; server log:\n${log.slice(-600)}`);
  const events = (await fs.readFile(path.join(dir, files[0]), 'utf8')).trim().split('\n').map(l => JSON.parse(l) as StoredEvent);
  assert.equal(events[0].e, 'login');
  assert.equal(events[0].fresh, true);
  assert.deepEqual(events.filter(e => e.e === 'level').map(e => e.lvl), [2, 3, 4]);
  assert.equal(events.at(-1)!.e, 'logout');
  assert.match(summarize(events), /\| telemetryhero \| mage \| 4 \|/);
});
