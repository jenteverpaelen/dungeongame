// Frame-time probe for the rebuilt zones (docs/rework/worlds/LOG.md): visible headless Chrome, 1920×1080, one hero walking
// with extra elite packs summoned around it. Prints avg fps, p95 and worst frame per zone.
//   node scripts/shoot.mjs scripts/worlds-perf.mjs --base=http://localhost:5231
import scenario from './worlds-scenario.mjs';
const ORDER = ['rillwake_crossing', 'bracken_sluice', 'reedvault_pumpworks', 'cairnspill_terraces', 'cinderwash_kilns', 'kilnwatch_crown', 'sablefen_causeway', 'saltwind_pans', 'lockglass_cistern', 'shiverline_escarpment', 'beaconbreak_ward', 'hollowstar_array'];
export default async function (a) {
  const rows = [];
  for (const zone of (process.env.ZONES?.split(',') ?? ORDER)) {
    process.env.ZONES = zone; process.env.SHOTS = '0';
    await scenario({ ...a, shot: async () => {}, open: rows.length ? async () => {} : a.open, debug: rows.length ? async () => {} : a.debug });
    await a.settle(Number(process.env.SETTLE ?? 2500));
    for (let i = 0; i < 3; i++) await a.cmd('debug', { op: 'elite' });
    await a.settle(600);
    const r = await a.eval(`new Promise(res => { const d = []; let last = performance.now(); const t0 = last; __shoot.move = { x: 1, y: 0.2 };
      const f = (t) => { d.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(f); else { __shoot.move = null; d.sort((x, y) => x - y);
        const avg = d.reduce((s, v) => s + v, 0) / d.length; res({ frames: d.length, fps: Math.round(1000 / avg), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), worst: +d[d.length - 1].toFixed(1), mobs: [...__game.world.entities.values()].filter(e => e.kind === 'mob').length, hidden: document.hidden }); } };
      requestAnimationFrame(f); })`);
    rows.push({ zone, ...r });
    console.log(JSON.stringify({ zone, ...r }));
  }
}
