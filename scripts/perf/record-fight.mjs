// Records the reference fight for the client performance gate (docs/rework/PERF.md §Gate): an L70 Warrior in full set
// and legendaries enters a Torment Faultline, two extra elite packs are summoned beside them, and the hero walks into
// the nearest monster for SECS seconds. Every server message the client receives (raw msgpack bytes + arrival time)
// is written to scripts/perf/rift-fight.rec.gz, so the gate can replay the identical fight in the built client.
//
//   node scripts/shoot.mjs scripts/perf/record-fight.mjs --base=http://localhost:<vite port>
//   (dev server with ENABLE_DEBUG=1 and an isolated DATA_DIR; re-record only when the protocol changes)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SECS = Number(process.env.SECS ?? 20);
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rift-fight.rec.gz');

export default async function (a) {
  await a.open({ name: 'Recorder' + Math.floor(Math.random() * 9000 + 1000), cls: 'warrior' });
  await a.debug('level', { n: 69 }); await a.debug('set', {}); await a.debug('legendaries', {}); await a.debug('gold', {});
  await a.settle(800);
  const inv = JSON.parse(await a.eval('JSON.stringify(__ui.get().char.inventory.filter(Boolean).map(i => ({ id: i.id, kind: i.kind, r: i.rarity })))'));
  const order = { set: 0, legendary: 1, rare: 2, magic: 3, normal: 4 };
  inv.sort((x, y) => (order[x.r] ?? 9) - (order[y.r] ?? 9));
  const used = new Set();
  for (const it of inv) {
    const key = it.kind === 'ring' ? 'ring' + (used.has('ring') ? '2' : '') : it.kind;
    if (used.has(key)) continue;
    const r = await a.cmd('equip', { itemId: it.id });
    if (r?.ok) { used.add(key); if (it.kind === 'ring') used.add('ring'); }
  }
  const ob = JSON.parse(await a.eval('JSON.stringify(__game.world.map.town.npcs.find(n => n.role === "obelisk"))'));
  await a.walkTo(ob.x, ob.y + 50, 40);
  await a.cmd('riftOpen', { difficulty: 4 }); await a.settle(600);
  // Capture from here: the zone message of the Faultline, then every snapshot.
  await a.eval(`(() => { const ws = __game.conn.ws, orig = ws.onmessage; window.__rec = { t0: performance.now(), msgs: [] };
    ws.onmessage = (e) => { if (window.__rec) window.__rec.msgs.push([performance.now() - window.__rec.t0, new Uint8Array(e.data.slice(0))]); orig.call(ws, e); }; return true; })()`);
  await a.cmd('riftEnter', {});
  for (let i = 0; i < 60; i++) { if ((await a.eval('__game.world.zone?.kind ?? ""')) === 'rift') break; await a.wait(300); }
  await a.settle(1500);
  await a.debug('infhp', {});
  await a.debug('elite', {}); await a.debug('elite', {});
  await a.eval(`(() => { window.__fight = setInterval(() => {
    const g = __game, me = g.predictor; let best = null, bd = 1e18;
    for (const e of g.world.entities.values()) { if (e.kind !== 'mob' || e.dying || e.removed) continue; const d = (e.x - me.x) ** 2 + (e.y - me.y) ** 2; if (d < bd) { bd = d; best = e; } }
    if (!best) { __shoot.move = { x: 1, y: 0.2 }; return; }
    const d = Math.sqrt(bd); __shoot.move = d > 70 ? { x: (best.x - me.x) / d, y: (best.y - me.y) / d } : null;
  }, 120); return true; })()`);
  const mobs = [];
  for (let s = 0; s < SECS; s++) {
    await a.wait(1000);
    mobs.push(await a.eval('(() => { let n = 0; for (const e of __game.world.entities.values()) if (e.kind === "mob" && !e.dying) n++; return n; })()'));
  }
  await a.eval('clearInterval(window.__fight); __shoot.move = null; true');
  const b64 = await a.eval(`(() => { const r = window.__rec; window.__rec = null; let total = 0; for (const [, b] of r.msgs) total += 8 + b.length;
    const out = new Uint8Array(total), dv = new DataView(out.buffer); let o = 0;
    for (const [t, b] of r.msgs) { dv.setUint32(o, Math.round(t * 10), true); dv.setUint32(o + 4, b.length, true); out.set(b, o + 8); o += 8 + b.length; }
    let s = ''; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000)); return btoa(s); })()`);
  const raw = Buffer.from(b64, 'base64');
  fs.writeFileSync(OUT, zlib.gzipSync(raw, { level: 9 }));
  console.log(`recorded ${raw.length} bytes (${fs.statSync(OUT).size} gzipped) → ${path.relative(process.cwd(), OUT)}; monsters alive per second: ${mobs.join(' ')}`);
  await a.shot('record-fight');
}
