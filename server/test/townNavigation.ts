// Test harness pathfinding over the authored route graph, using real swept circle clearance.
import { CollisionWorld } from '../../shared/src/movement';
import type { MapData } from '../../shared/src/mapgen';
import type { Point } from '../../shared/src/townTypes';

export function townPath(map: MapData, start: Point, goal: Point): Point[] {
  const w = new CollisionWorld(map), t = map.town!;
  const nodes: Point[] = [start, goal, ...t.routes.flatMap(r => r.points), ...t.npcs.map(n => n.approach)];
  const unique = nodes.filter((p, i) => i < 2 || !nodes.slice(0, i).some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1));
  const dist = unique.map(() => Infinity), previous = unique.map(() => -1), seen = new Set<number>(); dist[0] = 0;
  for (;;) {
    let k = -1; for (let i = 0; i < unique.length; i++) if (!seen.has(i) && (k < 0 || dist[i] < dist[k])) k = i;
    if (k < 0 || !Number.isFinite(dist[k])) throw Error('No circle-clear authored route to target');
    if (k === 1) break; seen.add(k);
    const a = unique[k];
    for (let i = 0; i < unique.length; i++) {
      if (seen.has(i)) continue; const b = unique[i], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (dist[k] + d >= dist[i]) continue;
      const p = w.moveCircle(...a, 16, b[0] - a[0], b[1] - a[1]);
      if (Math.hypot(p.x - b[0], p.y - b[1]) < .01) { dist[i] = dist[k] + d; previous[i] = k; }
    }
  }
  const path: Point[] = []; for (let i = 1; i > 0; i = previous[i]) path.unshift(unique[i]);
  return path;
}
