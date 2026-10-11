// Measured active kill rates for offline gains (F-MET-02). Generated from docs/rework/partials/bot-metrics/baseline.json
// by `npx tsx scripts/bot-metrics.ts afk-table` — do not edit by hand; server/test/afk.test.ts checks it matches.
// Median over the three classes of the engaged leveling bot's kills per minute in each five-level band [M]
// (an upper bound for human play: the bot never goes back to town).
export const AFK_BAND_KPM: readonly (readonly [fromLevel: number, killsPerMinute: number])[] = [
  [1, 90.2],
  [5, 101.9],
  [10, 53.5],
  [15, 96.4],
  [20, 118.6],
  [25, 86.4],
  [30, 98.2],
  [35, 100],
  [40, 101.3],
];
