// Number formatting for floating combat text and tooltips.
// Diablo 3 abbreviates large damage numbers (e.g. "1.24M", "3.8B"); tooltips use full digits.

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Compact: 950 -> "950", 12_345 -> "12.3K", 1_240_000 -> "1.24M". Three significant digits. */
export function fmtCompact(n: number): string {
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  let v = Math.abs(n);
  if (v < 10_000) return (neg ? '-' : '') + Math.round(v).toString();
  let i = 0;
  while (v >= 1000 && i < SUFFIXES.length - 1) { v /= 1000; i++; }
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return (neg ? '-' : '') + s.replace(/\.0+$/, '') + SUFFIXES[i];
}

// Number#toLocaleString(locale, options) is specified as new Intl.NumberFormat(locale, options).format(n): building the
// formatter is the expensive part (about 1 ms on a 4×-throttled CPU), and the HUD formats several numbers ten times a
// second, so the formatters are built once. Output is identical.
const INT_FMT = new Intl.NumberFormat('en-US');
const NUM_FMT = new Map<number, Intl.NumberFormat>();

/** Full with thousands separators: 1234567 -> "1,234,567". */
export function fmtInt(n: number): string {
  return INT_FMT.format(Math.round(n));
}

/** Fixed decimals with separators: (1234.5, 1) -> "1,234.5". */
export function fmtNum(n: number, decimals = 1): string {
  let f = NUM_FMT.get(decimals);
  if (!f) { f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); NUM_FMT.set(decimals, f); }
  return f.format(n);
}

export function fmtPct(n: number, decimals = 1): string {
  return `${fmtNum(n, decimals)}%`;
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}
