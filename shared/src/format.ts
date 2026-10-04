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

/** Full with thousands separators: 1234567 -> "1,234,567". */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Fixed decimals with separators: (1234.5, 1) -> "1,234.5". */
export function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
