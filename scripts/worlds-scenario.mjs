// Screenshot scenario for the quest zones (docs/rework/worlds): every authored zone, its entry view and its landmarks.
//   node scripts/shoot.mjs scripts/worlds-scenario.mjs --base=http://localhost:5231 --out=docs/rework/worlds/shots --prefix=after-
// Needs a server with ENABLE_DEBUG=1 (uses the QA-only debug ops `story` and `warp`). ZONES=a,b limits the run.
const ORDER = ['rillwake_crossing', 'bracken_sluice', 'reedvault_pumpworks', 'cairnspill_terraces', 'cinderwash_kilns', 'kilnwatch_crown',
  'sablefen_causeway', 'saltwind_pans', 'lockglass_cistern', 'shiverline_escarpment', 'beaconbreak_ward', 'hollowstar_array'];
const PARENT = { reedvault_pumpworks: 'bracken_sluice', lockglass_cistern: 'saltwind_pans', hollowstar_array: 'beaconbreak_ward' };
const LIMIT = Number(process.env.SHOTS ?? 4);

export default async function (a) {
  await a.open({ name: 'Worlds' + Math.floor(Math.random() * 1e5) });
  await a.debug('story', { level: 50 });
  await a.debug('infhp');
  await a.settle(600);
  const zones = process.env.ZONES ? process.env.ZONES.split(',') : ORDER;
  const here = () => a.eval('__game.world.map.zone');
  const warp = async (x, y) => { const r = await a.cmd('debug', { op: 'warp', x: Math.round(x), y: Math.round(y) }); if (!r?.ok) console.warn('warp', x, y, r?.err); await a.settle(500); };
  const home = async () => { if (await here() !== 'hearthmere') { await a.cmd('travel', { zone: 'hearthmere' }); await a.until(async () => (await here()) === 'hearthmere', 20000, 'town'); await a.settle(1200); } };
  const go = async (zone) => {
    if (await here() === zone) return;
    const parent = PARENT[zone];
    if (parent) {
      await go(parent);
      const p = await a.eval(`(() => { const m = __game.world.map, p = m.portals.find(p => p.to === ${JSON.stringify(zone)}); return p && { x: p.x, y: p.y }; })()`);
      const spot = await a.eval(`(() => { const cw = __game.world.collision; for (let r = 40; r < 140; r += 20) for (let i = 0; i < 16; i++) { const x = ${p.x} + r * Math.cos(i * Math.PI / 8), y = ${p.y} + r * Math.sin(i * Math.PI / 8); if (cw.isFree(x, y, 18)) return { x, y }; } return null; })()`);
      await warp(spot.x, spot.y);
    } else {
      await home();
      const wp = await a.eval('(() => { const n = __game.world.map.town.npcs.find(n => n.role === "waypoint"); return { x: n.approach[0], y: n.approach[1] }; })()');
      await warp(wp.x, wp.y);
    }
    const r = await a.cmd('travel', { zone });
    if (!r?.ok) { console.warn('travel', zone, r?.err); return false; }
    await a.until(async () => (await here()) === zone, 20000, zone);
    await a.settle(2200);
    return true;
  };
  await a.eval('__ui.set({ panels: {} }); true');
  for (const zone of zones) {
    if (await go(zone) === false) continue;
    await a.eval('__ui.set({ panels: {} }); true');
    await a.mouseAway();
    await a.shot(`${zone}-entry`);
    const marks = await a.eval('(__game.world.map.adventure?.landmarks ?? []).map(l => ({ name: l.name, x: l.x, y: l.y }))');
    for (const m of marks.slice(0, LIMIT)) {
      await a.camera(m.x, m.y - 60);
      await a.settle(900);
      await a.shot(`${zone}-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    }
    await a.camera(null);
  }
}
