// Bounded BFS flow field around each player, used by monsters whose straight line to their target is blocked
// (cave corridors in rifts, forests and lakes in fields). Recomputed only when the player changes tile.

import { TILE, isBlockedTile } from '../shared';
import type { Instance } from './instance';
import type { Player } from './types';

const R = 26;               // window half-size in tiles (~1660 units)
const W = R * 2 + 1;
const UNSEEN = 0xffff;
const queue = new Int32Array(W * W);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function ensure(inst: Instance, p: Player) {
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const tile = ty * inst.map.w + tx;
  if (p.ff && p.ffTile === tile) return;
  if (p.ff && inst.t - p.ffT < 200) return;
  p.ffTile = tile;
  p.ffT = inst.t;
  const dist = p.ff ?? new Uint16Array(W * W);
  p.ff = dist;
  dist.fill(UNSEEN);
  const x0 = tx - R, y0 = ty - R;
  p.ffX0 = x0; p.ffY0 = y0;
  const tiles = inst.map.tiles, mw = inst.map.w, mh = inst.map.h;
  const blocked = (gx: number, gy: number) => gx < 0 || gy < 0 || gx >= mw || gy >= mh || isBlockedTile(tiles[gy * mw + gx]);
  let head = 0, tail = 0;
  const start = R * W + R;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++];
    const lx = i % W, ly = (i / W) | 0;
    const d = dist[i] + 1;
    for (let k = 0; k < 8; k++) {
      const nx = lx + DIRS[k][0], ny = ly + DIRS[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
      const j = ny * W + nx;
      if (dist[j] !== UNSEEN) continue;
      const gx = x0 + nx, gy = y0 + ny;
      if (blocked(gx, gy)) continue;
      if (k >= 4 && (blocked(x0 + lx + DIRS[k][0], y0 + ly) || blocked(x0 + lx, y0 + ly + DIRS[k][1]))) continue;
      dist[j] = d;
      queue[tail++] = j;
    }
  }
}

/** Unit direction for a monster at (x, y) to walk towards player `p` around walls, or null if unknown. */
export function flowDir(inst: Instance, p: Player, x: number, y: number): { x: number; y: number } | null {
  ensure(inst, p);
  const ff = p.ff!;
  const lx = Math.floor(x / TILE) - p.ffX0, ly = Math.floor(y / TILE) - p.ffY0;
  if (lx < 0 || ly < 0 || lx >= W || ly >= W) return null;
  const here = ff[ly * W + lx];
  let best = here, bx = -1, by = -1;
  for (let k = 0; k < 8; k++) {
    const nx = lx + DIRS[k][0], ny = ly + DIRS[k][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
    const v = ff[ny * W + nx];
    if (v < best) { best = v; bx = nx; by = ny; }
  }
  if (bx < 0) return null;
  const cx = (p.ffX0 + bx) * TILE + TILE / 2, cy = (p.ffY0 + by) * TILE + TILE / 2;
  const dx = cx - x, dy = cy - y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}
