// Crowd benchmark for the rebuilt field zones (docs/rework/worlds/LOG.md W4). The observer (visible headless Chrome at
// 1920×1080, see worlds-perf.mjs for the frame metrics) walks toward the far end of the zone's roads while bot heroes
// (WebSocket clients; 29 + the observer = one full field channel, FIELD_CHANNEL_CAP 30) follow it in a loose crowd: they
// steer straight at a ring around the observer and a bot left more than 650 units behind is put back next to it with the
// QA warp (bots have no path finding; the observer's own walk is the real one).
// Reports the observer's frame work and intervals, heroes in view, and the server's tick time for that instance
// (/healthz: average and worst of the last 100 ticks at 20 Hz). Needs ENABLE_DEBUG=1 on the server (story/infhp/warp).
//   node --import tsx scripts/shoot.mjs scripts/worlds-crowd.mjs --base=http://localhost:5231
//        ZONES=a,b  BOTS=29  SERVER=http://localhost:2631  ORIGIN=http://localhost:5231  WALK_MS=8000
import WS from 'ws';
import { Packr } from 'msgpackr';
import { PROTOCOL_VERSION } from '../shared/src/protocol.ts';
import { generateMap } from '../shared/src/mapgen.ts';
import { loadAdventure } from '../shared/src/adventure.ts';
import { CollisionWorld } from '../shared/src/movement.ts';
import scenario from './worlds-scenario.mjs';
import { BENCH } from './worlds-perf.mjs';

const SERVER = process.env.SERVER ?? 'http://localhost:2631', ORIGIN = process.env.ORIGIN ?? 'http://localhost:5231';
const ZONES = (process.env.ZONES ?? 'rillwake_crossing,cinderwash_kilns,sablefen_causeway,saltwind_pans,shiverline_escarpment,beaconbreak_ward').split(',');
const BOTS = Number(process.env.BOTS ?? 29);
const packr = new Packr({ useRecords: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Bot {
  constructor(name) { this.name = name; this.pending = new Map(); this.next = 1; this.seq = 0; this.me = null; this.zone = null; this.char = null; this.last = 0; }
  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WS(SERVER.replace(/^http/, 'ws') + '/ws', { origin: ORIGIN });
      this.ws.on('open', resolve); this.ws.on('error', reject);
      this.ws.on('message', (data, binary) => {
        if (!binary) return;
        const m = packr.unpack(data);
        if (m.t === 'welcome') { this.char = m.char; this.zone = m.zone; }
        else if (m.t === 'zone') { this.zone = m.zone; this.me = null; }
        else if (m.t === 'char') this.char = m.char;
        else if (m.t === 'res') { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); p(m); } }
        else if (m.t === 's') this.me = m.me;
      });
    });
  }
  send(m) { if (this.ws.readyState === WS.OPEN) this.ws.send(packr.pack(m)); }
  async until(f, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { if (f()) return true; await sleep(30); } return false; }
  async login() { this.send({ t: 'hello', name: this.name, classId: ['warrior', 'ranger', 'mage'][this.name.length % 3], v: PROTOCOL_VERSION }); return this.until(() => this.char); }
  async cmd(op, a = {}) {
    const wait = this.last + 30 - Date.now(); if (wait > 0) await sleep(wait); this.last = Date.now();
    const id = this.next++, s = this.char?.commands;
    const r = s && { epoch: s.epoch, sequence: s.sequence, token: (Date.now() * 1000 + id).toString(16).padStart(32, '0') };
    return new Promise((resolve) => { const t = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, err: 'TIMEOUT' }); }, 8000); this.pending.set(id, (m) => { clearTimeout(t); resolve(m); }); this.send({ t: 'cmd', id, op, a, r }); });
  }
  input(mx, my) { this.send({ t: 'in', seq: ++this.seq, mx, my }); }
  close() { try { this.ws.close(); } catch { /* closed */ } }
}

export default async function (a) {
  let first = true;
  for (const zone of ZONES) {
    // Observer: into the zone the same way as the screenshot scenario.
    process.env.ZONES = zone; process.env.SHOTS = '0';
    const skip = async () => {};
    await scenario({ ...a, shot: skip, open: first ? a.open : skip, debug: first ? a.debug : skip }); first = false;
    // Bots: log in, unlock the route, stand at the town waypoint (QA warp), travel.
    if (!(await fetch(SERVER + '/healthz')).ok) throw Error('server not reachable');
    const bots = Array.from({ length: BOTS }, (_, i) => new Bot(`Crowd${i}x${Math.floor(Math.random() * 1e5)}`));
    let arrived = 0;
    await Promise.all(bots.map(async (b, i) => {
      await sleep(i * 120);
      await b.open(); if (!await b.login()) return;
      await b.cmd('debug', { op: 'story', level: 50 }); await b.cmd('debug', { op: 'infhp' });
      const wp = generateMap(b.zone.zone, b.zone.seed).town?.npcs.find((n) => n.role === 'waypoint');
      if (wp) await b.cmd('debug', { op: 'warp', x: Math.round(wp.approach[0]), y: Math.round(wp.approach[1]) });
      const r = await b.cmd('travel', { zone }); if (!r.ok) { console.warn('bot travel', zone, r.err); return; }
      if (await b.until(() => b.zone?.zone === zone && b.me)) arrived++;
    }));
    // Follow the observer in a loose ring (each bot its own radius/angle, slowly rotating).
    let obs = await a.eval('({ x: __game.predictor.x, y: __game.predictor.y })'), running = true;
    const cw = new CollisionWorld(loadAdventure(zone, bots.find((b) => b.zone)?.zone.seed ?? 1));
    const spot = (x, y, i) => { for (let r = 110 + (i % 6) * 50; r < 900; r += 40) for (let k = 0; k < 16; k++) { const g = i * 2.39996 + k * Math.PI / 8, px = x + Math.cos(g) * r, py = y + Math.sin(g) * r * 0.7; if (cw.isFree(px, py, 20)) return { x: Math.round(px), y: Math.round(py) }; } return null; };
    const warped = new Map(), regroup = (b, i) => { const p = spot(obs.x, obs.y, i); warped.set(b, Date.now()); if (p) void b.cmd('debug', { op: 'warp', ...p }); };
    bots.forEach((b, i) => { if (b.me) regroup(b, i); });
    const watch = (async () => { while (running) { try { obs = await a.eval('({ x: __game.predictor.x, y: __game.predictor.y })'); } catch { /* page busy */ } await sleep(250); } })();
    const t0 = Date.now();
    const drive = setInterval(() => {
      const t = (Date.now() - t0) / 1000;
      bots.forEach((b, i) => {
        if (!b.me) return;
        if (Math.hypot(b.me.x - obs.x, b.me.y - obs.y) > 650 && Date.now() - (warped.get(b) ?? 0) > 2000) { regroup(b, i); return; }
        const ang = i * 2.39996 + t * 0.25, rad = 140 + (i % 6) * 60, tx = obs.x + Math.cos(ang) * rad, ty = obs.y + Math.sin(ang) * rad * 0.7;
        const dx = tx - b.me.x, dy = ty - b.me.y, l = Math.hypot(dx, dy);
        if (l < 30) b.input(0, 0); else b.input(dx / l, dy / l);
      });
    }, 50);
    await a.settle(Number(process.env.GATHER ?? 6000));
    const near = await a.eval(`[...__game.world.entities.values()].filter((e) => e.kind === 'player').length`);
    const r = await a.eval(`(${BENCH})(${Number(process.env.WALK_MS ?? 8000)})`);
    const view = await a.eval(`[...__game.world.entities.values()].filter((e) => e.kind === 'player').length`);
    const health = await (await fetch(SERVER + '/healthz')).json();
    const inst = health.instances.filter((x) => x.key.includes(zone));
    running = false; clearInterval(drive); await watch;
    for (const b of bots) b.close();
    const row = { zone, bots: BOTS, arrived, heroesInViewBefore: near, heroesInViewAfter: view, work: r.work, p95: r.p95, frames: r.frames, walked: r.walked,
      server: inst.map((x) => ({ key: x.key, players: x.players, tickAvg: +x.tick.avg.toFixed(2), tickMax: +x.tick.max.toFixed(2) })) };
    console.log(JSON.stringify(row));
    await sleep(1500);
  }
}
