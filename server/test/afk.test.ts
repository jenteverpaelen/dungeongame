// Offline gains v2 (F-MET-02): own measured rate capped by the measured band median, live drop rules per kill,
// deterministic, capped, per character; splitting an absence never earns more; the rate table matches the baseline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCharacter } from '../../shared/src/character';
import { AFK_EFFICIENCY, AFK_MAX_HOURS } from '../../shared/src/constants';
import { AFK_BAND_KPM } from '../../shared/src/data/afkRates';
import { NORMAL_GOLD_DROP_CHANCE, baseGoldAmount, rollDrops } from '../../shared/src/items';
import { salvageYield } from '../../shared/src/cube';
import { Rng } from '../../shared/src/math';
import type { CharacterSave } from '../../shared/src/types';
import { FieldRateMeter, LEGACY_KILLS_PER_MINUTE, afkRate, applyAfkGains, bandKillsPerMinute, normalizeAfkRate, salvagePerKill } from '../src/afk';
import { afkTable, type MetricsReport } from '../../scripts/bot-metrics';

assert.ok(process.env.DATA_DIR, 'Use an isolated DATA_DIR');
const H = 3_600_000, NOW = 1_800_000_000_000;
function hero(level: number, zone = 'ashen_hollow', awayMs = 2 * H): CharacterSave {
  const s = createCharacter(`Away${level}`, 'ranger', level);
  s.level = level; s.lastZone = zone; s.lastSeen = NOW - awayMs; return s;
}

test('the band table is the committed bot-metrics baseline', () => {
  const base = JSON.parse(fs.readFileSync(new URL('../../docs/rework/partials/bot-metrics/baseline.json', import.meta.url), 'utf8')) as MetricsReport;
  assert.deepEqual(afkTable(base), AFK_BAND_KPM.map(([l, k]) => [l, k]));
  assert.equal(bandKillsPerMinute(1), AFK_BAND_KPM[0][1]); assert.equal(bandKillsPerMinute(12), AFK_BAND_KPM[2][1]);
  assert.equal(bandKillsPerMinute(70), AFK_BAND_KPM.at(-1)![1], 'beyond the measured levels the last band holds');
});

test('own measured rate is used, never above the band median; legacy saves keep the old assumption capped', () => {
  const s = hero(20);
  assert.deepEqual(afkRate(s), { rate: LEGACY_KILLS_PER_MINUTE, basis: 'assumed', bandCap: bandKillsPerMinute(20) });
  assert.equal(afkRate(hero(12)).rate, bandKillsPerMinute(12), 'band below 60: the band wins');
  s.afk = { rate: 31.5, level: 20, at: NOW - 3 * H };
  assert.deepEqual(afkRate(s), { rate: 31.5, basis: 'own', bandCap: bandKillsPerMinute(20) });
  s.afk.rate = 5000;
  assert.equal(afkRate(s).rate, bandKillsPerMinute(20), 'a burst session cannot exceed the measured band median');
  const r = applyAfkGains(s, NOW)!;
  assert.equal(r.kills, Math.floor(120 * bandKillsPerMinute(20) * AFK_EFFICIENCY));
  assert.equal(r.basis, 'own'); assert.equal(r.efficiency, AFK_EFFICIENCY); assert.equal(r.capped, false);
});

test('gains per kill follow the live ordinary-kill rules (Monte Carlo of rollDrops + salvage)', () => {
  for (const level of [10, 30, 60]) {
    const rng = new Rng(4040 + level), n = 400_000;
    let gold = 0; const mats = { scrap: 0, dust: 0, crystal: 0 };
    for (let i = 0; i < n; i++) {
      const { drops } = rollDrops(rng, { level, difficulty: 0, elite: 0, classId: 'ranger', magicFind: 0, pity: 0, inRift: false }, 0);
      for (const d of drops) {
        if (d.type === 'gold') gold += d.amount;
        if (d.type === 'item' && d.item.rarity !== 'legendary' && d.item.rarity !== 'set') for (const [k, v] of Object.entries(salvageYield(d.item))) if (k in mats) mats[k as keyof typeof mats] += v ?? 0;
      }
    }
    const goldPer = NORMAL_GOLD_DROP_CHANCE * baseGoldAmount(level);
    assert.ok(Math.abs(gold / n / goldPer - 1) < 0.03, `L${level} gold per kill ${gold / n} vs ${goldPer}`);
    const exp = salvagePerKill(level);
    for (const k of ['scrap', 'dust', 'crystal'] as const) {
      const got = mats[k] / n;
      assert.ok(Math.abs(got - exp[k]) <= Math.max(0.08 * exp[k], 0.0003), `L${level} ${k} per kill ${got} vs ${exp[k]}`);
    }
  }
});

test('deterministic, capped at the maximum, nothing in town, dungeons or after a short absence', () => {
  const realRandom = Math.random;
  Math.random = () => { throw new Error('offline gains must not roll'); };
  try {
    const a = applyAfkGains(hero(40, 'ashen_hollow', 100 * H), NOW)!, b = applyAfkGains(hero(40, 'ashen_hollow', 100 * H), NOW)!;
    assert.deepEqual(a, b);
    assert.equal(a.ms, AFK_MAX_HOURS * H); assert.equal(a.capped, true);
    assert.deepEqual(applyAfkGains(hero(40, 'ashen_hollow', AFK_MAX_HOURS * H), NOW)!.kills, a.kills);
  } finally { Math.random = realRandom; }
  assert.equal(applyAfkGains(hero(20, 'hearthmere'), NOW), null);
  assert.equal(applyAfkGains(hero(20, 'reedvault_pumpworks'), NOW), null, 'dungeons do not farm while away');
  assert.equal(applyAfkGains(hero(20, 'ashen_hollow', 2 * 60_000), NOW), null);
});

test('splitting an absence into several logins never earns more than one long absence', () => {
  for (const level of [8, 33, 70]) {
    const whole = hero(level, 'ashen_hollow', 6 * H);
    const w = applyAfkGains(whole, NOW)!;
    const parts = hero(level, 'ashen_hollow', 6 * H);
    const sum = { kills: 0, gold: 0, xp: 0, scrap: 0, dust: 0, crystal: 0 };
    let t = parts.lastSeen;
    for (let i = 0; i < 24; i++) {
      t += 15 * 60_000;
      const r = applyAfkGains(parts, t)!; parts.lastSeen = t; // log in, log straight out again
      sum.kills += r.kills; sum.gold += r.gold; sum.xp += r.xp;
      for (const k of ['scrap', 'dust', 'crystal'] as const) sum[k] += r.mats[k] ?? 0;
    }
    assert.ok(sum.kills <= w.kills, `L${level} kills ${sum.kills} ≤ ${w.kills}`);
    assert.ok(sum.gold <= w.gold, `L${level} gold ${sum.gold} ≤ ${w.gold}`);
    if (whole.level === parts.level) assert.ok(sum.xp <= w.xp, `L${level} xp ${sum.xp} ≤ ${w.xp}`);
    for (const k of ['scrap', 'dust', 'crystal'] as const) assert.ok(sum[k] <= (w.mats[k] ?? 0), `L${level} ${k}`);
  }
});

test('each character measures and uses only its own rate; short or town-only sessions measure nothing', () => {
  const main = hero(30), alt = hero(30);
  const meter = new FieldRateMeter();
  let kills = 0;
  for (let s = 0; s <= 6 * 60; s++) { meter.sample(NOW + s * 1000, true, kills); if (s % 2 === 0) kills++; }
  assert.equal(meter.record(main, NOW + 361_000), true);
  assert.ok(Math.abs(main.afk!.rate - 30) < 0.5, `about 30 kills a minute (${main.afk!.rate})`);
  assert.equal(alt.afk, undefined, 'the alt is untouched');
  assert.equal(afkRate(alt).basis, 'assumed');
  const town = new FieldRateMeter();
  for (let s = 0; s <= 600; s++) town.sample(NOW + s * 1000, false, s);
  assert.equal(town.record(alt, NOW), false); assert.equal(alt.afk, undefined);
  const short = new FieldRateMeter();
  for (let s = 0; s <= 120; s++) short.sample(NOW + s * 1000, true, s);
  assert.equal(short.record(alt, NOW), false, 'two minutes are not enough');
  const stalled = new FieldRateMeter();
  stalled.sample(NOW, true, 0); stalled.sample(NOW + 30 * 60_000, true, 10); // one 30-minute gap counts as 5 s
  assert.equal(stalled.record(alt, NOW), false);
});

test('a stored rate survives loading only when valid', () => {
  const s = hero(10);
  s.afk = { rate: 12.5, level: 10, at: NOW }; normalizeAfkRate(s); assert.deepEqual(s.afk, { rate: 12.5, level: 10, at: NOW });
  for (const bad of [{ rate: -1, level: 1, at: 0 }, { rate: 'x', level: 1, at: 0 }, { rate: 1e9, level: 1, at: 0 }, null]) {
    (s as { afk: unknown }).afk = bad; normalizeAfkRate(s); assert.equal(s.afk, undefined, JSON.stringify(bad));
  }
});
