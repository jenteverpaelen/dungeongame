// Measured active kill rates for offline gains (F-MET-02). Generated from docs/rework/partials/bot-metrics/baseline.json
// by `npx tsx scripts/bot-metrics.ts afk-table` — do not edit by hand; server/test/afk.test.ts checks it matches.
// Median over the three classes of the engaged leveling bot's kills per minute in each five-level band [M]
// (an upper bound for human play: the bot never goes back to town).
export const AFK_BAND_KPM: readonly (readonly [fromLevel: number, killsPerMinute: number])[] = [
  [1, 77.2],
  [5, 93.2],
  [10, 56.2],
  [15, 88.2],
  [20, 80.2],
  [25, 84.4],
  [30, 102.4],
  [35, 91],
  [40, 114.9],
];
