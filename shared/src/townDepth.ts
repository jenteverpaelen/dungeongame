import type { Point } from './townTypes';

/** Frontmost intersection with an authored baseline, independent of the viewing player. */
export function baselineY(points: readonly Point[], x: number): number {
  let front = -Infinity, nearest = Infinity, end = points[0]?.[1] ?? 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], distance = Math.abs(x - a[0]);
    if (distance < nearest) { nearest = distance; end = a[1]; }
    if (!i) continue;
    const b = points[i - 1], dx = a[0] - b[0];
    if (x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
    front = Math.max(front, Math.abs(dx) < 1e-8 ? Math.max(a[1], b[1]) : b[1] + (x - b[0]) / dx * (a[1] - b[1]));
  }
  return Number.isFinite(front) ? front : end;
}
