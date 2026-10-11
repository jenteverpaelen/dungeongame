// F-TEL-04: the local event log has a schema, a retention period and per-character export/erasure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EVENT_SCHEMA, Telemetry, diffEvents, observe, parseRetentionDays, sanitizeEvent } from '../src/telemetry';
import { createCharacter } from '../../shared/src/character';
import { writeQuestState } from '../../shared/src/quests';

assert.ok(process.env.DATA_DIR, 'Telemetry checks require an isolated DATA_DIR');
const DAY = 86_400_000;

test('every event the server produces fits the schema exactly', () => {
  const save = createCharacter('Schema', 'mage', 3);
  const a = observe(save, 'hearthmere', 1000);
  save.level = 3; save.stats.deaths = 1; save.stats.legendaries = 1;
  writeQuestState(save, 'high_water', { revision: 1, step: 0, claimed: false });
  const events = diffEvents(a, observe(save, 'rillwake_crossing', 9000), 'schema');
  assert.ok(events.length >= 5);
  for (const ev of events) assert.deepEqual(sanitizeEvent(ev), ev, `${ev.e} passes unchanged`);
  const login = { e: 'login', c: 'schema', fresh: true, cls: 'mage', lvl: 1, playMs: 0, afkMs: 5, afkKills: 1, afkLevels: 0 };
  assert.deepEqual(sanitizeEvent(login), login);
  assert.deepEqual(Object.keys(EVENT_SCHEMA).sort(), ['death', 'legendary', 'level', 'login', 'logout', 'quest', 'zone']);
});

test('unknown events, unknown fields, wrong types and bad ids are refused or stripped', () => {
  assert.equal(sanitizeEvent({ e: 'chat', c: 'x', text: 'hello' }), null, 'no unlisted event kinds (e.g. chat) can be logged');
  assert.deepEqual(sanitizeEvent({ e: 'death', c: 'x', n: 1, ip: '203.0.113.5', password: 'p' }), { e: 'death', c: 'x', n: 1 }, 'unlisted fields are dropped');
  assert.equal(sanitizeEvent({ e: 'death', c: 'x', n: 'one' }), null);
  assert.equal(sanitizeEvent({ e: 'death', c: 'x', n: Number.NaN }), null);
  assert.equal(sanitizeEvent({ e: 'death', c: '../etc', n: 1 }), null);
  assert.equal((sanitizeEvent({ e: 'zone', c: 'x', from: 'a'.repeat(200) })!.from as string).length, 40);
});

test('retention removes whole day files older than the limit, and the setting is validated', async () => {
  assert.equal(parseRetentionDays(undefined), 30);
  assert.equal(parseRetentionDays('7'), 7);
  for (const bad of ['0', '-1', '1.5', 'x']) assert.throws(() => parseRetentionDays(bad));
  const dir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'tel-ret-'));
  const now = Date.UTC(2026, 9, 11, 12);
  for (const daysAgo of [0, 6, 7, 8, 40]) await fs.writeFile(path.join(dir, `events-${new Date(now - daysAgo * DAY).toISOString().slice(0, 10)}.jsonl`), '{}\n');
  await fs.writeFile(path.join(dir, 'notes.txt'), 'not a day file');
  const t = new Telemetry(dir, false, () => now, 7);
  assert.equal(await t.prune(), 2);
  assert.deepEqual((await fs.readdir(dir)).sort(), ['events-2026-10-04.jsonl', 'events-2026-10-05.jsonl', 'events-2026-10-11.jsonl', 'notes.txt']);
});

test('a character can be exported and scrubbed, including events still in the buffer', async () => {
  const dir = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'tel-scrub-'));
  const t = new Telemetry(dir, true);
  for (const c of ['alpha', 'beta', 'alpha']) t.log({ e: 'death', c, n: 1, lvl: 1, playMs: 1, zone: 'z' });
  await t.flush();
  t.log({ e: 'death', c: 'alpha', n: 2, lvl: 1, playMs: 2, zone: 'z' }); // buffered, not yet written
  assert.equal((await t.eventsFor(['alpha'])).length, 3, 'export flushes first');
  t.log({ e: 'death', c: 'alpha', n: 3, lvl: 1, playMs: 3, zone: 'z' });
  assert.equal(await t.scrub(['alpha']), 3);
  await t.flush();
  assert.deepEqual((await t.eventsFor(['alpha', 'beta'])).map(e => e.c), ['beta']);
  assert.equal(t.rejected, 0);
  t.log({ e: 'unknown', c: 'alpha' });
  assert.equal(t.rejected, 1);
});

// ───────────────── F-TEL-05: owner analytics ─────────────────
import { analytics, renderAnalyticsHtml } from '../src/telemetryAnalytics';
import type { StoredEvent } from '../src/telemetry';

test('analytics: funnel, sessions, return rate, level pace and a self-contained, escaped HTML page', () => {
  const t0 = Date.UTC(2026, 9, 10, 18);
  const ev = (min: number, c: string, e: string, extra: Record<string, unknown> = {}): StoredEvent => ({ t: t0 + min * 60_000, c, e, ...extra });
  const events: StoredEvent[] = [
    ev(0, 'ann', 'login', { fresh: true, lvl: 1, playMs: 0 }), ev(3, 'ann', 'level', { lvl: 2, playMs: 180_000 }), ev(20, 'ann', 'level', { lvl: 5, playMs: 1_200_000 }),
    ev(25, 'ann', 'quest', { q: 'q1', a: 'claim' }), ev(40, 'ann', 'logout', {}), ev(1500, 'ann', 'login', { fresh: false }), ev(1510, 'ann', 'logout', {}),
    ev(0, 'bob', 'login', { fresh: true }), ev(2, 'bob', 'logout', {}),
    ev(0, 'old', 'login', { fresh: false }), ev(9, 'old', 'death', { zone: '<b>zone</b>', n: 2 }), ev(70, 'old', 'logout', {}),
  ];
  const a = analytics(events);
  assert.equal(a.characters, 3);
  assert.equal(a.fresh, 2);
  assert.deepEqual(a.funnel.map(s => s.reached), [2, 1, 1, 1, 0, 1, 0]);
  assert.equal(a.sessions.count, 4);
  assert.deepEqual(a.sessions.buckets.map(b => b.count), [1, 1, 0, 1, 1, 0]);
  assert.deepEqual([a.returning.secondSession, a.returning.laterDay, a.returning.of], [1, 1, 3]);
  assert.deepEqual(a.levelPace.map(r => [r.level, r.medianMin]), [[2, 3], [5, 20]]);
  assert.deepEqual(a.deathsByZone, [{ zone: '<b>zone</b>', deaths: 2 }]);
  const html = renderAnalyticsHtml(a);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(!/<script[^>]+src=/.test(html) && !/<link[^>]+href=/.test(html) && !/https?:\/\//.test(html), 'no external resources');
  assert.ok(html.includes('&lt;b&gt;zone&lt;/b&gt;') && !html.includes('<b>zone</b>'), 'names are escaped');
  assert.match(renderAnalyticsHtml(analytics([])), /No data in this log yet/);
});
