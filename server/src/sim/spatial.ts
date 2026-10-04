// Uniform-grid spatial hash with O(1) insert / move / remove. Used for monsters; queries return entities whose
// centre lies within `r + entity.r` of the query point, never scanning more than the overlapped cells.

export interface Hashed {
  x: number;
  y: number;
  r: number;
  /** Bookkeeping owned by SpatialHash. */
  hCell: number;
  hIdx: number;
}

export const HASH_CELL = 128;
/** Largest entity radius, so queries can widen their cell range to catch big bodies by their centre. */
const MAX_BODY = 64;

export class SpatialHash<T extends Hashed> {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: (T[] | undefined)[];
  size = 0;

  constructor(widthPx: number, heightPx: number) {
    this.cols = Math.ceil(widthPx / HASH_CELL) + 1;
    this.rows = Math.ceil(heightPx / HASH_CELL) + 1;
    this.cells = new Array(this.cols * this.rows);
  }

  private cellOf(x: number, y: number): number {
    let cx = Math.floor(x / HASH_CELL), cy = Math.floor(y / HASH_CELL);
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  insert(e: T) {
    const c = this.cellOf(e.x, e.y);
    let arr = this.cells[c];
    if (!arr) this.cells[c] = arr = [];
    e.hCell = c;
    e.hIdx = arr.length;
    arr.push(e);
    this.size++;
  }

  remove(e: T) {
    const arr = this.cells[e.hCell];
    if (!arr || arr[e.hIdx] !== e) return;
    const last = arr.pop()!;
    if (last !== e) { arr[e.hIdx] = last; last.hIdx = e.hIdx; }
    e.hCell = -1;
    this.size--;
  }

  /** Call after changing e.x / e.y. */
  update(e: T) {
    const c = this.cellOf(e.x, e.y);
    if (c === e.hCell) return;
    const old = this.cells[e.hCell];
    if (old) {
      const last = old.pop()!;
      if (last !== e) { old[e.hIdx] = last; last.hIdx = e.hIdx; }
    }
    let arr = this.cells[c];
    if (!arr) this.cells[c] = arr = [];
    e.hCell = c;
    e.hIdx = arr.length;
    arr.push(e);
  }

  /** Push every entity with centre distance <= r + e.r into `out` (which is NOT cleared). */
  query(x: number, y: number, r: number, out: T[]): T[] {
    const reach = r + MAX_BODY;
    const cx0 = Math.max(0, Math.floor((x - reach) / HASH_CELL)), cx1 = Math.min(this.cols - 1, Math.floor((x + reach) / HASH_CELL));
    const cy0 = Math.max(0, Math.floor((y - reach) / HASH_CELL)), cy1 = Math.min(this.rows - 1, Math.floor((y + reach) / HASH_CELL));
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * this.cols;
      for (let cx = cx0; cx <= cx1; cx++) {
        const arr = this.cells[row + cx];
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const e = arr[i];
          const dx = e.x - x, dy = e.y - y, rr = r + e.r;
          if (dx * dx + dy * dy <= rr * rr) out.push(e);
        }
      }
    }
    return out;
  }

  /** Push every entity whose centre lies in the rectangle. */
  queryRect(x0: number, y0: number, x1: number, y1: number, out: T[]): T[] {
    const cx0 = Math.max(0, Math.floor(x0 / HASH_CELL)), cx1 = Math.min(this.cols - 1, Math.floor(x1 / HASH_CELL));
    const cy0 = Math.max(0, Math.floor(y0 / HASH_CELL)), cy1 = Math.min(this.rows - 1, Math.floor(y1 / HASH_CELL));
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * this.cols;
      for (let cx = cx0; cx <= cx1; cx++) {
        const arr = this.cells[row + cx];
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const e = arr[i];
          if (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e);
        }
      }
    }
    return out;
  }

  /** Nearest entity to (x, y) within `r` (distance to centre minus radius), optionally filtered. */
  nearest(x: number, y: number, r: number, filter?: (e: T) => boolean): T | null {
    const reach = r + MAX_BODY;
    const cx0 = Math.max(0, Math.floor((x - reach) / HASH_CELL)), cx1 = Math.min(this.cols - 1, Math.floor((x + reach) / HASH_CELL));
    const cy0 = Math.max(0, Math.floor((y - reach) / HASH_CELL)), cy1 = Math.min(this.rows - 1, Math.floor((y + reach) / HASH_CELL));
    let best: T | null = null, bestD = Infinity;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const arr = this.cells[cy * this.cols + cx];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 >= bestD) continue;
        if (filter && !filter(e)) continue;
        best = e; bestD = d2;
      }
    }
    return best;
  }
}
