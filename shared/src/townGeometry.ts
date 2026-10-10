import type { Point } from './townTypes';

/** Structural geometry shared by authored towns and adventure fields. */
export interface GroundGeometry {
  entry: { x: number; y: number };
  floors: { polygon: Point[] }[];
  buildings: { footprint: Point[]; interior?: { floors: Point[][] } }[];
  barriers: { a: Point; b: Point; radius: number }[];
  props: { x: number; y: number; radius: number }[];
  npcs: { x: number; y: number; r: number }[];
}

export interface Edge { ax: number; ay: number; bx: number; by: number; nx: number; ny: number; radius: number }
export function inPolygon(x: number, y: number, p: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function onFloor(t: GroundGeometry, x: number, y: number): boolean { for (const f of t.floors) if (inPolygon(x, y, f.polygon)) return true; return false; }
export function inGround(t: GroundGeometry, x: number, y: number): boolean {
  for(const b of t.buildings)if(b.interior?.floors.some(p=>inPolygon(x,y,p)))return true;
  if (!onFloor(t, x, y)) return false;
  for (const b of t.buildings) if (inPolygon(x, y, b.footprint)) return false;
  return true;
}
/** Same answer as `inGround`, but each polygon is only tested where its bounding box can contain the point (a 256 u
 *  grid of candidate lists). Large authored zones call this for every movement and validation sample. */
export function groundTester(t: GroundGeometry): (x: number, y: number) => boolean {
  const CELL = 256, cells = new Map<number, { floors: number[]; solids: number[]; interiors: [number, number][] }>();
  const at = (cx: number, cy: number) => { const k = cy * 65536 + cx; let c = cells.get(k); if (!c) cells.set(k, c = { floors: [], solids: [], interiors: [] }); return c; };
  const each = (p: readonly Point[], add: (c: { floors: number[]; solids: number[]; interiors: [number, number][] }) => void) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) add(at(cx, cy));
  };
  t.floors.forEach((f, i) => each(f.polygon, (c) => c.floors.push(i)));
  t.buildings.forEach((b, i) => { each(b.footprint, (c) => c.solids.push(i)); b.interior?.floors.forEach((p, j) => each(p, (c) => c.interiors.push([i, j]))); });
  return (x, y) => {
    const c = cells.get(Math.floor(y / CELL) * 65536 + Math.floor(x / CELL));
    if (!c) return false;
    for (const [i, j] of c.interiors) if (inPolygon(x, y, t.buildings[i].interior!.floors[j])) return true;
    let floor = false;
    for (const i of c.floors) if (inPolygon(x, y, t.floors[i].polygon)) { floor = true; break; }
    if (!floor) return false;
    for (const i of c.solids) if (inPolygon(x, y, t.buildings[i].footprint)) return false;
    return true;
  };
}
export function closest(x: number, y: number, e: Edge): Point {
  const dx = e.bx - e.ax, dy = e.by - e.ay;
  const t = Math.max(0, Math.min(1, ((x - e.ax) * dx + (y - e.ay) * dy) / (dx * dx + dy * dy || 1)));
  return [e.ax + t * dx, e.ay + t * dy];
}
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/** Boundary of the union of authored floors minus solid footprints. Split intersections before
 * classifying both sides: internal road seams are never collision walls. Normals point to free ground. */
export function groundBoundary(t: GroundGeometry): Edge[] {
  const raw: Edge[] = [];
  for (const p of [...t.floors.map(f => f.polygon), ...t.buildings.map(b => b.footprint), ...t.buildings.flatMap(b=>b.interior?.floors??[])]) {
    p.forEach((a, i) => { const b = p[(i + 1) % p.length]; raw.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], nx: 0, ny: 0, radius: 0 }); });
  }
  const result: Edge[] = [], seen = new Set<string>(), ground = groundTester(t), inGround = (_: GroundGeometry, x: number, y: number) => ground(x, y);
  // Only edges whose boxes touch can cut each other (cheap rejection; identical cuts).
  const box = raw.map((e) => [Math.min(e.ax, e.bx) - 1e-6, Math.min(e.ay, e.by) - 1e-6, Math.max(e.ax, e.bx) + 1e-6, Math.max(e.ay, e.by) + 1e-6]);
  for (const [ei, e] of raw.entries()) {
    const dx = e.bx - e.ax, dy = e.by - e.ay, l = Math.hypot(dx, dy);
    if (l < 1e-7) continue;
    const cuts = [0, 1], eb = box[ei];
    for (const [oi, o] of raw.entries()) {
      const ob = box[oi];
      if (ob[0] > eb[2] || ob[2] < eb[0] || ob[1] > eb[3] || ob[3] < eb[1]) continue;
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
