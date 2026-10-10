import { closest, groundBoundary, groundTester, type Edge } from './townGeometry';
import type { GroundGeometry } from './townGeometry';

const CELL = 128, SKIN = .0001;
interface Shape extends Edge { dynamic: boolean; stamp: number }

/** Continuous authored-ground collision. The legacy field/rift solver stays unchanged. */
export class TownCollision {
  readonly edges: readonly Edge[];
  private cells = new Map<number, Shape[]>();
  private scratch: Shape[] = [];
  private stamp = 0;
  private contact = { time: 1, nx: 0, ny: 0, found: false };
  private readonly ground: (x: number, y: number) => boolean;
  constructor(readonly data: GroundGeometry) {
    this.ground = groundTester(data);
    this.edges = groundBoundary(data);
    for (const e of this.edges) this.add({ ...e, dynamic: false, stamp: 0 });
    for (const b of data.barriers) this.add({ ax: b.a[0], ay: b.a[1], bx: b.b[0], by: b.b[1], nx: 0, ny: 0, radius: b.radius, dynamic: false, stamp: 0 });
    for (const p of data.props) this.addCircle(p.x, p.y, p.radius, false);
    for (const n of data.npcs) this.addCircle(n.x, n.y, n.r, true);
  }
  addCircle(x: number, y: number, r: number, dynamic = true) {
    this.add({ ax: x, ay: y, bx: x, by: y, nx: 0, ny: 0, radius: r, dynamic, stamp: 0 });
  }
  private add(s: Shape) {
    for (let y = Math.floor((Math.min(s.ay, s.by) - s.radius) / CELL); y <= Math.floor((Math.max(s.ay, s.by) + s.radius) / CELL); y++) {
      for (let x = Math.floor((Math.min(s.ax, s.bx) - s.radius) / CELL); x <= Math.floor((Math.max(s.ax, s.bx) + s.radius) / CELL); x++) {
        const key = y * 65536 + x, a = this.cells.get(key); if (a) a.push(s); else this.cells.set(key, [s]);
      }
    }
  }
  private query(x0: number, y0: number, x1: number, y1: number): Shape[] {
    this.scratch.length = 0; const stamp = ++this.stamp;
    for (let y = Math.floor(y0 / CELL); y <= Math.floor(y1 / CELL); y++) for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) {
      const cell = this.cells.get(y * 65536 + x); if (!cell) continue;
      for (const s of cell) if (s.stamp !== stamp) { s.stamp = stamp; this.scratch.push(s); }
    }
    return this.scratch;
  }
  isFree(x: number, y: number, r: number, ignoreNpcs = false): boolean {
    if (!this.ground(x, y)) return false;
    for (const e of this.query(x - r, y - r, x + r, y + r)) {
      if (ignoreNpcs && e.dynamic) continue;
      const dx = e.bx - e.ax, dy = e.by - e.ay;
      const t = Math.max(0, Math.min(1, ((x - e.ax) * dx + (y - e.ay) * dy) / (dx * dx + dy * dy || 1)));
      const qx = e.ax + t * dx, qy = e.ay + t * dy;
      if ((x - qx) ** 2 + (y - qy) ** 2 < (r + e.radius - 1e-7) ** 2) return false;
    }
    return true;
  }
  resolve(x: number, y: number, r: number, ignoreNpcs = false): { x: number; y: number } {
    if (this.isFree(x, y, r, ignoreNpcs)) return { x, y };
    // Used for spawn/recovery, never to advance a movement step through a wall.
    let bestX = this.data.entry.x, bestY = this.data.entry.y, best = Infinity;
    const candidates: [number, number][] = [];
    for (const e of this.edges) { const q = closest(x, y, e); candidates.push([q[0] + e.nx * (r + SKIN), q[1] + e.ny * (r + SKIN)]); }
    for (const e of this.query(x - r - 128, y - r - 128, x + r + 128, y + r + 128)) {
      if (ignoreNpcs && e.dynamic) continue;
      const q = closest(x, y, e), dx = x - q[0], dy = y - q[1], l = Math.hypot(dx, dy);
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        candidates.push([q[0] + (r + e.radius + SKIN) * (i === 0 && l ? dx / l : Math.cos(a)), q[1] + (r + e.radius + SKIN) * (i === 0 && l ? dy / l : Math.sin(a))]);
      }
    }
    for (const [cx, cy] of candidates) {
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < best && this.isFree(cx, cy, r, ignoreNpcs)) { best = d; bestX = cx; bestY = cy; }
    }
    return { x: bestX, y: bestY };
  }
  private accept(t: number, ax: number, ay: number, dx: number, dy: number) {
    if (t < -1e-8 || t > this.contact.time || dx * ax + dy * ay >= -1e-9) return;
    this.contact.time = Math.max(0, t); this.contact.nx = ax; this.contact.ny = ay; this.contact.found = true;
  }
  private hit(x: number, y: number, dx: number, dy: number, r: number, ignoreNpcs: boolean) {
    this.contact.time = 1; this.contact.nx = this.contact.ny = 0; this.contact.found = false;
    for (const e of this.query(Math.min(x, x + dx) - r, Math.min(y, y + dy) - r, Math.max(x, x + dx) + r, Math.max(y, y + dy) + r)) {
      if (ignoreNpcs && e.dynamic) continue;
      const radius = r + e.radius, ex = e.bx - e.ax, ey = e.by - e.ay, len = Math.hypot(ex, ey);
      if (len > 1e-8) {
        for (let side = 1; side >= -1; side -= 2) {
          const ax = -ey / len * side, ay = ex / len * side;
          if ((e.nx || e.ny) && ax * e.nx + ay * e.ny < .5) continue;
          const speed = dx * ax + dy * ay; if (speed >= -1e-9) continue;
          const t = (radius - ((x - e.ax) * ax + (y - e.ay) * ay)) / speed;
          const u = ((x + dx * t - e.ax) * ex + (y + dy * t - e.ay) * ey) / (len * len);
          if (u >= 0 && u <= 1) this.accept(t, ax, ay, dx, dy);
        }
      }
      const aa = dx * dx + dy * dy;
      if (aa < 1e-12) continue;
      for (let endpoint = 0; endpoint < (len > 1e-8 ? 2 : 1); endpoint++) {
        const cx = endpoint ? e.bx : e.ax, cy = endpoint ? e.by : e.ay;
        const ox = x - cx, oy = y - cy, b = ox * dx + oy * dy, c = ox * ox + oy * oy - radius * radius;
        const disc = b * b - aa * c; if (disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / aa;
        const hx = x + t * dx - cx, hy = y + t * dy - cy, hl = Math.hypot(hx, hy);
        if (hl > 1e-9) this.accept(t, hx / hl, hy / hl, dx, dy);
      }
    }
    return this.contact;
  }
  moveCircle(x: number, y: number, r: number, dx: number, dy: number, ignoreNpcs = false): { x: number; y: number } {
    if (!this.isFree(x, y, r, ignoreNpcs)) ({ x, y } = this.resolve(x, y, r, ignoreNpcs));
    for (let i = 0; i < 5 && Math.hypot(dx, dy) > 1e-8; i++) {
      const hit = this.hit(x, y, dx, dy, r, ignoreNpcs);
      if (!hit.found) { x += dx; y += dy; break; }
      const t = Math.max(0, hit.time - SKIN / Math.hypot(dx, dy));
      x += dx * t; y += dy * t;
      dx *= 1 - t; dy *= 1 - t;
      const dot = dx * hit.nx + dy * hit.ny;
      if (dot < 0) { dx -= dot * hit.nx; dy -= dot * hit.ny; }
    }
    return { x, y };
  }
  /** Continuous body sweep without sliding, for committed straight-line attacks. */
  circlePathBlocked(x: number, y: number, r: number, dx: number, dy: number): boolean {
    return !this.isFree(x, y, r) || this.hit(x, y, dx, dy, r, false).found;
  }
  segmentBlocked(x0: number, y0: number, x1: number, y1: number): boolean {
    // NPC bodies are excluded: a service/dummy is itself the target of the ray.
    return !this.isFree(x0, y0, .001, true) || !this.isFree(x1, y1, .001, true) || this.hit(x0, y0, x1 - x0, y1 - y0, .001, true).found;
  }
}
