// Walking frame-time benchmark for the rebuilt zones (docs/rework/worlds/LOG.md W4). Visible headless Chrome at 1920×1080
// (page target, so requestAnimationFrame runs; not vsync-capped), one hero walking toward the far end of the zone's authored
// roads with three elite packs summoned at the start so monsters are in frame. Every requestAnimationFrame interval is
// sampled. The display clock quantises intervals (165 Hz panel here: 6.06 ms steps), so each frame's main-thread work is
// also measured: from the frame's rAF timestamp to a message posted at the end of the frame's rAF callbacks, which runs
// after style, layout, paint and commit. Prints intervals (p50/p95/p99/worst), work (p50/p95/p99, frames over 16.7 ms),
// walked distance, and the ground chunks painted during the walk (paint ms, worst slice, synchronous on-screen chunks).
//   node scripts/shoot.mjs scripts/worlds-perf.mjs --base=http://localhost:5231      ZONES=a,b  WALK_MS=8000  SETTLE=2500  ELITES=3
import scenario from './worlds-scenario.mjs';
const ORDER = ['rillwake_crossing', 'bracken_sluice', 'reedvault_pumpworks', 'cairnspill_terraces', 'cinderwash_kilns', 'kilnwatch_crown',
  'sablefen_causeway', 'saltwind_pans', 'lockglass_cistern', 'shiverline_escarpment', 'beaconbreak_ward', 'hollowstar_array'];

// In-page: walk a grid path (replicated collision) toward the farthest road point and sample every frame.
export const BENCH = `async (ms) => {
  const g = __game, a = g.world.map.adventure, x0 = g.predictor.x, y0 = g.predictor.y;
  let goal = null, far = 0;
  for (const p of a?.paths ?? []) for (const q of p.points) { const d = Math.hypot(q[0] - x0, q[1] - y0); if (d > far) { far = d; goal = q; } }
  if (!goal) for (const l of a?.locations ?? []) { const d = Math.hypot(l.x - x0, l.y - y0); if (d > far) { far = d; goal = [l.x, l.y]; } }
  const pts = goal ? __shoot.path(goal[0], goal[1]) : [];
  const find = (n) => n.syncBakes !== undefined ? n : (n.children ?? []).reduce((r, c) => r ?? find(c), null);
  const ground = find(g.app.stage), before = ground && { ms: ground.bakeMs, n: ground.baked, sync: ground.syncBakes };
  if (ground) ground.worstSlice = 0;
  return new Promise((res) => {
    const d = [], w = []; let last = performance.now(), i = 0, walked = 0, px = x0, py = y0; const t0 = last;
    const ch = new MessageChannel(); let frameT = 0; ch.port1.onmessage = () => w.push(performance.now() - frameT);
    const f = (t) => {
      d.push(t - last); last = t; frameT = t; ch.port2.postMessage(0);
      const x = g.predictor.x, y = g.predictor.y; walked += Math.hypot(x - px, y - py); px = x; py = y;
      while (i < pts.length - 1 && Math.hypot(pts[i][0] - x, pts[i][1] - y) < 24) i++;
      if (pts.length) { const l = Math.hypot(pts[i][0] - x, pts[i][1] - y) || 1; __shoot.move = { x: (pts[i][0] - x) / l, y: (pts[i][1] - y) / l }; }
      if (t - t0 < ms && i < pts.length - 1) { requestAnimationFrame(f); return; }
      __shoot.move = null; d.shift(); d.sort((p, q) => p - q); w.shift(); w.sort((p, q) => p - q);
      const at = (k, a = d) => +a[Math.min(a.length - 1, Math.floor(a.length * k))].toFixed(1), avg = d.reduce((s, v) => s + v, 0) / d.length;
      res({ frames: d.length, secs: +((t - t0) / 1000).toFixed(1), fps: Math.round(1000 / avg), p50: at(0.5), p95: at(0.95), p99: at(0.99), worst: +d[d.length - 1].toFixed(1),
        over16: d.filter((v) => v > 16.7).length, work: { p50: at(0.5, w), p95: at(0.95, w), p99: at(0.99, w), worst: +w[w.length - 1].toFixed(1), over16: w.filter((v) => v > 16.7).length }, walked: Math.round(walked), mobs: [...g.world.entities.values()].filter((e) => e.kind === 'mob').length, hidden: document.hidden,
        paint: ground && { chunks: ground.baked - before.n, ms: Math.round(ground.bakeMs - before.ms), worstSlice: +ground.worstSlice.toFixed(1), sync: ground.syncBakes - before.sync, kept: ground.tiles?.size },
        gpuTextures: g.app.renderer.texture?.managedTextures?.filter(Boolean).length ?? null, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null });
    };
    requestAnimationFrame(f);
  });
}`;

export default async function (a) {
  const zones = process.env.ZONES?.split(',') ?? ORDER, rows = [];
  for (const zone of zones) {
    process.env.ZONES = zone; process.env.SHOTS = '0';
    const first = rows.length === 0, skip = async () => {};
    await scenario({ ...a, shot: skip, open: first ? a.open : skip, debug: first ? a.debug : skip });
    await a.settle(Number(process.env.SETTLE ?? 2500));
    for (let i = 0; i < Number(process.env.ELITES ?? 3); i++) await a.cmd('debug', { op: 'elite' });
    await a.settle(600);
    const r = await a.eval(`(${BENCH})(${Number(process.env.WALK_MS ?? 8000)})`);
    rows.push({ zone, ...r });
    console.log(JSON.stringify({ zone, ...r }));
  }
}
