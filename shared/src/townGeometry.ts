import type { Point, TownData } from './townTypes';

export interface Edge { ax: number; ay: number; bx: number; by: number; nx: number; ny: number; radius: number }
export function inPolygon(x: number, y: number, p: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function onFloor(t: TownData, x: number, y: number): boolean { return t.floors.some(f => inPolygon(x, y, f.polygon)); }
export function inGround(t: TownData, x: number, y: number): boolean {
  return onFloor(t, x, y) && !t.buildings.some(b => inPolygon(x, y, b.footprint));
}
export function closest(x: number, y: number, e: Edge): Point {
  const dx = e.bx - e.ax, dy = e.by - e.ay;
  const t = Math.max(0, Math.min(1, ((x - e.ax) * dx + (y - e.ay) * dy) / (dx * dx + dy * dy || 1)));
  return [e.ax + t * dx, e.ay + t * dy];
}
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/** Boundary of the union of authored floors minus solid footprints. Split intersections before
 * classifying both sides: internal road seams are never collision walls. Normals point to free ground. */
export function groundBoundary(t: TownData): Edge[] {
  const raw: Edge[] = [];
  for (const p of [...t.floors.map(f => f.polygon), ...t.buildings.map(b => b.footprint)]) {
    p.forEach((a, i) => { const b = p[(i + 1) % p.length]; raw.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], nx: 0, ny: 0, radius: 0 }); });
  }
  const result: Edge[] = [], seen = new Set<string>();
  for (const e of raw) {
    const dx = e.bx - e.ax, dy = e.by - e.ay, l = Math.hypot(dx, dy);
    if (l < 1e-7) continue;
    const cuts = [0, 1];
    for (const o of raw) {
      const ox = o.bx - o.ax, oy = o.by - o.ay, qx = o.ax - e.ax, qy = o.ay - e.ay;
      const den = cross(dx, dy, ox, oy);
      if (Math.abs(den) > 1e-7) {
        const a = cross(qx, qy, ox, oy) / den, b = cross(qx, qy, dx, dy) / den;
        if (a > 0 && a < 1 && b >= -1e-8 && b <= 1 + 1e-8) cuts.push(a);
      } else if (Math.abs(cross(qx, qy, dx, dy)) < 1e-5) {
        for (const [x, y] of [[o.ax, o.ay], [o.bx, o.by]]) {
          const a = ((x - e.ax) * dx + (y - e.ay) * dy) / (l * l);
          if (a > 0 && a < 1) cuts.push(a);
        }
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1], b = cuts[i]; if ((b - a) * l < 1e-5) continue;
      const mx = e.ax + (a + b) * .5 * dx, my = e.ay + (a + b) * .5 * dy;
      let nx = -dy / l, ny = dx / l;
      const left = inGround(t, mx + nx * .001, my + ny * .001), right = inGround(t, mx - nx * .001, my - ny * .001);
      if (left === right) continue;
      if (!left) { nx = -nx; ny = -ny; }
      const ax = e.ax + a * dx, ay = e.ay + a * dy, bx = e.ax + b * dx, by = e.ay + b * dy;
      const key = [[ax, ay].map(v => v.toFixed(4)).join(','), [bx, by].map(v => v.toFixed(4)).join(',')].sort().join(':');
      if (!seen.has(key)) { seen.add(key); result.push({ ax, ay, bx, by, nx, ny, radius: 0 }); }
    }
  }
  return result;
}
