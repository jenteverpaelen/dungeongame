// Collision and player movement. Shared so the client can predict its own movement with the exact
// same rules the authoritative server applies (client-side prediction + reconciliation).

import { BASE_MOVE_SPEED, DASH, TILE } from './constants';
import { isBlockedTile, type MapData } from './mapgen';
import { TownCollision } from './townCollision';

interface Collider { x: number; y: number; r: number }

const CELL = 128;

export class CollisionWorld {
  readonly w: number;
  readonly h: number;
  readonly tiles: Uint8Array;
  private cells = new Map<number, Collider[]>();
  readonly widthPx: number;
  readonly heightPx: number;
  readonly town?: TownCollision;

  constructor(map: MapData) {
    this.w = map.w;
    this.h = map.h;
    this.tiles = map.tiles;
    this.widthPx = map.w * TILE;
    this.heightPx = map.h * TILE;
    if (map.town) { this.town = new TownCollision(map.town); return; }
    if (map.adventure) { this.town = new TownCollision(map.adventure.geometry); return; }
    for (const p of map.props) if (p.r > 0) this.addCollider({ x: p.x, y: p.y, r: p.r * (p.s || 1) });
    for (const n of map.npcs) this.addCollider({ x: n.x, y: n.y, r: n.r });
  }

  private key(cx: number, cy: number) { return cy * 4096 + cx; }

  addCollider(c: Collider) {
    if (this.town) { this.town.addCircle(c.x, c.y, c.r); return; }
    const x0 = Math.floor((c.x - c.r) / CELL), x1 = Math.floor((c.x + c.r) / CELL);
    const y0 = Math.floor((c.y - c.r) / CELL), y1 = Math.floor((c.y + c.r) / CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const k = this.key(cx, cy);
      let arr = this.cells.get(k);
      if (!arr) this.cells.set(k, (arr = []));
      arr.push(c);
    }
  }

  tileAt(wx: number, wy: number): number {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return 0;
    return this.tiles[ty * this.w + tx];
  }

  blockedAt(wx: number, wy: number): boolean {
    if (this.town) return !this.town.isFree(wx, wy, .001, true);
    return isBlockedTile(this.tileAt(wx, wy));
  }

  /** True if a circle at (x, y) overlaps no blocked tile or collider. */
  isFree(x: number, y: number, r: number): boolean {
    if (this.town) return this.town.isFree(x, y, r);
    const tx0 = Math.floor((x - r) / TILE), tx1 = Math.floor((x + r) / TILE);
    const ty0 = Math.floor((y - r) / TILE), ty1 = Math.floor((y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h || isBlockedTile(this.tiles[ty * this.w + tx])) {
        const nx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const ny = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((nx - x) ** 2 + (ny - y) ** 2 < r * r) return false;
      }
    }
    const arr = this.cells.get(this.key(Math.floor(x / CELL), Math.floor(y / CELL)));
    if (arr) for (const c of arr) if ((c.x - x) ** 2 + (c.y - y) ** 2 < (c.r + r) ** 2) return false;
    return true;
  }

  /** Move a circle by (dx, dy), sliding along walls and props. */
  moveCircle(x: number, y: number, r: number, dx: number, dy: number, ignoreProps = false): { x: number; y: number } {
    if (this.town) return this.town.moveCircle(x, y, r, dx, dy, ignoreProps);
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      x += sx;
      y += sy;
      ({ x, y } = this.resolve(x, y, r, ignoreProps));
    }
    return { x, y };
  }

  resolve(x: number, y: number, r: number, ignoreProps = false): { x: number; y: number } {
    if (this.town) return this.town.resolve(x, y, r, ignoreProps);
    for (let pass = 0; pass < 2; pass++) {
      const tx0 = Math.floor((x - r) / TILE), tx1 = Math.floor((x + r) / TILE);
      const ty0 = Math.floor((y - r) / TILE), ty1 = Math.floor((y + r) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const blocked = tx < 0 || ty < 0 || tx >= this.w || ty >= this.h || isBlockedTile(this.tiles[ty * this.w + tx]);
        if (!blocked) continue;
        const nx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const ny = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        const ddx = x - nx, ddy = y - ny;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (ddx / d) * r;
          y = ny + (ddy / d) * r;
        } else {
          // centre inside a tile: push towards the nearest tile edge
          const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
          if (Math.abs(x - cx) > Math.abs(y - cy)) x = x < cx ? tx * TILE - r : tx * TILE + TILE + r;
          else y = y < cy ? ty * TILE - r : ty * TILE + TILE + r;
        }
      }
      if (ignoreProps) continue;
      const arr = this.cells.get(this.key(Math.floor(x / CELL), Math.floor(y / CELL)));
      if (!arr) continue;
      for (const c of arr) {
        const ddx = x - c.x, ddy = y - c.y;
        const rr = c.r + r;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001;
        x = c.x + (ddx / d) * rr;
        y = c.y + (ddy / d) * rr;
      }
    }
    return { x, y };
  }

  /** Coarse line-of-sight test for projectiles (samples tiles along the segment). */
  segmentBlocked(x0: number, y0: number, x1: number, y1: number): boolean {
    if (this.town) return this.town.segmentBlocked(x0, y0, x1, y1);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(len / (TILE / 2));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.blockedAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
    }
    return false;
  }
}

// ─────────────────────────── Player movement ───────────────────────────

export interface MoveInput { mx: number; my: number; dash: boolean }

export interface MoveState {
  x: number;
  y: number;
  /** Remaining dash time in ms (> 0 while dashing). */
  dashMs: number;
  dashDx: number;
  dashDy: number;
  dashCdMs: number;
  /** Last non-zero movement direction (dash direction when standing still). */
  faceX: number;
  faceY: number;
}

export function normInput(mx: number, my: number): { x: number; y: number } {
  const l = Math.hypot(mx, my);
  if (l < 0.01) return { x: 0, y: 0 };
  return l > 1 ? { x: mx / l, y: my / l } : { x: mx, y: my };
}

/** Advance one fixed step. `msPct` is the movement speed bonus (%), `dashCd` the dash cooldown in ms. */
export function stepMove(world: CollisionWorld, s: MoveState, input: MoveInput, msPct: number, dashCd: number, dtMs: number, radius: number, frozen = false): boolean {
  const dir = normInput(input.mx, input.my);
  if (dir.x || dir.y) { s.faceX = dir.x; s.faceY = dir.y; }
  let dashed = false;
  s.dashCdMs = Math.max(0, s.dashCdMs - dtMs);
  if (input.dash && s.dashCdMs <= 0 && s.dashMs <= 0 && !frozen) {
    const fx = dir.x || dir.y ? dir.x : s.faceX, fy = dir.x || dir.y ? dir.y : s.faceY;
    const l = Math.hypot(fx, fy) || 1;
    s.dashDx = fx / l;
    s.dashDy = fy / l;
    s.dashMs = DASH.durationMs;
    s.dashCdMs = dashCd;
    dashed = true;
  }
  const dt = dtMs / 1000;
  if (s.dashMs > 0) {
    const step = Math.min(s.dashMs, dtMs);
    const speed = DASH.distance / (DASH.durationMs / 1000);
    const p = world.moveCircle(s.x, s.y, radius, s.dashDx * speed * (step / 1000), s.dashDy * speed * (step / 1000));
    s.x = p.x; s.y = p.y;
    s.dashMs -= dtMs;
    const rest = dtMs - step;
    if (rest > 0 && (dir.x || dir.y) && !frozen) {
      const sp = BASE_MOVE_SPEED * (1 + msPct / 100);
      const q = world.moveCircle(s.x, s.y, radius, dir.x * sp * (rest / 1000), dir.y * sp * (rest / 1000));
      s.x = q.x; s.y = q.y;
    }
  } else if ((dir.x || dir.y) && !frozen) {
    const sp = BASE_MOVE_SPEED * (1 + msPct / 100);
    const p = world.moveCircle(s.x, s.y, radius, dir.x * sp * dt, dir.y * sp * dt);
    s.x = p.x; s.y = p.y;
  }
  return dashed;
}
