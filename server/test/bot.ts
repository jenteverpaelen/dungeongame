// Headless bot client + server test. Connects over a real WebSocket with MessagePack, exactly like the browser
// client, plays all three classes in parallel and asserts the server's behaviour:
//   hello/welcome/char, every cmd op, chat, rate limits, persistence, AFK gains, rifts, channels, field play.
// It also runs an in-process test of the world manager (channel caps, instance garbage collection).
//
// Usage:
//   npx tsx server/test/bot.ts                       spawn a server on a free port (temp data dir) and test it
//   SIM_STUB=1 npx tsx server/test/bot.ts            ... using the infrastructure test stub instead of the real sim
//   npx tsx server/test/bot.ts --url ws://localhost:2567/ws [--data <dir>]   test an already running server
//   options: --seconds 20 (field play length) --classes warrior,ranger,mage --verbose
//            --rift-full (also play a whole rift incl. the Guardian, slow)  --only protocol,classes,multiplayer,afk,static,world,rift
// Exit code 0 when every check passed.

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Packr } from 'msgpackr';
import WebSocket from 'ws';
import { createStaticHandler } from '../src/net/static';
import { TICK_MS, INVENTORY_SIZE } from '../../shared/src/constants';
import { createCharacter } from '../../shared/src/character';
import { cubeXpToNext, gemRemoveCost, maxSockets } from '../../shared/src/cube';
import { LEGENDARIES } from '../../shared/src/data/items';
import { SKILLS, skillsForClass } from '../../shared/src/data/skills';
import { generateMap, type MapData } from '../../shared/src/mapgen';
import { paragonPoints } from '../../shared/src/progression';
import {
  F_DEAD, PROTOCOL_VERSION, STATE_STRIDE, type C2S, type CmdOp, type EntDesc, type MeState, type S2C, type Snapshot, type WorldInfo, type ZoneInfo,
} from '../../shared/src/protocol';
import { computeStats } from '../../shared/src/stats';
import type { CharacterSave, ClassId, DerivedStats, Item } from '../../shared/src/types';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import { townPath } from './townNavigation';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const packr = new Packr({ useRecords: false });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─────────────────────────── CLI ───────────────────────────

const argv = process.argv.slice(2);
const opt = (name: string, d?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const flag = (name: string) => argv.includes(`--${name}`);
const FIELD_SECONDS = Number(opt('seconds', '20'));
const CLASSES_TO_TEST = (opt('classes', 'warrior,ranger,mage') as string).split(',') as ClassId[];
const VERBOSE = flag('verbose') || process.env.BOT_VERBOSE === '1';
const RUN = Math.random().toString(36).slice(2, 6);

// ─────────────────────────── Checks ───────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: unknown, detail?: unknown): boolean {
  if (cond) {
    passed++;
    if (VERBOSE) console.log(`  PASS  ${name}`);
    return true;
  }
  failed++;
  const line = `${name}${detail !== undefined ? `  -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`;
  failures.push(line);
  console.log(`  FAIL  ${line}`);
  return false;
}

const section = (title: string) => console.log(`\n== ${title}`);

// ─────────────────────────── Bot client ───────────────────────────

interface Res { ok: boolean; err?: string; data?: any }

interface SeenEnt { desc: EntDesc; x: number; y: number; hp: number; flags: number }

class Bot {
  ws!: WebSocket;
  closed: { code: number; reason: string } | null = null;
  you = 0;
  char!: CharacterSave;
  derived!: DerivedStats;
  zone!: ZoneInfo;
  world: WorldInfo | null = null;
  afk: Extract<S2C, { t: 'afk' }> | null = null;
  errs: string[] = [];
  chats: Extract<S2C, { t: 'chat' }>[] = [];
  zones: ZoneInfo[] = [];
  pongs: { c: number; s: number }[] = [];
  charMsgs = 0;
  snapshots = 0;
  snap: Snapshot | null = null;
  me: MeState | null = null;
  rift: Snapshot['rift'] = undefined;
  ents = new Map<number, SeenEnt>();
  events: Record<string, number> = {};
  badSnapshots = 0;
  /** Damage events dealt by this bot's own entity. */
  ownDmg = 0;
  /** Message ordering violations: a snapshot before `welcome`, or a first snapshot after welcome/zone that lacks the own entity. */
  orderViolations = 0;
  private awaitFirstSnap = false;
  lastAck = 0;
  seq = 0;
  private nextCmd = 1;
  lastCommandId = 0;
  private pending = new Map<number, (r: Res) => void>();
  welcomeAt = 0;

  constructor(readonly url: string, readonly name: string, readonly tag = name) {}

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.on('open', () => resolve());
      ws.on('error', (e) => reject(e));
      ws.on('close', (code, reason) => {
        this.closed = { code, reason: reason.toString() };
        for (const p of this.pending.values()) p({ ok: false, err: 'Disconnected' });
        this.pending.clear();
      });
      ws.on('message', (data: Buffer, isBinary) => {
        if (!isBinary) return;
        this.onMessage(packr.unpack(data) as S2C);
      });
    });
  }

  private onMessage(m: S2C) {
    switch (m.t) {
      case 'welcome':
        this.you = m.you; this.char = m.char; this.derived = m.derived; this.zone = m.zone; this.world = m.world;
        this.zones.push(m.zone); this.welcomeAt = Date.now(); this.awaitFirstSnap = true;
        break;
      case 'zone':
        this.you = m.you; this.zone = m.zone; this.zones.push(m.zone);
        this.ents.clear(); this.rift = undefined; this.me = null; this.awaitFirstSnap = true;
        break;
      case 'char': this.char = m.char; this.derived = m.derived; this.charMsgs++; break;
      case 'res': { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); p({ ok: m.ok, err: m.err, data: m.data }); } break; }
      case 'chat': this.chats.push(m); break;
      case 'afk': this.afk = m; break;
      case 'world': this.world = m.world; break;
      case 'pong': this.pongs.push({ c: m.c, s: m.s }); break;
      case 'err': this.errs.push(m.msg); break;
      case 's': this.onSnapshot(m); break;
    }
  }

  private onSnapshot(s: Snapshot) {
    if (this.welcomeAt === 0) this.orderViolations++;
    else if (this.awaitFirstSnap) {
      this.awaitFirstSnap = false;
      if (!s.add?.some((d) => d.id === this.you)) this.orderViolations++;
    }
    this.snapshots++;
    this.snap = s;
    this.me = s.me;
    this.lastAck = s.ack;
    this.rift = s.rift;
    if (s.upd.length % STATE_STRIDE !== 0 || typeof s.time !== 'number' || typeof s.tick !== 'number' || !s.me || !Number.isFinite(s.me.x) || !Number.isFinite(s.me.y)) this.badSnapshots++;
    if (s.add) for (const d of s.add) this.ents.set(d.id, { desc: d, x: 0, y: 0, hp: 1, flags: 0 });
    for (let i = 0; i + STATE_STRIDE <= s.upd.length; i += STATE_STRIDE) {
      const e = this.ents.get(s.upd[i]);
      if (e) { e.x = s.upd[i + 1]; e.y = s.upd[i + 2]; e.hp = s.upd[i + 3] / 1000; e.flags = s.upd[i + 4]; }
    }
    if (s.rem) for (const id of s.rem) this.ents.delete(id);
    if (s.ev) {
      for (const ev of s.ev) {
        this.events[ev.e] = (this.events[ev.e] ?? 0) + 1;
        if (ev.e === 'dmg' && ev.s === this.you) this.ownDmg++;
      }
    }
  }

  send(msg: C2S) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(packr.pack(msg));
  }

  private lastCmdAt = 0;
  /** Existing success-path assertions now physically walk to the required artisan first.
   * Authority rejection tests use rawCmd and intentionally never call this helper. */
  async approachService(role: string) {
    if (this.zone?.kind !== 'town') return;
    await this.waitFor(() => this.me);
    const map = generateMap(this.zone.zone, this.zone.seed), n = map.town?.npcs.find(n => n.role === role);
    if (!n || !this.me) return;
    if (Math.hypot(this.me.x - n.x, this.me.y - n.y) <= n.interactionRadius - 4) return;
    const points = townPath(map, [this.me.x, this.me.y], n.approach);
    const end = Date.now() + 45_000;
    for (const [x, y] of points) {
      while (this.me && Math.hypot(this.me.x - x, this.me.y - y) > 5) {
        if (Date.now() > end) throw Error(`${this.tag}: timed out walking to ${role}`);
        const dx = x - this.me.x, dy = y - this.me.y, l = Math.max(24, Math.hypot(dx, dy));
        this.input(dx / l, dy / l); await sleep(50);
      }
    }
    this.input(0, 0); await sleep(100);
  }

  /** Commands are paced to <= ~40/s so the bot stays under the server's 60 msgs/s limit (like a human-driven client). */
  async cmd(op: CmdOp | string, a?: Record<string, unknown>, timeoutMs = 6000): Promise<Res> {
    const role = SERVICE_ROLE[op as CmdOp] ?? (op === 'travel' && ['whispering_glade', 'ashen_hollow'].includes(String(a?.zone)) ? 'waypoint' : op === 'riftEnter' ? 'obelisk' : undefined);
    if (role) await this.approachService(role);
    return this.rawCmd(op, a, timeoutMs);
  }

  async rawCmd(op: CmdOp | string, a?: Record<string, unknown>, timeoutMs = 6000, retryId?: number): Promise<Res> {
    const wait = this.lastCmdAt + 25 - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCmdAt = Date.now();
    return new Promise((resolve) => {
      const id = retryId ?? this.nextCmd++;
      this.lastCommandId = id;
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, err: 'TIMEOUT' }); }, timeoutMs);
      this.pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
      this.send({ t: 'cmd', id, op: op as CmdOp, a });
    });
  }

  input(mx: number, my: number, dash = false) {
    const msg: C2S = { t: 'in', seq: ++this.seq, mx, my };
    if (dash) msg.dash = 1;
    this.send(msg);
  }

  async waitFor<T>(pred: () => T | false | undefined | null, ms = 3000): Promise<T | null> {
    const end = Date.now() + ms;
    for (;;) {
      const v = pred();
      if (v) return v;
      if (Date.now() >= end) return null;
      await sleep(15);
    }
  }

  /** hello and wait for welcome (resolves true) or for the server to refuse (false). */
  async login(classId: ClassId, v = PROTOCOL_VERSION): Promise<boolean> {
    this.send({ t: 'hello', name: this.name, classId, v });
    const r = await this.waitFor(() => this.welcomeAt > 0 || this.closed || this.errs.length > 0, 8000);
    return !!r && this.welcomeAt > 0;
  }

  close() { try { this.ws.close(); } catch { /* ignore */ } }

  inv(): Item[] { return this.char.inventory.filter((i): i is Item => !!i); }
  findInv(pred: (i: Item) => boolean): Item | undefined { return this.inv().find(pred); }
  gem(k: string): number { return this.char.gems[k] ?? 0; }
}

async function connect(url: string, name: string, classId: ClassId): Promise<Bot> {
  const b = new Bot(url, name);
  await b.open();
  const ok = await b.login(classId);
  if (!ok) throw new Error(`login failed for ${name}: ${b.errs.join(' | ') || JSON.stringify(b.closed)}`);
  return b;
}

// ─────────────────────────── Server process ───────────────────────────

interface Srv {
  url: string;
  dataDir: string | null;
  child: ChildProcess | null;
  stderr: string[];
  stop(): Promise<{ code: number | null; log: string }>;
}

async function startServer(): Promise<Srv> {
  const urlArg = opt('url') ?? process.env.BOT_URL;
  if (urlArg) {
    const dataDir = opt('data') ?? process.env.DATA_DIR ?? null;
    return { url: urlArg, dataDir, child: null, stderr: [], stop: async () => ({ code: 0, log: '' }) };
  }
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hearthfall-bot-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(ROOT, 'server/src/main.ts')], {
    cwd: ROOT,
    env: { ...process.env, BACKUP_DIR: '', ENABLE_DEBUG: '1', DISABLE_DEBUG: '0', PORT: String(port), DATA_DIR: dataDir, XP_MULT: process.env.XP_MULT ?? '3' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let log = '';
  const stderr: string[] = [];
  child.stdout!.on('data', (d) => { log += d; if (VERBOSE) process.stdout.write(`[server] ${d}`); });
  child.stderr!.on('data', (d) => { log += d; stderr.push(String(d)); if (VERBOSE) process.stdout.write(`[server ERR] ${d}`); });
  const exited = new Promise<number | null>((r) => child.once('close', (code) => r(code)));
  const ready = await Promise.race([
    new Promise<boolean>((resolve) => {
      const iv = setInterval(() => { if (log.includes('listening on')) { clearInterval(iv); resolve(true); } }, 50);
      setTimeout(() => { clearInterval(iv); resolve(false); }, 30000);
    }),
    exited.then(() => false),
  ]);
  if (!ready) { child.kill('SIGKILL'); throw new Error(`server did not start:\n${log}`); }
  return {
    url: `ws://127.0.0.1:${port}/ws`, dataDir, child, stderr,
    stop: async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        if (process.platform === 'win32') {
          await new Promise<void>((resolve, reject) => child.send('hearthfall:shutdown', err => err ? reject(err) : resolve()));
        } else child.kill('SIGTERM');
        const code = await Promise.race([exited, new Promise<number>(resolve => {
          timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(-1); }, 10000);
        })]);
        return { code, log };
      } finally { if (timeout) clearTimeout(timeout); }
    },
  };
}

// ─────────────────────────── Anonymous / protocol tests ───────────────────────────

async function testProtocol(url: string) {
  section('protocol: validation, ping, flood');

  // Invalid names are refused with an error and a close.
  for (const bad of ['a', 'x'.repeat(17), 'bad name', 'ba!d', '']) {
    const b = new Bot(url, bad);
    await b.open();
    const ok = await b.login('warrior');
    await b.waitFor(() => b.closed, 3000);
    check(`refuses invalid name "${bad}"`, !ok && b.errs.length > 0 && !!b.closed, { errs: b.errs, closed: b.closed });
  }
  // Wrong class, wrong protocol version.
  {
    const b = new Bot(url, `Cls${RUN}`);
    await b.open();
    const ok = await b.login('paladin' as ClassId);
    await b.waitFor(() => b.closed, 3000);
    check('refuses unknown class', !ok && !!b.closed);
  }
  {
    const b = new Bot(url, `Ver${RUN}`);
    await b.open();
    const ok = await b.login('warrior', 999);
    await b.waitFor(() => b.closed, 3000);
    check('refuses protocol version mismatch', !ok && !!b.closed);
  }
  // Messages before hello are ignored (no crash, no response except pong).
  {
    const b = new Bot(url, `Pre${RUN}`);
    await b.open();
    const r = await b.cmd('equip', { itemId: 'x' }, 800);
    check('cmd before hello is ignored', !r.ok && r.err === 'TIMEOUT');
    b.send({ t: 'ping', c: 42 });
    await b.waitFor(() => b.pongs.length > 0, 2000);
    check('ping works before hello', b.pongs[0]?.c === 42 && typeof b.pongs[0].s === 'number');
    b.close();
  }
  // Garbage frames do not kill the server or the connection.
  {
    const b = new Bot(url, `Junk${RUN}`);
    await b.open();
    b.ws.send(Buffer.from([0xc1, 0xff, 0x00]));
    b.ws.send('not binary');
    b.ws.send(packr.pack({ nope: 1 }));
    b.ws.send(packr.pack([1, 2, 3]));
    b.send({ t: 'ping', c: 7 });
    const got = await b.waitFor(() => b.pongs.length > 0, 2000);
    check('survives garbage frames', !!got && !b.closed);
    // Flood: more than 60 messages in one second are dropped.
    for (let i = 0; i < 200; i++) b.send({ t: 'ping', c: i });
    await sleep(600);
    check('flood is rate limited (<= ~65 of 200 pings answered)', b.pongs.length <= 66, b.pongs.length);
    check('flooder is not disconnected for a short burst', !b.closed);
    b.close();
  }
  // Login timeout is exercised implicitly by the server (10 s); not waited for here.
}

// ─────────────────────────── Per-class test ───────────────────────────

async function testClass(url: string, classId: ClassId, dataDir: string | null) {
  const tag = `[${classId}]`;
  const c = (name: string, cond: unknown, detail?: unknown) => check(`${tag} ${name}`, cond, detail);
  const name = `Bot${classId.slice(0, 3)}${RUN}`;
  console.log(`\n== ${tag} ${name}`);

  const b = await connect(url, name, classId);

  // ── welcome / char
  c('welcome has entity id', b.you > 0);
  c('welcome char matches name/class', b.char.name === name && b.char.classId === classId, { name: b.char.name, cls: b.char.classId });
  c('new character is level 1 with 60 inventory slots', b.char.level === 1 && b.char.inventory.length === INVENTORY_SIZE);
  c('welcome carries derived stats', b.derived.life > 0 && b.derived.weaponMax > 0, b.derived.life);
  c('derived equals shared computeStats(char)', JSON.stringify(b.derived) === JSON.stringify(computeStats(b.char)));
  c('placed in town channel', b.zone.kind === 'town' && b.zone.zone === 'hearthmere' && b.zone.channel >= 1, b.zone);
  c('welcome has world info', !!b.world && b.world.online >= 1 && b.world.channels.length >= 3);
  const gotSnap = await b.waitFor(() => b.snapshots >= 3, 4000);
  c('receives snapshots after welcome', !!gotSnap);
  const firstSnap = b.snap;
  c('first snapshot follows the welcome (zone message ordering)', !!firstSnap && b.badSnapshots === 0 && b.orderViolations === 0, b.orderViolations);
  const sysWelcome = b.chats.find((m) => m.ch === 'system');
  c('system welcome line', !!sysWelcome);

  // Movement works: send inputs, position changes, ack follows.
  for (const [op, role] of Object.entries(SERVICE_ROLE)) {
    const n = generateMap(b.zone.zone, b.zone.seed).town!.npcs.find(n => n.role === role)!;
    const before = JSON.stringify(b.char);
    const rejected = await b.rawCmd(op, { x: n.x, y: n.y, npcId: n.id, itemId: 'spoof' });
    c(`${op} rejects remote/spoofed service access over WebSocket`, !rejected.ok && /Stand beside/.test(rejected.err ?? ''), rejected);
    c(`${op} rejection preserves save`, JSON.stringify(b.char) === before);
  }
  const x0 = b.me!.x, y0 = b.me!.y;
  for (let i = 0; i < 20; i++) { b.input(1, 0); await sleep(TICK_MS); }
  await sleep(150);
  c('movement input moves the player', Math.hypot(b.me!.x - x0, b.me!.y - y0) > 30, { x0, y0, x: b.me!.x, y: b.me!.y });
  c('ack follows input seq', b.lastAck > 0 && b.lastAck <= b.seq, { ack: b.lastAck, seq: b.seq });
  b.input(0, 0);

  b.send({ t: 'ping', c: 123.5 });
  await b.waitFor(() => b.pongs.some((p) => p.c === 123.5), 2000);
  c('pong echoes client time and adds server time', b.pongs.some((p) => p.c === 123.5 && p.s > 1e12));

  // Duplicate login is refused while online.
  {
    const dup = new Bot(url, name.toUpperCase(), classId);
    await dup.open();
    const ok = await dup.login(classId);
    await dup.waitFor(() => dup.closed, 3000);
    c('same character cannot log in twice (case-insensitive)', !ok && dup.errs.some((e) => /already online/i.test(e)) && !!dup.closed, dup.errs);
    c('original session unaffected by duplicate attempt', !b.closed);
  }

  // ── command validation before levelling
  section2(tag, 'command validation');
  let r = await b.cmd('bogusOp');
  c('unknown op rejected', !r.ok && /unknown/i.test(r.err ?? ''), r);
  r = await b.cmd('equip', {});
  c('equip without itemId rejected', !r.ok, r);
  r = await b.cmd('equip', { itemId: 'nope' });
  c('equip unknown item rejected', !r.ok && /not in inventory/i.test(r.err ?? ''), r);
  r = await b.cmd('swapInv', { from: 0, to: 9999 });
  c('swapInv out of range rejected', !r.ok, r);
  r = await b.cmd('swapInv', { from: 5, to: 6 });
  c('swapInv from empty slot rejected', !r.ok, r);
  r = await b.cmd('unequip', { slot: 'head' });
  c('unequip empty slot rejected', !r.ok, r);
  r = await b.cmd('unequip', { slot: 'bogus' });
  c('unequip bad slot rejected', !r.ok, r);
  r = await b.cmd('salvage', { itemId: 'nope' });
  c('salvage unknown item rejected', !r.ok, r);
  r = await b.cmd('enchantRoll', { itemId: 'nope', affix: 0 });
  c('enchant before Cube level 3 rejected', !r.ok && /Cube level 3/.test(r.err ?? ''), r);
  r = await b.cmd('debug', { op: 'nonsense' });
  c('unknown debug op rejected', !r.ok, r);
  r = await b.cmd('travel', { zone: 'rift' });
  c('travel to rift zone rejected', !r.ok, r);
  r = await b.cmd('travel', { zone: 'hearthmere' });
  c('travel to current town rejected', !r.ok, r);
  r = await b.cmd('travel', { zone: 'nowhere' });
  c('travel to unknown zone rejected', !r.ok, r);
  r = await b.cmd('leave');
  c('leave in town rejected', !r.ok, r);
  r = await b.cmd('riftEnter');
  c('riftEnter without an open rift rejected', !r.ok, r);
  r = await b.cmd('riftOpen', { difficulty: 4 });
  c('Torment rift below level 60 rejected', !r.ok && /level 60/.test(r.err ?? ''), r);
  r = await b.cmd('riftOpen', { difficulty: 99 });
  c('unknown difficulty rejected', !r.ok, r);
  r = await b.cmd('channel', { n: 0 });
  c('channel 0 rejected', !r.ok, r);
  r = await b.cmd('channel', { n: 1 });
  c('switching to the current channel rejected', !r.ok, r);
  r = await b.cmd('skillTier', { skill: 'nonsense' });
  c('skillTier unknown skill rejected', !r.ok, r);
  r = await b.cmd('paragon', { stat: 'p_main', n: 1 });
  c('paragon without points rejected', !r.ok, r);
  r = await b.cmd('fuseGem', { gem: 'ruby', rank: 1 });
  c('fuseGem before Cube level 2 rejected', !r.ok, r);

  // ── debug ops
  section2(tag, 'debug ops');
  const lifeL1 = b.derived.life;
  r = await b.cmd('debug', { op: 'level', n: 69 });
  c('debug level +69 -> 70', r.ok && b.char.level === 70, { r, level: b.char.level });
  c('char message arrives before res (fresh char after cmd)', b.char.level === 70);
  c('derived recomputed after level-up', b.derived.life > lifeL1, { before: lifeL1, after: b.derived.life });
  c('skill points granted', b.char.skillPoints >= 60, b.char.skillPoints);
  r = await b.cmd('debug', { op: 'level' });
  c('debug level at max rejected', !r.ok, r);
  r = await b.cmd('debug', { op: 'gold' });
  c('debug gold', r.ok && b.char.gold >= 10_000_000, b.char.gold);
  r = await b.cmd('debug', { op: 'mats', n: 200 });
  c('debug mats (+ gems)', r.ok && b.char.materials.soul >= 200 && b.gem('ruby:1') >= 9, { m: b.char.materials, g: b.char.gems });
  r = await b.cmd('debug', { op: 'paragon', n: 40 });
  c('debug paragon', r.ok && b.char.paragon.level === 40, b.char.paragon);
  r = await b.cmd('debug', { op: 'legendaries' });
  const legCount = b.inv().filter((i) => i.rarity === 'legendary').length;
  c('debug legendaries fills free slots with class-usable legendaries', r.ok && legCount >= 9, { r, legCount });
  c('debug legendaries are ilvl 70', b.inv().filter((i) => i.rarity === 'legendary').every((i) => i.ilvl === 70));
  const classOnly = Object.values(LEGENDARIES).filter((l) => l.classes?.includes(classId)).map((l) => l.id);
  c('debug legendaries include every class legendary', classOnly.every((id) => b.inv().some((i) => i.legendary?.power === id)), classOnly);
  r = await b.cmd('debug', { op: 'set' });
  c('debug set grants six class set pieces', r.ok && b.inv().filter((i) => i.rarity === 'set').length === 6, { r, n: b.inv().filter((i) => i.rarity === 'set').length });
  r = await b.cmd('debug', { op: 'rares', n: 8 });
  c('debug rares', r.ok && b.inv().filter((i) => i.rarity === 'rare').length >= 1, r);

  // Real persistent stash: use the same id through transfer/retry/relogin, with actual NPC approach.
  const stored = b.findInv(i => i.rarity === 'rare')!;
  r = await b.cmd('stashDeposit', { itemId: stored.id });
  c('stash deposit moves one item out of the bag', r.ok && !b.inv().some(i => i.id === stored.id) && b.char.stash.some(i => i?.id === stored.id), r);
  r = await b.rawCmd('stashDeposit', { itemId: stored.id });
  c('repeated deposit is rejected without duplication', !r.ok && b.char.stash.filter(i => i?.id === stored.id).length === 1, r);
  r = await b.cmd('stashWithdraw', { itemId: stored.id });
  c('stash withdrawal preserves the complete item', r.ok && JSON.stringify(b.findInv(i => i.id === stored.id)) === JSON.stringify(stored), r);
  await b.cmd('stashDeposit', { itemId: stored.id });

  // ── equip / unequip / swap / destroy
  section2(tag, 'inventory & equipment');
  const mainhand = b.findInv((i) => i.rarity === 'legendary' && (i.kind === 'weapon1h' || i.kind === 'weapon2h'));
  c('have a legendary weapon to equip', !!mainhand);
  if (mainhand) {
    const dpsBefore = b.derived.sheetDps;
    r = await b.cmd('equip', { itemId: mainhand.id });
    c('equip legendary weapon', r.ok && b.char.equipment.mainhand?.id === mainhand.id, r);
    c('equipped item is bound', b.char.equipment.mainhand?.bound === true);
    c('equipped item left the inventory', !b.inv().some((i) => i.id === mainhand.id));
    c('derived powers include the legendary power', (b.derived.powers[mainhand.legendary!.power] ?? 0) > 0, b.derived.powers);
    c('sheet DPS changed after equip', b.derived.sheetDps !== dpsBefore, { dpsBefore, now: b.derived.sheetDps });
    r = await b.cmd('unequip', { slot: 'mainhand' });
    c('unequip weapon', r.ok && !b.char.equipment.mainhand && b.inv().some((i) => i.id === mainhand.id), r);
    r = await b.cmd('equip', { itemId: mainhand.id, slot: 'mainhand' });
    c('equip with explicit slot', r.ok && !!b.char.equipment.mainhand, r);
  }
  const wrongClass = Object.values(LEGENDARIES).find((l) => l.classes && !l.classes.includes(classId));
  const foreign = wrongClass && b.findInv((i) => i.legendary?.power === wrongClass.id);
  c('class-restricted legendaries of other classes are not handed out by debug', !foreign);
  // swap two occupied slots and one into an empty slot
  const idxA = b.char.inventory.findIndex((i) => !!i);
  const idxB = b.char.inventory.findIndex((i, n) => !!i && n !== idxA);
  const idA = b.char.inventory[idxA]!.id, idB = b.char.inventory[idxB]!.id;
  r = await b.cmd('swapInv', { from: idxA, to: idxB });
  c('swapInv swaps two items', r.ok && b.char.inventory[idxA]?.id === idB && b.char.inventory[idxB]?.id === idA, r);
  const emptyIdx = b.char.inventory.findIndex((i) => i === null);
  r = await b.cmd('swapInv', { from: idxA, to: emptyIdx });
  c('swapInv moves into an empty slot', r.ok && b.char.inventory[emptyIdx]?.id === idB && b.char.inventory[idxA] === null, r);
  const rareToDestroy = b.findInv((i) => i.rarity === 'rare');
  if (rareToDestroy) {
    const n = b.inv().length;
    r = await b.cmd('destroy', { itemId: rareToDestroy.id });
    c('destroy removes the item', r.ok && b.inv().length === n - 1 && !b.inv().some((i) => i.id === rareToDestroy.id), r);
  }
  r = await b.cmd('destroy', { itemId: b.char.equipment.mainhand?.id ?? 'x' });
  c('destroy refuses equipped items', !r.ok, r);

  // ── salvage
  section2(tag, 'cube: salvage');
  const soulBefore = b.char.materials.soul;
  const leg1 = b.findInv((i) => i.rarity === 'legendary')!;
  const cxp0 = b.char.cube.xp + b.char.cube.level * 1e6;
  r = await b.cmd('salvage', { itemId: leg1.id });
  c('salvage a legendary gives souls and Cube XP', r.ok && b.char.materials.soul > soulBefore && b.char.cube.xp + b.char.cube.level * 1e6 > cxp0 && !b.inv().some((i) => i.id === leg1.id), r);
  r = await b.cmd('salvageAll', { rarities: ['rare'] });
  c('salvageAll rares', r.ok && !b.inv().some((i) => i.rarity === 'rare') && r.data?.count >= 1, r);
  r = await b.cmd('salvageAll', { rarities: ['rare'] });
  c('salvageAll with nothing to salvage rejected', !r.ok, r);
  r = await b.cmd('salvageAll', { rarities: ['bogus'] });
  c('salvageAll bad rarity rejected', !r.ok, r);
  r = await b.cmd('salvageAll', { rarities: [] });
  c('salvageAll empty list rejected', !r.ok, r);

  // Level the Cube to 8 by salvaging debug legendaries (each op grants Cube XP).
  let guard = 0;
  while (b.char.cube.level < 8 && guard++ < 60) {
    await b.cmd('debug', { op: 'legendaries' });
    await b.cmd('debug', { op: 'set' });
    await b.cmd('salvageAll', { rarities: ['legendary', 'set'] });
  }
  c('Cube reached level 8 through salvage XP', b.char.cube.level >= 8, { level: b.char.cube.level, xp: b.char.cube.xp, need: cubeXpToNext(b.char.cube.level) });

  // Fresh supplies for the Cube recipes.
  await b.cmd('debug', { op: 'gold', n: 100_000_000 });
  await b.cmd('debug', { op: 'mats', n: 500 });
  await b.cmd('debug', { op: 'legendaries' });
  await b.cmd('debug', { op: 'rares', n: 10 });

  // ── enchant
  section2(tag, 'cube: enchant');
  const target = b.findInv((i) => i.rarity === 'legendary' && i.affixes.length >= 3 && i.enchanted === undefined)!;
  c('have an item to enchant', !!target);
  r = await b.cmd('enchantPick', { itemId: target.id, choice: 1 });
  c('enchantPick without a roll rejected', !r.ok, r);
  const goldE = b.char.gold;
  r = await b.cmd('enchantRoll', { itemId: target.id, affix: 1 });
  const opts = r.data?.options as { stat: string; value: number; min: number; max: number }[] | undefined;
  c('enchantRoll returns two options', r.ok && Array.isArray(opts) && opts.length === 2, r);
  c('enchantRoll charges gold', b.char.gold < goldE, { before: goldE, after: b.char.gold });
  c('enchant options are different stats within their ranges', !!opts && opts[0].stat !== opts[1].stat && opts.every((o) => o.value >= o.min - 1e-6 && o.value <= o.max + 1e-6 && o.max > 0), opts);
  c('enchant options differ from the original stat', !!opts && opts.every((o) => o.stat !== target.affixes[1].stat), { orig: target.affixes[1].stat, opts });
  r = await b.cmd('enchantPick', { itemId: target.id, choice: 3 });
  c('enchantPick bad choice rejected', !r.ok, r);
  r = await b.cmd('enchantPick', { itemId: target.id, choice: 2 });
  const enchanted = b.findInv((i) => i.id === target.id)!;
  c('enchantPick applies option 2', r.ok && !!opts && enchanted.affixes[1].stat === opts[1].stat && enchanted.affixes[1].value === opts[1].value, { r, now: enchanted.affixes[1], opts });
  c('enchanted flag, count and bound set', enchanted.enchanted === 1 && enchanted.enchantCount === 1 && enchanted.bound === true, { e: enchanted.enchanted, n: enchanted.enchantCount });
  r = await b.cmd('enchantRoll', { itemId: target.id, affix: 0 });
  c('only one affix may ever be enchanted', !r.ok, r);
  r = await b.cmd('enchantRoll', { itemId: target.id, affix: 1 });
  c('the enchanted affix can be rerolled (cost escalates)', r.ok && b.char.inventory.find((i) => i?.id === target.id)?.enchantCount === 1, r);
  r = await b.cmd('enchantPick', { itemId: target.id, choice: 0 });
  c('enchantPick 0 keeps the original', r.ok && b.findInv((i) => i.id === target.id)!.affixes[1].stat === opts![1].stat && b.findInv((i) => i.id === target.id)!.enchantCount === 2, r);

  // ── upgrade
  section2(tag, 'cube: upgrade');
  const up = b.findInv((i) => i.rarity === 'legendary' && i.id !== target.id)!;
  let tier = 0;
  for (let i = 0; i < 3; i++) {
    r = await b.cmd('upgrade', { itemId: up.id });
    if (!r.ok) break;
    if (r.data?.success) tier++;
  }
  c('three guaranteed upgrade steps succeed (+3)', b.findInv((i) => i.id === up.id)?.upgrade === 3 && tier === 3, { tier, item: b.findInv((i) => i.id === up.id)?.upgrade });
  c('upgraded item is bound with fortune reset', b.findInv((i) => i.id === up.id)?.bound === true && b.findInv((i) => i.id === up.id)?.upgradeFortune === 0);
  // push until a failure shows up: fortune must rise on failure
  let sawFail = false;
  for (let i = 0; i < 12 && !sawFail; i++) {
    const before = b.findInv((x) => x.id === up.id)!;
    if (before.upgrade >= 10) break;
    r = await b.cmd('upgrade', { itemId: up.id });
    if (!r.ok) { c('upgrade failure is only due to cost', /enough/i.test(r.err ?? ''), r); break; }
    if (!r.data.success) {
      sawFail = true;
      const after = b.findInv((x) => x.id === up.id)!;
      c('failed upgrade adds Fortune and keeps the tier', after.upgradeFortune > 0 && after.upgrade === before.upgrade, { before: before.upgradeFortune, after: after.upgradeFortune });
    }
  }
  r = await b.cmd('upgrade', { itemId: 'nope' });
  c('upgrade unknown item rejected', !r.ok, r);

  // ── transmute
  section2(tag, 'cube: transmute / extract / reforge');
  const nonRare = b.findInv((i) => i.rarity === 'legendary')!;
  r = await b.cmd('transmute', { itemId: nonRare.id });
  c('transmute of a non-rare rejected', !r.ok && /Rare/.test(r.err ?? ''), r);
  let transmuted: Item | null = null;
  for (const rare of b.inv().filter((i) => i.rarity === 'rare')) {
    r = await b.cmd('transmute', { itemId: rare.id });
    if (r.ok) {
      transmuted = r.data.item as Item;
      c('transmute turns a Rare into a Legendary/Set of the same kind', (transmuted.rarity === 'legendary' || transmuted.rarity === 'set') && transmuted.kind === rare.kind, { from: rare.kind, to: transmuted.kind, rarity: transmuted.rarity });
      c('transmuted item replaced the rare in the inventory', !b.inv().some((i) => i.id === rare.id) && b.inv().some((i) => i.id === transmuted!.id));
      break;
    } else if (!/No Legendary/.test(r.err ?? '')) {
      c('transmute failure reason', false, r);
      break;
    }
  }
  c('at least one transmute succeeded', !!transmuted);

  // extract: pick a legendary power that is not yet learned
  const ex = b.findInv((i) => i.rarity === 'legendary' && !!i.legendary && !b.char.cube.learned.includes(i.legendary.power))!;
  const power = ex.legendary!.power;
  r = await b.cmd('extract', { itemId: ex.id });
  c('extract learns the power and destroys the item', r.ok && b.char.cube.learned.includes(power) && !b.inv().some((i) => i.id === ex.id), r);
  const dupe = b.findInv((i) => i.legendary?.power === power);
  if (dupe) {
    r = await b.cmd('extract', { itemId: dupe.id });
    c('extracting an already learned power rejected (item kept)', !r.ok && b.inv().some((i) => i.id === dupe.id), r);
  }
  const slotIdx = ['weapon', 'armor', 'jewelry'].indexOf(LEGENDARIES[power].cubeSlot);
  r = await b.cmd('cubeEquip', { slot: (slotIdx + 1) % 3, power });
  c('cubeEquip into the wrong slot rejected', !r.ok, r);
  r = await b.cmd('cubeEquip', { slot: slotIdx, power: 'ninefold_gale_x' });
  c('cubeEquip unknown power rejected', !r.ok, r);
  r = await b.cmd('cubeEquip', { slot: slotIdx, power });
  c('cubeEquip equips a learned power', r.ok && b.char.cube.equipped[slotIdx] === power && (b.derived.powers[power] ?? 0) > 0, { r, eq: b.char.cube.equipped, powers: b.derived.powers });
  r = await b.cmd('cubeEquip', { slot: slotIdx, power: null });
  c('cubeEquip null clears the slot', r.ok && b.char.cube.equipped[slotIdx] === null, r);
  const other = b.findInv((i) => i.rarity === 'legendary' && !!i.legendary && !b.char.cube.learned.includes(i.legendary.power));
  if (other) {
    r = await b.cmd('cubeEquip', { slot: ['weapon', 'armor', 'jewelry'].indexOf(LEGENDARIES[other.legendary!.power].cubeSlot), power: other.legendary!.power });
    c('cubeEquip of an unlearned power rejected', !r.ok, r);
  }

  const rf = b.findInv((i) => i.rarity === 'legendary')!;
  const rfPower = rf.legendary!.power;
  r = await b.cmd('reforge', { itemId: rf.id });
  const rfAfter = b.findInv((i) => i.id === rf.id);
  c('reforge keeps id, power and rarity', r.ok && !!rfAfter && rfAfter.legendary?.power === rfPower && rfAfter.rarity === 'legendary' && rfAfter.upgrade === 0, r);
  const normalish = b.findInv((i) => i.rarity === 'rare');
  if (normalish) {
    r = await b.cmd('reforge', { itemId: normalish.id });
    c('reforge of a rare rejected', !r.ok, r);
  }

  // ── sockets and gems
  section2(tag, 'cube: socket & gems');
  const sockable = b.findInv((i) => maxSockets(i) > i.sockets.length)!;
  c('have a socketable item', !!sockable);
  const socketsBefore = sockable.sockets.length;
  r = await b.cmd('socket', { itemId: sockable.id });
  c('socket adds one empty socket', r.ok && b.findInv((i) => i.id === sockable.id)!.sockets.length === socketsBefore + 1, r);
  const full = b.findInv((i) => i.sockets.length >= maxSockets(i));
  if (full) {
    r = await b.cmd('socket', { itemId: full.id });
    c('socket beyond the base maximum rejected', !r.ok, r);
  }
  const rubies = b.gem('ruby:1');
  r = await b.cmd('insertGem', { itemId: sockable.id, gem: 'ruby', rank: 1 });
  c('insertGem puts a gem into the first empty socket', r.ok && b.gem('ruby:1') === rubies - 1 && b.findInv((i) => i.id === sockable.id)!.sockets.some((g) => g?.gem === 'ruby'), r);
  for (let i = 0; i < 4 && b.findInv((x) => x.id === sockable.id)!.sockets.some((g) => g === null); i++) {
    r = await b.cmd('insertGem', { itemId: sockable.id, gem: 'emerald', rank: 1 });
  }
  r = await b.cmd('insertGem', { itemId: sockable.id, gem: 'ruby', rank: 1 });
  c('insertGem with no empty socket rejected', !r.ok, r);
  r = await b.cmd('insertGem', { itemId: sockable.id, gem: 'bogus', rank: 1 });
  c('insertGem unknown gem rejected', !r.ok, r);
  r = await b.cmd('insertGem', { itemId: sockable.id, gem: 'ruby', rank: 6 });
  c('insertGem with a gem you do not own rejected', !r.ok, r);
  const goldG = b.char.gold;
  const gemIdx = b.findInv((i) => i.id === sockable.id)!.sockets.findIndex((g) => g?.gem === 'ruby');
  r = await b.cmd('removeGem', { itemId: sockable.id, idx: gemIdx });
  c('removeGem returns the gem and costs gold', r.ok && b.gem('ruby:1') === rubies && goldG - b.char.gold === gemRemoveCost(1), { r, spent: goldG - b.char.gold });
  r = await b.cmd('removeGem', { itemId: sockable.id, idx: gemIdx });
  c('removeGem from an empty socket rejected', !r.ok, r);
  const r1 = b.gem('ruby:1'), r2 = b.gem('ruby:2');
  r = await b.cmd('fuseGem', { gem: 'ruby', rank: 1 });
  c('fuseGem turns 3 gems into 1 of the next rank', r.ok && b.gem('ruby:1') === r1 - 3 && b.gem('ruby:2') === r2 + 1, { r, g: b.char.gems });
  const fusionId = b.lastCommandId, fusionReply = r;
  const afterFusion = JSON.stringify({ gems: b.char.gems, gold: b.char.gold, cube: b.char.cube });
  const repeatedFusion = await b.rawCmd('fuseGem', { rank: 1, gem: 'ruby' }, 6000, fusionId);
  c('replayed fusion returns the original result', JSON.stringify(repeatedFusion) === JSON.stringify(fusionReply), repeatedFusion);
  c('replayed fusion preserves gems, payment and Cube XP', JSON.stringify({ gems: b.char.gems, gold: b.char.gold, cube: b.char.cube }) === afterFusion);
  const mismatchedFusion = await b.rawCmd('fuseGem', { gem: 'ruby', rank: 2 }, 6000, fusionId);
  c('reusing fusion ID for changed parameters is refused', !mismatchedFusion.ok && mismatchedFusion.err?.includes('different'), mismatchedFusion);
  r = await b.cmd('fuseGem', { gem: 'ruby', rank: 6 });
  c('fuseGem at max rank rejected', !r.ok, r);
  r = await b.cmd('fuseGem', { gem: 'ruby', rank: 5 });
  c('fuseGem without 3 gems rejected', !r.ok, r);
  // equipped item socketing (refreshPlayer path)
  const eqChest = b.findInv((i) => i.kind === 'chest');
  if (eqChest) {
    r = await b.cmd('equip', { itemId: eqChest.id });
    if (r.ok) {
      r = await b.cmd('socket', { itemId: eqChest.id });
      const sock = b.char.equipment.chest!.sockets.findIndex((g) => g === null);
      if (r.ok && sock >= 0) {
        const lifeBefore = b.derived.life;
        r = await b.cmd('insertGem', { itemId: eqChest.id, gem: 'amethyst', rank: 2 });
        c('gem in an equipped item updates derived stats (vitality)', r.ok && b.derived.life >= lifeBefore, { r, lifeBefore, after: b.derived.life });
      }
    }
  }

  // ── skills
  section2(tag, 'skills');
  const unlocked = skillsForClass(classId).filter((s) => s.kind !== 'primary' && s.unlock <= 70);
  const sk = unlocked[1] ?? unlocked[0];
  r = await b.cmd('skillSlot', { slot: 2, skill: sk.id });
  c('skillSlot assigns a skill', r.ok && b.char.skills.slots[2] === sk.id, r);
  r = await b.cmd('skillSlot', { slot: 4, skill: sk.id });
  c('skillSlot bad slot rejected', !r.ok, r);
  const foreignSkill = Object.values(SKILLS).find((s) => s.classId !== classId)!;
  r = await b.cmd('skillSlot', { slot: 1, skill: foreignSkill.id });
  c('skillSlot with another class skill rejected', !r.ok, r);
  r = await b.cmd('skillSlot', { slot: 2, skill: null });
  c('skillSlot null empties the slot', r.ok && b.char.skills.slots[2] === null, r);
  const rune = SKILLS[sk.id].runes[0].id;
  r = await b.cmd('skillRune', { skill: sk.id, rune });
  c('skillRune selects a rune', r.ok && b.char.skills.runes[sk.id] === rune, r);
  r = await b.cmd('skillRune', { skill: sk.id, rune: 'bogus' });
  c('skillRune unknown rune rejected', !r.ok, r);
  const sp0 = b.char.skillPoints;
  r = await b.cmd('skillTier', { skill: sk.id });
  c('skillTier buys a tier and spends points', r.ok && b.char.skills.tiers[sk.id] === 1 && b.char.skillPoints < sp0, { r, sp0, sp: b.char.skillPoints });
  r = await b.cmd('skillReset');
  c('skillReset refunds points', r.ok && Object.keys(b.char.skills.tiers).length === 0 && b.char.skillPoints === sp0, { sp0, sp: b.char.skillPoints });
  r = await b.cmd('skillReset');
  c('skillReset with nothing to reset rejected', !r.ok, r);

  // ── paragon (40 levels: core 10, offense 10, defense 10, utility 10)
  section2(tag, 'paragon');
  const pts = paragonPoints(b.char.paragon.level);
  c('paragon points budget as expected', pts.core === 10 && pts.offense === 10, pts);
  r = await b.cmd('paragon', { stat: 'p_main', n: 4 });
  c('paragon spends points', r.ok && b.char.paragon.spent.p_main === 4, r);
  const dmain = b.derived.mainStat;
  r = await b.cmd('paragon', { stat: 'p_vit', n: 1000 });
  c('paragon clamps to the remaining category budget', r.ok && b.char.paragon.spent.p_vit === 6, { r, spent: b.char.paragon.spent });
  r = await b.cmd('paragon', { stat: 'p_ms', n: 1 });
  c('paragon refuses when the category budget is exhausted', !r.ok, r);
  r = await b.cmd('paragon', { stat: 'p_ias', n: 10 });
  c('paragon offense points', r.ok && b.char.paragon.spent.p_ias === 10, r);
  c('paragon affects derived stats', b.derived.ias > 0 && b.derived.mainStat >= dmain, { ias: b.derived.ias });
  r = await b.cmd('paragon', { stat: 'p_main', n: -2 });
  c('paragon negative n refunds points', r.ok && b.char.paragon.spent.p_main === 2, r);
  r = await b.cmd('paragon', { stat: 'p_bogus', n: 1 });
  c('paragon unknown stat rejected', !r.ok, r);
  r = await b.cmd('paragon', { stat: 'p_main', n: 0 });
  c('paragon n=0 rejected', !r.ok, r);
  r = await b.cmd('paragonReset');
  c('paragonReset clears spending', r.ok && Object.keys(b.char.paragon.spent).length === 0, r);
  // a capped stat: push p_ias to its cap (50 points) with a big budget
  await b.cmd('debug', { op: 'paragon', n: 400 });
  r = await b.cmd('paragon', { stat: 'p_ias', n: 999 });
  c('paragon respects per-stat caps', r.ok && b.char.paragon.spent.p_ias === 50, b.char.paragon.spent);
  r = await b.cmd('paragon', { stat: 'p_ias', n: 1 });
  c('paragon at cap rejected', !r.ok && /cap/i.test(r.err ?? ''), r);
  await b.cmd('paragonReset');

  // ── chat
  section2(tag, 'chat');
  const text = `hello from ${name}`;
  b.send({ t: 'chat', text });
  const echo = await b.waitFor(() => b.chats.find((m) => m.ch === 'zone' && m.text === text), 2000);
  c('zone chat is delivered (also to the sender)', !!echo && echo.from === name && echo.cls === classId, echo);
  b.send({ t: 'chat', text: 'x'.repeat(300) });
  const long = await b.waitFor(() => b.chats.find((m) => m.ch === 'zone' && m.text.startsWith('xxxx')), 2000);
  c('chat is limited to 200 characters', !!long && long.text.length === 200, long?.text.length);
  b.send({ t: 'chat', text: '   ' });
  b.send({ t: 'chat', text: 12 as unknown as string });
  b.send({ t: 'chat', text: '/who' });
  const who = await b.waitFor(() => b.chats.find((m) => m.ch === 'system' && /online/.test(m.text)), 2000);
  c('/who answers with a system line', !!who);
  const before = b.chats.length;
  for (let i = 0; i < 12; i++) b.send({ t: 'chat', text: `spam ${i}` });
  await sleep(500);
  const spam = b.chats.slice(before);
  c('chat is rate limited', spam.some((m) => m.ch === 'system' && /too quickly/.test(m.text)) && spam.filter((m) => m.ch === 'zone').length < 12, spam.map((m) => m.text));

  // ── rifts
  section2(tag, 'rifts');
  r = await b.cmd('riftOpen', { difficulty: 4 });
  c('Torment rift opens at level 70', r.ok && r.data?.difficulty === 4, r);
  c('world info flags the open rift immediately', b.world?.riftOpen === true, b.world);
  r = await b.cmd('riftOpen', { difficulty: 0 });
  c('a second riftOpen replaces the first (one per opener)', r.ok && r.data?.difficulty === 0, r);
  r = await b.cmd('riftEnter');
  c('riftEnter moves the player into the rift', r.ok && b.zone.kind === 'rift' && b.zone.zone === 'rift' && b.zone.instance.startsWith('rift#'), { r, zone: b.zone });
  c('rift zone carries level/difficulty', b.zone.difficulty === 0, b.zone);
  const riftSnap = await b.waitFor(() => b.snapshots > 0 && b.rift !== undefined && b.me, 4000);
  c('rift snapshots include rift state (progress/phase/owner)', !!riftSnap && b.rift!.owner === name && b.rift!.level === 70 && typeof b.rift!.progress === 'number', b.rift);
  r = await b.cmd('riftOpen');
  c('riftOpen inside a rift rejected', !r.ok, r);
  r = await b.cmd('travel', { zone: 'whispering_glade' });
  c('field travel from inside a rift rejected', !r.ok, r);
  r = await b.cmd('leave');
  c('leave returns from the rift to town', r.ok && b.zone.kind === 'town', { r, zone: b.zone });
  r = await b.cmd('riftEnter');
  c('the open rift can be re-entered after leaving it', r.ok && b.zone.kind === 'rift', r);
  r = await b.cmd('leave');
  c('leave again', r.ok && b.zone.kind === 'town', r);

  // ── travel, channels, field play
  section2(tag, 'travel & field');
  await b.cmd('debug', { op: 'set' });
  await b.cmd('debug', { op: 'legendaries' });
  let equipped = 0;
  for (const it of [...b.inv()].sort((x, y) => Number(y.rarity === 'set') - Number(x.rarity === 'set'))) {
    const e = await b.cmd('equip', { itemId: it.id });
    if (e.ok) equipped++;
  }
  c('equipped class gear for the field', equipped >= 5, equipped);
  c('derived still consistent with computeStats after many equips', JSON.stringify(b.derived) === JSON.stringify(computeStats(b.char)));
  r = await b.cmd('travel', { zone: 'whispering_glade' });
  c('travel to the field', r.ok && b.zone.zone === 'whispering_glade' && b.zone.kind === 'field' && b.zone.channel >= 1, { r, zone: b.zone });
  c('zone message precedes snapshots (first snapshot after each zone message describes the player)', b.zones.length >= 3 && b.orderViolations === 0, { zones: b.zones.length, violations: b.orderViolations });
  r = await b.cmd('travel', { zone: 'ashen_hollow' });
  c('field-to-field travel needs the waypoint', !r.ok, r);
  const ch1 = b.zone.channel;
  r = await b.cmd('channel', { n: ch1 + 1 });
  c('channel switch opens the next channel', r.ok && b.zone.channel === ch1 + 1, { r, zone: b.zone });
  r = await b.cmd('channel', { n: ch1 + 7 });
  c('arbitrary channel numbers rejected', !r.ok, r);
  r = await b.cmd('channel', { n: ch1 });
  c('switch back to the first channel', r.ok && b.zone.channel === ch1, r);
  r = await b.cmd('travel', { zone: 'hearthmere', channel: 1 });
  c('travel to town with an explicit channel', r.ok && b.zone.kind === 'town' && b.zone.channel === 1, { r, zone: b.zone });
  r = await b.cmd('travel', { zone: 'whispering_glade', channel: ch1 });
  c('travel to a field with an explicit channel', r.ok && b.zone.kind === 'field' && b.zone.channel === ch1, { r, zone: b.zone });
  await b.waitFor(() => b.me && b.snapshots > 0, 3000);

  await fieldPlay(b, c, FIELD_SECONDS);

  r = await b.cmd('travel', { zone: 'hearthmere' });
  c('travel back to town from the field', r.ok && b.zone.kind === 'town', { r, zone: b.zone });
  const world2 = await b.waitFor(() => (b.world && b.world.channels.length >= 4 ? b.world : null), 7000);
  c('periodic world info lists town and field channels', !!world2 && world2.channels.some((x) => x.zone === 'whispering_glade' && x.channel === ch1 + 1), world2);

  // ── persistence
  section2(tag, 'persistence');
  const snapshot = JSON.parse(JSON.stringify(b.char)) as CharacterSave;
  b.close();
  await b.waitFor(() => b.closed, 3000);
  await sleep(300);
  const b2 = await connect(url, name, classId);
  c('relogin finds the same character', b2.char.name === name && b2.char.level === 70 && b2.char.id === snapshot.id);
  c('relogin keeps inventory, equipment, cube, paragon, gems',
    JSON.stringify(b2.char.inventory) === JSON.stringify(snapshot.inventory)
    && JSON.stringify(b2.char.equipment) === JSON.stringify(snapshot.equipment)
    && JSON.stringify(b2.char.stash) === JSON.stringify(snapshot.stash)
    && JSON.stringify(b2.char.cube) === JSON.stringify(snapshot.cube)
    && b2.char.gold === snapshot.gold && JSON.stringify(b2.char.gems) === JSON.stringify(snapshot.gems));
  c('relogin places the character in town', b2.zone.kind === 'town');
  c('no AFK gains after a short absence', b2.afk === null);
  if (dataDir) {
    const file = path.join(dataDir, `${name.toLowerCase()}.json`);
    c('character file exists on disk', fs.existsSync(file), file);
    const onDisk = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as CharacterSave) : null;
    c('character file is valid JSON of the save', !!onDisk && onDisk.name === name && onDisk.level === 70);
    c('no temp files left behind', fs.readdirSync(dataDir).every((f) => !f.endsWith('.tmp')), fs.readdirSync(dataDir));
  }
  b2.close();
}

const section2 = (tag: string, title: string) => { if (VERBOSE) console.log(`-- ${tag} ${title}`); };

// ─────────────────────────── Field play ───────────────────────────

async function fieldPlay(b: Bot, c: (n: string, cond: unknown, d?: unknown) => boolean, seconds: number) {
  const map: MapData = generateMap(b.zone.zone, b.zone.seed, b.zone.theme);
  c('client-side map generation matches the zone info', map.w > 0 && map.spawns.length > 0, b.zone);
  const snap0 = b.snapshots;
  const dmg0 = b.events.dmg ?? 0, die0 = b.events.die ?? 0;
  const prog = (ch: CharacterSave) => ch.paragon.level * 1e12 + ch.paragon.xp + ch.level * 1e9 + ch.xp;
  const prog0 = prog(b.char);
  const kills0 = b.char.stats.kills;
  const visited = new Set<number>();
  let target: { x: number; y: number } | null = null;
  let travelled = 0, prev = { x: b.me!.x, y: b.me!.y };
  let lastProgressAt = Date.now(), lastProgressPos = { ...prev };
  let maxEnts = 0, sawMob = false, sawPlayerSelf = false;
  const t0 = Date.now();
  let dashAt = 0;

  while (Date.now() - t0 < seconds * 1000) {
    await sleep(TICK_MS);
    const me = b.me;
    if (!me) continue;
    travelled += Math.hypot(me.x - prev.x, me.y - prev.y);
    prev = { x: me.x, y: me.y };
    maxEnts = Math.max(maxEnts, b.ents.size);

    // nearest living monster
    let best: SeenEnt | null = null, bd = Infinity;
    for (const e of b.ents.values()) {
      if (e.desc.k === 'player' && e.desc.id === b.you) sawPlayerSelf = true;
      if (e.desc.k !== 'mob' || (e.flags & F_DEAD) || e.hp <= 0) continue;
      sawMob = true;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) target = { x: best.x, y: best.y };
    else if (!target || Math.hypot(target.x - me.x, target.y - me.y) < 120) {
      // walk to the nearest unvisited spawn (pack home)
      let bi = -1, bs = Infinity;
      map.spawns.forEach((sp, i) => { if (visited.has(i)) return; const d = Math.hypot(sp.x - me.x, sp.y - me.y); if (d < bs) { bs = d; bi = i; } });
      if (bi >= 0) { visited.add(bi); target = map.spawns[bi]; } else { visited.clear(); target = null; }
    }
    // unstick: no progress for 3 s -> pick another random spawn
    if (Math.hypot(me.x - lastProgressPos.x, me.y - lastProgressPos.y) > 40) { lastProgressAt = Date.now(); lastProgressPos = { x: me.x, y: me.y }; }
    else if (Date.now() - lastProgressAt > 3000) {
      target = map.spawns[Math.floor(Math.random() * map.spawns.length)] ?? null;
      lastProgressAt = Date.now();
    }
    if (!target) { b.input(0, 0); continue; }
    const dx = target.x - me.x, dy = target.y - me.y, dist = Math.hypot(dx, dy) || 1;
    const stand = best && dist < 70;
    const dash = Date.now() - dashAt > 6000 && dist > 400;
    if (dash) dashAt = Date.now();
    b.input(stand ? 0 : dx / dist, stand ? 0 : dy / dist, dash);
  }
  b.input(0, 0);
  await sleep(200);

  const snaps = b.snapshots - snap0;
  const expected = seconds * 20;
  c(`field: ~20 Hz snapshots (${snaps} in ${seconds}s)`, snaps >= expected * 0.6 && snaps <= expected * 1.4, { snaps, expected });
  c('field: all snapshots well-formed', b.badSnapshots === 0, b.badSnapshots);
  c('field: own player entity is replicated', sawPlayerSelf);
  c('field: monsters appear in the area of interest', sawMob && maxEnts > 3, { sawMob, maxEnts });
  c('field: bot moved around the map', travelled > 300, Math.round(travelled));
  c('field: ack tracks input sequence', Math.abs(b.seq - b.lastAck) < 12, { seq: b.seq, ack: b.lastAck });
  c('field: damage events seen', (b.events.dmg ?? 0) > dmg0, b.events);
  c('field: kill events (die) seen', (b.events.die ?? 0) > die0, b.events);
  await sleep(450);
  c('field: dealing damage and killing grants XP (char updates arrive)', b.ownDmg === 0 || prog(b.char) > prog0 || b.char.stats.kills > kills0, { ownDmg: b.ownDmg, before: prog0, after: prog(b.char), kills: b.char.stats.kills - kills0 });
  console.log(`  [${b.char.classId}] field summary: ${snaps} snapshots, ${b.events.dmg ?? 0} dmg / ${b.events.die ?? 0} die / ${b.events.cast ?? 0} cast / ${b.events.proj ?? 0} proj events, own dmg events ${b.ownDmg}, moved ${Math.round(travelled)} u, kills +${b.char.stats.kills - kills0}`);
  c('field: no errors reported by the server', b.errs.length === 0, b.errs);
}

// ─────────────────────────── Full rift (slow, opt-in) ───────────────────────────

/** Opens a rift, summons the Guardian with the debug tool, kills it and checks the completion path. */
async function testRiftFull(url: string) {
  section('full rift: open, enter, guardian, completion (slow)');
  const name = `Rift${RUN}`;
  const b = await connect(url, name, 'warrior');
  await b.cmd('debug', { op: 'level', n: 69 });
  await b.cmd('debug', { op: 'set' });
  await b.cmd('debug', { op: 'paragon', n: 400 });
  for (const it of b.inv()) await b.cmd('equip', { itemId: it.id });
  for (const [stat, n] of [['p_main', 100], ['p_vit', 100], ['p_ias', 50], ['p_chc', 50], ['p_chd', 50], ['p_cdr', 50], ['p_area', 50]] as const) await b.cmd('paragon', { stat, n });
  const rifts0 = b.char.stats.rifts;
  const opener = await connect(url, `Peer${RUN}`, 'mage');
  check('rift: opened', (await b.cmd('riftOpen', { difficulty: 0 })).ok);
  check('rift: peer sees the open rift', !!(await opener.waitFor(() => opener.world?.riftOpen === true, 3000)));
  check('rift: entered', (await b.cmd('riftEnter')).ok && b.zone.kind === 'rift');
  const riftKey = b.zone.instance;
  await b.waitFor(() => b.me && b.rift, 4000);
  const dbg = await b.cmd('debug', { op: 'boss' });
  check('rift: debug boss fills the progress bar and summons the Guardian', dbg.ok, dbg);
  const sawGuardian = await b.waitFor(() => b.rift?.phase === 'guardian' && b.rift.guardian, 5000);
  check('rift: phase switches to guardian with an entity id', !!sawGuardian, b.rift);
  const t0 = Date.now();
  let lastLog = 0, deaths = 0;
  while (Date.now() - t0 < 240_000 && b.rift?.phase !== 'done') {
    await sleep(TICK_MS);
    const me = b.me;
    if (!me) continue;
    if (me.dead > 0) { if (!lastLog) deaths++; b.input(0, 0); continue; }
    let boss: SeenEnt | null = null, near: SeenEnt | null = null, nd = Infinity;
    for (const e of b.ents.values()) {
      if (e.desc.k !== 'mob' || (e.flags & F_DEAD) || e.hp <= 0) continue;
      if (e.desc.el === 4) boss = e;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < nd) { nd = d; near = e; }
    }
    const t = boss ?? near;
    if (t) {
      const dx = t.x - me.x, dy = t.y - me.y, d = Math.hypot(dx, dy) || 1;
      b.input(d > 140 ? dx / d : 0, d > 140 ? dy / d : 0);
    } else b.input(0, 0);
    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      console.log(`  [rift] ${((Date.now() - t0) / 1000).toFixed(0)} s: phase ${b.rift?.phase}, progress ${b.rift?.progress?.toFixed(0)}, boss hp ${boss ? (boss.hp * 100).toFixed(0) + '%' : '-'}, my hp ${(me.hp / me.mhp * 100).toFixed(0)}%`);
    }
  }
  b.input(0, 0);
  const done = b.rift?.phase === 'done';
  check(`rift: Guardian slain, phase done (${((Date.now() - t0) / 1000).toFixed(0)} s, ${deaths} deaths)`, done, b.rift);
  if (done) {
    await sleep(500);
    check('rift: completion notice was broadcast', (b.events.notice ?? 0) > 0);
    check('rift: stats.rifts incremented', b.char.stats.rifts === rifts0 + 1, { before: rifts0, now: b.char.stats.rifts });
    const portal = [...b.ents.values()].find((e) => e.desc.k === 'portal');
    check('rift: return portal spawned at the boss location', !!portal, [...b.ents.values()].map((e) => e.desc.k));
    // (other tests' rifts may still be open in this town channel, so only the completed one is checked)
    const pe = await opener.cmd('riftEnter');
    check('rift: completed rift cannot be entered any more', !pe.ok || opener.zone.instance !== riftKey, { pe, zone: opener.zone.instance, riftKey });
    if (pe.ok) await opener.cmd('leave');
    check('rift: leave returns to town', (await b.cmd('leave')).ok && b.zone.kind === 'town');
  }
  b.close();
  opener.close();
}

// ─────────────────────────── Autosave & zone-change saves ───────────────────────────

async function testAutosave(url: string, dataDir: string | null) {
  if (!dataDir) return;
  const name = `Auto${RUN}`;
  const file = path.join(dataDir, `${name.toLowerCase()}.json`);
  const readSave = () => JSON.parse(fs.readFileSync(file, 'utf8')) as CharacterSave;
  const b = await connect(url, name, 'mage');
  await sleep(400);
  check('[autosave] character file is written at login', fs.existsSync(file));
  const g0 = readSave().gold;
  await b.cmd('debug', { op: 'gold', n: 777 });
  await sleep(300);
  check('[autosave] a change is not written immediately (throttled)', readSave().gold === g0, { g0, now: readSave().gold });
  await b.cmd('travel', { zone: 'whispering_glade' });
  await sleep(400);
  const z = readSave();
  check('[autosave] zone change saves the character (lastZone + pending changes)', z.lastZone === 'whispering_glade' && z.gold === g0 + 777, { lastZone: z.lastZone, gold: z.gold, expected: g0 + 777 });
  await b.cmd('debug', { op: 'gold', n: 111 });
  const t0 = Date.now();
  const flushed = await b.waitFor(() => readSave().gold === g0 + 888, 36_000);
  check('[autosave] dirty characters are saved within ~30 s', !!flushed, { gold: readSave().gold });
  if (flushed) console.log(`  [autosave] flushed ${((Date.now() - t0) / 1000).toFixed(1)} s after the change`);
  b.close();
}

// ─────────────────────────── Static file serving ───────────────────────────

async function testStatic() {
  section('static file server (in-process)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hearthfall-static-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  const html = `<!doctype html><title>Hearthfall</title><div id="game"></div>${'<!-- pad -->'.repeat(100)}`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbCdEf12.js'), `console.log("hi");${' '.repeat(800)}`);
  fs.writeFileSync(path.join(dir, 'assets', 'font-12345678.woff2'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const handler = createStaticHandler(dir);
  const server = http.createServer((req, res) => {
    handler(req, res).then((h) => { if (!h) { res.writeHead(404); res.end('nf'); } });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as net.AddressInfo).port;
  const get = (p: string, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}${p}`, { headers });
  try {
    let r = await get('/');
    check('GET / serves index.html', r.status === 200 && r.headers.get('content-type')!.startsWith('text/html') && (await r.text()).includes('Hearthfall'));
    check('index.html is not cached', r.headers.get('cache-control') === 'no-cache');
    r = await get('/assets/index-AbCdEf12.js', { 'accept-encoding': 'gzip' });
    check('JS has the JavaScript MIME type', r.headers.get('content-type')!.startsWith('text/javascript'), r.headers.get('content-type'));
    check('hashed assets are immutable and cacheable', /immutable/.test(r.headers.get('cache-control') ?? ''));
    check('text assets are gzip compressed on request', r.headers.get('content-encoding') === 'gzip' && (await r.text()).startsWith('console.log'));
    r = await get('/assets/font-12345678.woff2');
    check('woff2 MIME type', r.headers.get('content-type') === 'font/woff2' && (await r.arrayBuffer()).byteLength === 3);
    r = await get('/favicon.svg');
    check('svg MIME type', r.headers.get('content-type') === 'image/svg+xml');
    r = await get('/some/client/route');
    check('unknown extension-less routes fall back to index.html', r.status === 200 && (await r.text()).includes('id="game"'));
    r = await get('/assets/missing.js');
    check('missing files with an extension answer 404', r.status === 404);
    r = await fetch(`http://127.0.0.1:${port}/`, { method: 'HEAD' });
    check('HEAD works', r.status === 200 && (await r.text()) === '');
    r = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
    check('non-GET methods are not served', r.status === 404);
    const raw = await new Promise<string>((resolve) => {
      const sock = net.connect(port, '127.0.0.1', () => sock.write('GET /..%2f..%2f..%2fetc/passwd HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      let buf = '';
      sock.on('data', (d) => { buf += d; });
      sock.on('close', () => resolve(buf));
    });
    check('path traversal does not leak files outside the root', !/root:/.test(raw), raw.slice(0, 120));
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─────────────────────────── Multiplayer ───────────────────────────

async function testMultiplayer(url: string) {
  section('multiplayer: visibility, chat, rift sharing, ghost cleanup');
  const aName = `MpA${RUN}`, bName = `MpB${RUN}`;
  const a = await connect(url, aName, 'warrior');
  const b = await connect(url, bName, 'mage');
  await a.cmd('debug', { op: 'level', n: 20 });
  await b.cmd('debug', { op: 'level', n: 20 });
  check('both players are in the same town channel', a.zone.instance === b.zone.instance, { a: a.zone.instance, b: b.zone.instance });
  const seeB = await a.waitFor(() => [...a.ents.values()].find((e) => e.desc.k === 'player' && e.desc.n === bName), 4000);
  check('player A sees player B (add with name/class/look)', !!seeB && seeB.desc.t === 'mage' && !!seeB.desc.look, seeB?.desc);
  const townMap = generateMap(a.zone.zone, a.zone.seed, a.zone.theme);
  check('town map has the obelisk the rift portal is placed next to', townMap.npcs.some((n) => n.role === 'obelisk'));

  a.send({ t: 'chat', text: 'hi from A' });
  const heard = await b.waitFor(() => b.chats.find((m) => m.text === 'hi from A' && m.from === aName), 2000);
  check('chat reaches other players in the zone', !!heard);

  const w = await b.waitFor(() => (b.world && b.world.online >= 2 ? b.world : null), 7000);
  check('world info shows >= 2 online', !!w, w);

  // A opens a rift; B (same channel) sees it and enters.
  const ro = await a.cmd('riftOpen', { difficulty: 1 });
  check('A opens a rift', ro.ok, ro);
  const sawOpen = await b.waitFor(() => b.world?.riftOpen === true, 3000);
  check('B is told about the open rift (world broadcast)', !!sawOpen);
  const portal = await b.waitFor(() => [...b.ents.values()].find((e) => e.desc.k === 'portal'), 3000);
  check('rift portal entity spawned in town near the obelisk', !!portal && portal.desc.t === 'rift', portal?.desc);
  const eb = await b.cmd('riftEnter');
  const ea = await a.cmd('riftEnter');
  check('B and A enter the same rift instance', eb.ok && ea.ok && a.zone.instance === b.zone.instance && a.zone.instance.startsWith('rift#'), { a: a.zone.instance, b: b.zone.instance });
  const seeAinRift = await b.waitFor(() => [...b.ents.values()].find((e) => e.desc.k === 'player' && e.desc.n === aName), 4000);
  check('rift mates see each other', !!seeAinRift);
  const rm = await a.cmd('riftEnter');
  check('riftEnter from inside a rift rejected', !rm.ok, rm);
  a.send({ t: 'chat', text: 'rift chat' });
  const noHear = await b.waitFor(() => b.chats.find((m) => m.text === 'rift chat'), 1500);
  check('zone chat inside the rift reaches rift mates', !!noHear);
  await a.cmd('leave');
  const leftPortal = await a.waitFor(() => a.zone.kind === 'town', 1000);
  check('A returned to town', !!leftPortal);
  await b.cmd('leave');

  // Disconnect during a rift: character is saved and name freed.
  a.close();
  await a.waitFor(() => a.closed, 2000);
  await sleep(300);
  const a2 = await connect(url, aName, 'warrior');
  check('character can log back in right after disconnecting', a2.char.name === aName && a2.char.level === 21, a2.char.level);
  a2.close();
  b.close();
}

// ─────────────────────────── AFK ───────────────────────────

async function testAfk(url: string, dataDir: string | null) {
  section('AFK gains');
  if (!dataDir) { console.log('  (skipped: pass --data <dir> to edit saves of an external server)'); return; }
  const name = `Afk${RUN}`;
  const first = await connect(url, name, 'ranger');
  await first.cmd('debug', { op: 'level', n: 19 });
  await first.cmd('travel', { zone: 'whispering_glade' });
  const fileAt = path.join(dataDir, `${name.toLowerCase()}.json`);
  first.close();
  await first.waitFor(() => first.closed, 2000);
  await sleep(400);
  check('save was written when leaving the field', fs.existsSync(fileAt));
  const save = JSON.parse(fs.readFileSync(fileAt, 'utf8')) as CharacterSave;
  check('lastZone is the field the character logged out in', save.lastZone === 'whispering_glade', save.lastZone);
  const goldBefore = save.gold, killsBefore = save.stats.kills;

  save.lastSeen = Date.now() - 2 * 3_600_000;
  fs.writeFileSync(fileAt, JSON.stringify(save));
  const back = await connect(url, name, 'ranger');
  const afk = await back.waitFor(() => back.afk, 3000);
  check('afk message sent on login after 2 h in a field', !!afk, back.errs);
  if (afk) {
    check('afk duration ~2 h', Math.abs(afk.ms - 2 * 3_600_000) < 60_000, afk.ms);
    check('afk kills = minutes x 60 x 0.25 (~1800)', Math.abs(afk.kills - 1800) <= 20, afk.kills);
    check('afk xp, gold and materials are positive', afk.xp > 0 && afk.gold > 0 && (afk.mats.scrap ?? 0) > 0 && (afk.mats.dust ?? 0) > 0 && (afk.mats.crystal ?? 0) > 0, afk);
    check('afk report names the field', afk.zone === 'whispering_glade', afk.zone);
    check('afk levels reported and applied', afk.levels > 0 && back.char.level > 20, { levels: afk.levels, level: back.char.level });
    check('afk gold and kills applied to the save', back.char.gold === goldBefore + afk.gold && back.char.stats.kills === killsBefore + afk.kills, { gold: back.char.gold, was: goldBefore, add: afk.gold });
  }
  check('characters always reappear in town', back.zone.kind === 'town');
  back.close();
  await back.waitFor(() => back.closed, 2000);
  await sleep(300);
  const again = await connect(url, name, 'ranger');
  check('no repeat AFK gains on the next login', again.afk === null);
  again.close();
  await again.waitFor(() => again.closed, 2000);
  await sleep(300);

  // 12 h cap, and no gains when the last zone was the town.
  const s2 = JSON.parse(fs.readFileSync(fileAt, 'utf8')) as CharacterSave;
  s2.lastZone = 'ashen_hollow';
  s2.lastSeen = Date.now() - 100 * 3_600_000;
  fs.writeFileSync(fileAt, JSON.stringify(s2));
  const capped = await connect(url, name, 'ranger');
  const afk2 = await capped.waitFor(() => capped.afk, 3000);
  check('afk is capped at 12 hours', !!afk2 && afk2.ms === 12 * 3_600_000 && afk2.kills === 12 * 60 * 15, afk2);
  capped.close();
  await capped.waitFor(() => capped.closed, 2000);
  await sleep(300);
  const s3 = JSON.parse(fs.readFileSync(fileAt, 'utf8')) as CharacterSave;
  s3.lastZone = 'hearthmere';
  s3.lastSeen = Date.now() - 5 * 3_600_000;
  fs.writeFileSync(fileAt, JSON.stringify(s3));
  const town = await connect(url, name, 'ranger');
  await sleep(300);
  check('no afk gains when the last zone was the town', town.afk === null);
  town.close();
  await town.waitFor(() => town.closed, 2000);
  await sleep(300);

  // Corrupt save: refused, moved aside, never overwritten by a new character.
  const bad = `Bad${RUN}`;
  fs.writeFileSync(path.join(dataDir, `${bad.toLowerCase()}.json`), '{ this is not json');
  const nb = new Bot(url, bad);
  await nb.open();
  const ok = await nb.login('mage');
  await nb.waitFor(() => nb.closed, 3000);
  check('corrupt save refuses login instead of overwriting', !ok && nb.errs.length > 0, nb.errs);
  check('corrupt file was moved aside', fs.readdirSync(dataDir).some((f) => f.startsWith(`${bad.toLowerCase()}.json.corrupt-`)));
}

// ─────────────────────────── In-process world tests ───────────────────────────

/** A stand-in for Session: the world only needs these members. */
function fakeSession(name: string, level = 70) {
  const save = createCharacter(name, 'warrior', 1);
  save.level = level;
  const sent: S2C[] = [];
  const s = {
    save, derived: computeStats(save), sessionId: name, rec: null as unknown, entityId: 0, homeTown: null as string | null,
    hold: null as S2C[] | null, sent,
    send(m: S2C) { if (s.hold) s.hold.push(m); else sent.push(m); },
    sendRaw() { /* not needed */ }, markDirty() { /* */ }, saveNow() { /* */ }, autosave() { /* */ },
    kick() { /* */ }, shutdown() { /* */ }, changed() { /* */ },
  };
  return s;
}

async function testWorld() {
  section('world manager (in-process, stub simulation): caps, least-full, garbage collection');
  process.env.SIM_STUB = '1';
  const { World } = await import('../src/world');
  const world = new World();
  await world.init();
  const login = (s: ReturnType<typeof fakeSession>) => world.login(s as never, (you, zone) => ({ t: 'welcome', you, char: s.save, derived: s.derived, zone, time: Date.now(), world: world.infoFor(s as never) }));
  const channelsOf = (zone: string) => world.infoFor(fakeSession('probe') as never).channels.filter((x) => x.zone === zone);
  const placeAtService = (s: ReturnType<typeof fakeSession>, role: string) => {
    // In-process world-manager fixtures: placement only; socket tests above walk via real inputs.
    const rec = s.rec as import('../src/world').InstRec;
    const n = rec.inst.map.town!.npcs.find(n => n.role === role)!;
    rec.inst.removePlayer(s); s.entityId = rec.inst.addPlayer(s, { x: n.approach[0], y: n.approach[1] });
  };

  const townPlayers = Array.from({ length: 101 }, (_, i) => fakeSession(`T${i}`));
  townPlayers.forEach(login);
  const town = channelsOf('hearthmere');
  check('town channel 1 holds 100 players, the 101st opens channel 2', town.length === 2 && town[0].players === 100 && town[1].players === 1, town);
  check('welcome is the first message and carries entity id + zone', townPlayers.every((p) => p.sent[0]?.t === 'welcome' && (p.sent[0] as { you: number }).you > 0));
  check('login placed everyone in a town zone', townPlayers.every((p) => (p.rec as { kind: string }).kind === 'town'));

  // Fields: 31 players -> channel 1 takes 30, 31st opens channel 2; least-full thereafter.
  const f = townPlayers.slice(0, 31);
  const results = f.map((p) => world.travel(p as never, 'whispering_glade'));
  let glade = channelsOf('whispering_glade');
  check('field channels cap at 30 and open a new channel when full', results.every((r) => r.ok) && glade.length === 2 && glade[0].players === 30 && glade[1].players === 1, glade);
  const extra = world.travel(townPlayers[40] as never, 'whispering_glade');
  glade = channelsOf('whispering_glade');
  check('next arrival goes to the least-full channel (2)', extra.ok && glade[1].players === 2 && glade[0].players === 30, glade);
  const full = world.channel(townPlayers[40] as never, 1);
  check('switching into a full channel is refused', !full.ok && /full/.test(full.err ?? ''), full);
  const ashen = world.travel(f[0] as never, 'ashen_hollow');
  check('field to field travel is refused (waypoint is in town)', !ashen.ok, ashen);

  // Leaving puts players back into their home town channel.
  const home = f[0].homeTown;
  const back = world.travel(f[0] as never, 'hearthmere');
  check('returning to town goes back to the home channel when it has room', back.ok && (f[0].rec as { key: string }).key === home, { home, now: (f[0].rec as { key: string }).key });

  // Empty field channel 2 is destroyed after 5 minutes, channel 1 stays.
  for (const p of [f[30], townPlayers[40]]) world.leave(p as never);
  world.maintain(Date.now() + 4 * 60_000);
  check('empty field channel 2 survives 4 minutes', channelsOf('whispering_glade').length === 2);
  world.maintain(Date.now() + 5 * 60_000 + 2_000);
  glade = channelsOf('whispering_glade');
  check('empty field channel 2 is destroyed after 5 minutes; channel 1 is kept', glade.length === 1 && glade[0].channel === 1, glade);

  // Rifts: destroyed 60 s after becoming empty; portal removed with it.
  const opener = townPlayers[60];
  placeAtService(opener, 'obelisk');
  const rin = world.riftOpen(opener as never, 0);
  check('riftOpen creates a rift instance', rin.ok, rin);
  check('open rift shows in world info for the town channel', world.infoFor(opener as never).riftOpen === true);
  let inst = world.stats().instances.filter((i) => i.kind === 'rift');
  check('rift instance registered', inst.length === 1, inst);
  world.maintain(Date.now() + 30_000);
  check('an unentered rift survives 30 s', world.stats().instances.some((i) => i.kind === 'rift'));
  world.maintain(Date.now() + 61_000);
  check('an empty rift is destroyed after 60 s', !world.stats().instances.some((i) => i.kind === 'rift'));
  check('destroyed rift is no longer open in world info', world.infoFor(opener as never).riftOpen === false);
  const again = world.riftEnter(opener as never);
  check('entering a destroyed rift is refused', !again.ok, again);

  // Entered rift: stays while occupied, destroyed 60 s after the last player leaves.
  world.riftOpen(opener as never, 2);
  const e1 = world.riftEnter(opener as never);
  check('riftEnter works', e1.ok && (opener.rec as { kind: string }).kind === 'rift', e1);
  world.maintain(Date.now() + 10 * 60_000);
  check('an occupied rift is never garbage collected', world.stats().instances.some((i) => i.kind === 'rift' && i.players === 1));
  const rl = world.leave(opener as never);
  check('leaving the rift returns to the town', rl.ok && (opener.rec as { kind: string }).kind === 'town', rl);
  world.maintain(Date.now() + 30_000);
  check('empty rift survives 30 s after the last player left', world.stats().instances.some((i) => i.kind === 'rift'));
  world.maintain(Date.now() + 61_000);
  check('empty rift destroyed 60 s after the last player left', !world.stats().instances.some((i) => i.kind === 'rift'));

  // Rift capacity (party of 4) and one rift per opener.
  const party = townPlayers.slice(70, 76);
  party.forEach(p => placeAtService(p, 'obelisk'));
  world.riftOpen(party[0] as never, 0);
  const entered = party.map((p) => world.riftEnter(p as never));
  check('a rift holds at most 4 players', entered.filter((r) => r.ok).length === 4 && !entered[4].ok && /full/.test(entered[4].err ?? ''), entered);
  world.leave(party[0] as never);
  placeAtService(party[0], 'obelisk');
  const replaced = world.riftOpen(party[0] as never, 0);
  check('opening a new rift closes the old one to newcomers; occupants stay', replaced.ok && world.stats().instances.filter((i) => i.kind === 'rift').length === 2);
  const late = world.riftEnter(party[5] as never);
  check('newcomers are sent to the newest rift, not the closed one', late.ok && (party[5].rec as { key: string }).key !== (party[1].rec as { key: string }).key);

  // Duplicate-name reservation.
  check('character names are reserved while online', world.reserve('someone', {} as never) && !world.reserve('someone', {} as never));
  await world.shutdown();
}

// ─────────────────────────── Main ───────────────────────────

async function main() {
  const started = Date.now();
  const srv = await startServer();
  console.log(`Hearthfall bot test -> ${srv.url}${srv.child ? ` (spawned server, data ${srv.dataDir})` : ''}`);
  try {
    const only = opt('only');
    const run = (name: string) => !only || only.split(',').includes(name);
    if (run('protocol')) await testProtocol(srv.url);
    if (run('classes')) {
      section(`classes in parallel: ${CLASSES_TO_TEST.join(', ')} (field play ${FIELD_SECONDS}s)`);
      await Promise.all([
        ...CLASSES_TO_TEST.map((cls) =>
          testClass(srv.url, cls, srv.dataDir).catch((err) => { check(`[${cls}] test run crashed`, false, String(err?.stack ?? err)); })),
        testAutosave(srv.url, srv.dataDir).catch((err) => { check('autosave test crashed', false, String(err?.stack ?? err)); }),
      ]);
    }
    if (run('multiplayer')) await testMultiplayer(srv.url).catch((err) => { check('multiplayer test crashed', false, String(err?.stack ?? err)); });
    if (run('afk')) await testAfk(srv.url, srv.dataDir).catch((err) => { check('afk test crashed', false, String(err?.stack ?? err)); });
    if (flag('rift-full') || only?.split(',').includes('rift')) await testRiftFull(srv.url).catch((err) => { check('full rift test crashed', false, String(err?.stack ?? err)); });

    // Health endpoint
    if (srv.child) {
      const http = srv.url.replace(/^ws/, 'http').replace(/\/ws$/, '');
      const hz = await fetch(`${http}/healthz`).then((r) => r.json() as Promise<{ ok: boolean; online: number; instances: { key: string; tick: { avg: number; max: number } }[] }>).catch(() => null);
      check('GET /healthz reports instances and tick stats', !!hz && hz.ok && hz.instances.length >= 3, hz);
      if (hz) {
        const worst = Math.max(...hz.instances.map((i) => i.tick.max));
        const avg = hz.instances.reduce((s, i) => s + i.tick.avg, 0);
        console.log(`  server tick: summed avg ${avg.toFixed(2)} ms, worst single tick ${worst.toFixed(2)} ms across ${hz.instances.length} instances`);
        check('summed average tick time within the 50 ms budget', avg < 50, avg);
      }
      const nf = await fetch(`${http}/nope.js`).then((r) => r.status).catch(() => 0);
      check('unknown asset path answers 404', nf === 404, nf);
    }
    if (run('static')) await testStatic();
    if (run('world')) await testWorld();
  } finally {
    let shutdownBot: Bot | undefined;
    let shutdownSave: CharacterSave | undefined;
    if (srv.child) {
      try {
        srv.child.send({ unexpected: 'ignore this parent message' });
        shutdownBot = await connect(srv.url, `Stop${RUN}`, 'warrior');
        check('unknown parent IPC message does not stop the server', !shutdownBot.closed);
        const before = shutdownBot.char.gold;
        const granted = await shutdownBot.cmd('debug', { op: 'gold', n: 1234 });
        await shutdownBot.waitFor(() => shutdownBot!.char.gold === before + 1234);
        check('shutdown fixture has newly changed live progress', granted.ok && shutdownBot.char.gold === before + 1234);
        shutdownSave = structuredClone(shutdownBot.char);
        if (srv.dataDir) {
          const file = path.join(srv.dataDir, `${shutdownSave.id}.json`);
          await shutdownBot.waitFor(() => fs.existsSync(file));
          const prior = JSON.parse(fs.readFileSync(file, 'utf8')) as CharacterSave;
          check('shutdown probe is newer than its on-disk save', prior.gold !== shutdownSave.gold);
        }
      } catch (err) { check('shutdown fixture setup succeeds', false, String(err)); }
    }
    const res = await srv.stop();
    if (srv.child) {
      const transport = process.platform === 'win32' ? 'parent IPC' : 'SIGTERM';
      check(`server shuts down gracefully on ${transport} (exit code 0)`, res.code === 0, res.code);
      check('shutdown saved characters', /all characters saved/.test(res.log));
      if (shutdownSave && srv.dataDir) {
        try {
          const saved = JSON.parse(fs.readFileSync(path.join(srv.dataDir, `${shutdownSave.id}.json`), 'utf8')) as CharacterSave;
          check('shutdown persists connected character gold', saved.gold === shutdownSave.gold, saved.gold);
          check('shutdown preserves connected character items', JSON.stringify([saved.equipment,saved.inventory,saved.stash]) === JSON.stringify([shutdownSave.equipment,shutdownSave.inventory,shutdownSave.stash]));
        } catch (err) { check('shutdown character file is readable', false, String(err)); }
      }
      shutdownBot?.close();
      const bad = res.log.split('\n').filter((l) => /\b(error|exception|TypeError|ReferenceError|unhandled)\b/i.test(l) && !/\[session\] error handling bogus/.test(l));
      check('server log contains no errors', bad.length === 0, bad.slice(0, 8));
      if (srv.dataDir) fs.rmSync(srv.dataDir, { recursive: true, force: true });
    }
  }
  console.log(`\n${passed} passed, ${failed} failed in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  if (failed) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
