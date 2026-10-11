import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtInt, fmtNum, fmtPct } from '../src/format';

// The cached Intl formatters (docs/rework/PERF.md §HUD) must print exactly what Number#toLocaleString printed.
const VALUES = [0, -0, 0.4, 0.5, 1.5, -2.5, 7, 999, 1000, 1234.5678, -98765.4321, 1e6, 123456789, 2 ** 40, Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity];

test('fmtInt matches Math.round(n).toLocaleString("en-US")', () => {
  for (const v of VALUES) assert.equal(fmtInt(v), Math.round(v).toLocaleString('en-US'), String(v));
});

test('fmtNum / fmtPct match toLocaleString with fixed decimals', () => {
  for (const d of [0, 1, 2, 3]) for (const v of VALUES) {
    const want = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    assert.equal(fmtNum(v, d), want, `${v} @${d}`);
    assert.equal(fmtPct(v, d), `${want}%`);
  }
  assert.equal(fmtNum(1234.5), '1,234.5', 'default: one decimal');
});
