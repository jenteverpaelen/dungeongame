// Records the town-crowd reference for the client performance gate (docs/rework/PERF.md §Gate): 24 L70 heroes of all
// three classes in full Set and Legendary gear, connected as plain socket clients, gather and mill around the
// recording hero in Hearthmere's market square for SECS seconds. The recording hero's client receives everything an
// observer sees (snapshots with every hero's look); recording starts as the hero steps back into town from a Faultline,
// so the town's zone message and every hero's description are in it. Written to scripts/perf/town-crowd.rec.gz.
//
//   node scripts/shoot.mjs scripts/perf/record-town.mjs --base=http://localhost:<vite port>
//   (dev server with ENABLE_DEBUG=1, an isolated DATA_DIR and the Vite origin in WS_ALLOWED_ORIGINS)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Packr } from 'msgpackr';

const SECS = Number(process.env.SECS ?? 20), BOTS = Number(process.env.BOTS ?? 24);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'town-crowd.rec.gz');
const PROTOCOL = Number(/PROTOCOL_VERSION = (\d+)/.exec(fs.readFileSync(path.join(here, '../../shared/src/protocol.ts'), 'utf8'))[1]);
const packr = new Packr({ useRecords: false });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function bot(base, name, classId) {
  const url = base.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(url, { origin: new URL(base).origin });
  const msgs = [];
  ws.on('message', (d) => { try { msgs.push(packr.unpack(d)); } catch { /* ignore */ } });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  const send = (m) => ws.send(packr.pack(m));
  const until = async (pred, what, ms = 20000) => { const end = Date.now() + ms; while (!pred()) { if (Date.now() > end) throw new Error(`${name}: timed out waiting for ${what}`); await wait(20); } };
  let id = 0;
  // Saved-state commands carry the character's transaction epoch and sequence (client/src/net/connection.ts).
  const commands = () => [...msgs].reverse().find((m) => (m.t === 'char' || m.t === 'welcome') && m.char?.commands)?.char.commands;
  const cmd = async (op, a = {}) => { const n = ++id; const st = commands(); const r = st ? { epoch: st.epoch, sequence: st.sequence, token: [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('') } : undefined; send({ t: 'cmd', id: n, op, a, r }); await until(() => msgs.some((m) => m.t === 'res' && m.id === n), `cmd ${op}`); await wait(80); return msgs.find((m) => m.t === 'res' && m.id === n); };
  send({ t: 'hello', name, classId, v: PROTOCOL });
  await until(() => msgs.some((m) => m.t === 'welcome'), 'welcome');
  for (const op of ['level', 'set', 'legendaries']) await cmd('debug', { op, ...(op === 'level' ? { n: 69 } : {}) });
  await wait(300);
  const char = [...msgs].reverse().find((m) => m.t === 'char' || m.t === 'welcome').char;
  const order = { set: 0, legendary: 1, rare: 2, magic: 3, normal: 4 };
  const inv = char.inventory.filter(Boolean).sort((x, y) => (order[x.rarity] ?? 9) - (order[y.rarity] ?? 9));
  const used = new Set();
  for (const it of inv) {
    const key = it.kind === 'ring' ? 'ring' + (used.has('ring') ? '2' : '') : it.kind;
    if (used.has(key)) continue;
    const r = await cmd('equip', { itemId: it.id });
    if (r?.ok) { used.add(key); if (it.kind === 'ring') used.add('ring'); }
  }
  const me = () => { const s = [...msgs].reverse().find((m) => m.t === 's'); return s ? { x: s.me.x, y: s.me.y } : null; };
  let seq = 0;
  return { ws, me, move: (mx, my) => send({ t: 'in', seq: ++seq, mx, my }), close: () => ws.close(), drain: () => { const keep = [...msgs].reverse().find((m) => m.t === 's'); msgs.length = 0; if (keep) msgs.push(keep); } };
}

export default async function (a) {
  await a.open({ name: 'Townrec' + Math.floor(Math.random() * 9000 + 1000), cls: 'warrior' });
  const town = JSON.parse(await a.eval('JSON.stringify(__game.world.map.town.npcs.map(n => ({ role: n.role, x: n.x, y: n.y })))'));
  const ob = town.find((n) => n.role === 'obelisk');
  await a.walkTo(ob.x, ob.y + 50, 40);
  const centre = await a.eval('({ x: __game.predictor.x, y: __game.predictor.y })');
  const classes = ['warrior', 'ranger', 'mage'];
  const bots = [];
  for (let i = 0; i < BOTS; i++) bots.push(await bot(a.base, `Crowd${String.fromCharCode(65 + i)}${Math.floor(Math.random() * 900 + 100)}`, classes[i % 3]));
  console.log(`${bots.length} heroes joined`);
  // Gather around the recorder, then mill about: a new nearby target every 2–4 s, about a third standing still.
  const targets = bots.map(() => ({ x: centre.x, y: centre.y, until: 0, idle: false }));
  const steer = () => {
    const now = Date.now();
    bots.forEach((b, i) => {
      const p = b.me(); if (!p) return;
      const t = targets[i];
      if (now > t.until) { const ang = Math.random() * Math.PI * 2, r = 60 + Math.random() * 260; t.x = centre.x + Math.cos(ang) * r * 1.4; t.y = centre.y + Math.sin(ang) * r * 0.8; t.until = now + 2000 + Math.random() * 2000; t.idle = Math.random() < 0.33; }
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (t.idle || d < 20) b.move(0, 0); else b.move(dx / d, dy / d);
      b.drain();
    });
  };
  const timer = setInterval(steer, 50);
  await wait(9000); // walk over from the entrance and spread out
  // Step into a Faultline and back out, recording from just before leaving: the town's zone message and every hero's
  // full description arrive again, so the recording is self-contained.
  await a.cmd('riftOpen', { difficulty: 0 }); await a.settle(400); await a.cmd('riftEnter', {});
  for (let i = 0; i < 60; i++) { if ((await a.eval('__game.world.zone?.kind ?? ""')) === 'rift') break; await wait(300); }
  await a.settle(800);
  await a.eval(`(() => { const ws = __game.conn.ws, orig = ws.onmessage; window.__rec = { t0: performance.now(), msgs: [] };
    ws.onmessage = (e) => { if (window.__rec) window.__rec.msgs.push([performance.now() - window.__rec.t0, new Uint8Array(e.data.slice(0))]); orig.call(ws, e); }; return true; })()`);
  await a.cmd('leave', {});
  await wait(SECS * 1000);
  clearInterval(timer);
  const players = await a.eval('(() => { let n = 0; for (const e of __game.world.entities.values()) if (e.kind === "player") n++; return n; })()');
  const b64 = await a.eval(`(() => { const r = window.__rec; window.__rec = null; let total = 0; for (const [, b] of r.msgs) total += 8 + b.length;
    const out = new Uint8Array(total), dv = new DataView(out.buffer); let o = 0;
    for (const [t, b] of r.msgs) { dv.setUint32(o, Math.round(t * 10), true); dv.setUint32(o + 4, b.length, true); out.set(b, o + 8); o += 8 + b.length; }
    let s = ''; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000)); return btoa(s); })()`);
  const raw = Buffer.from(b64, 'base64');
  fs.writeFileSync(OUT, zlib.gzipSync(raw, { level: 9 }));
  console.log(`recorded ${raw.length} bytes (${fs.statSync(OUT).size} gzipped) with ${players} heroes in view → ${path.relative(process.cwd(), OUT)}`);
  await a.shot('record-town');
  for (const b of bots) b.close();
}
