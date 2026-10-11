// Records a walk through Rillwake Crossing (first field zone) for a field-zone A/B: travel from the town waypoint,
// then walk a fixed route for SECS seconds (infinite HP). Output: scripts/perf/field-walk.rec.gz (A/B only, not gated)
//   node scripts/shoot.mjs scripts/perf/record-field.mjs --base=<dev client with ENABLE_DEBUG=1>
import fs from 'node:fs';
import zlib from 'node:zlib';
const SECS = Number(process.env.SECS ?? 20);
export default async function (a) {
  await a.open({ name: 'Fieldrec' + Math.floor(Math.random() * 9000 + 1000), cls: 'warrior' });
  await a.debug('level', { n: 20 });
  const wp = JSON.parse(await a.eval('JSON.stringify(__game.world.map.town.npcs.find(n => n.role === "waypoint"))'));
  await a.walkTo(wp.x, wp.y + 50, 40);
  await a.eval(`(() => { const ws = __game.conn.ws, orig = ws.onmessage; window.__rec = { t0: performance.now(), msgs: [] };
    ws.onmessage = (e) => { if (window.__rec) window.__rec.msgs.push([performance.now() - window.__rec.t0, new Uint8Array(e.data.slice(0))]); orig.call(ws, e); }; return true; })()`);
  const r = await a.cmd('travel', { zone: 'rillwake_crossing' });
  console.log('travel', JSON.stringify(r));
  for (let i = 0; i < 60; i++) { if ((await a.eval('__game.world.zone?.zone ?? ""')) === 'rillwake_crossing') break; await a.wait(300); }
  await a.settle(1000);
  await a.debug('infhp', {});
  const steps = [[1, 0.2], [0.6, 0.8], [1, -0.3], [0.2, 1]];
  for (let s = 0; s < SECS; s += 5) { const [x, y] = steps[(s / 5) % steps.length]; await a.walk(x, y, 5000); }
  const b64 = await a.eval(`(() => { const r = window.__rec; window.__rec = null; let total = 0; for (const [, b] of r.msgs) total += 8 + b.length;
    const out = new Uint8Array(total), dv = new DataView(out.buffer); let o = 0;
    for (const [t, b] of r.msgs) { dv.setUint32(o, Math.round(t * 10), true); dv.setUint32(o + 4, b.length, true); out.set(b, o + 8); o += 8 + b.length; }
    let s = ''; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000)); return btoa(s); })()`);
  fs.writeFileSync('scripts/perf/field-walk.rec.gz', zlib.gzipSync(Buffer.from(b64, 'base64'), { level: 9 }));
  console.log('recorded', fs.statSync('scripts/perf/field-walk.rec.gz').size, 'bytes gz');
  await a.shot('record-field');
}
