// One simulated map (town channel, field channel or rift). Owns every entity, the spatial hash, the 20 Hz tick,
// AOI replication and events. Implements the InstanceApi contract (server/src/contracts.ts).

import type { CreateInstance, InstanceApi, InstanceOptions, PlayerLink, PortalSpec } from '../contracts';
import {
  CollisionWorld, DIFFICULTIES, Rng, TICK_MS, ZONES, generateMap, type C2S, type GameEvent, type MapData, type RiftState,
  type ZoneDef, type ZoneInfo, type ZoneKind,
} from '../shared';
import { updateGrounds } from './grounds';
import { nextId } from './ids';
import { packMemberGone } from './kills';
import { clearPlayerLoot } from './loot';
import { updateMonsters } from './monsters';
import { addPlayerEntity, debugHeal, playerTick, processInputs, refreshPlayerStats, removePlayerEntity } from './players';
import { playerBrain } from './brain';
import { updateProjectiles } from './projectiles';
import { replicate } from './replication';
import { RiftRuntime, debugBoss, riftTick } from './rift';
import { Scheduler } from './scheduler';
import { SpatialHash } from './spatial';
import { Spawner, debugSpawnElite, debugSpawnGoblin } from './spawner';
import { updateSummons } from './summons';
import type { EvRec, Ground, Mob, Player, PortalEnt, Proj, Summon } from './types';

const TICK_HISTORY = 100; // ~5 s at 20 Hz

interface DmgAgg { owner: number; src: number; a: number; best: number; crit: boolean; dot: boolean; el: number; k: boolean; x: number; y: number }

export class Instance implements InstanceApi {
  readonly key: string;
  readonly zone: ZoneInfo;
  readonly map: MapData;
  readonly cw: CollisionWorld;
  readonly def: ZoneDef;
  readonly kind: ZoneKind;
  readonly opts: InstanceOptions;
  readonly widthPx: number;
  readonly heightPx: number;

  /** Simulation time (ms) since creation. */
  t = 0;
  tickNo = 0;
  readonly rng: Rng;
  readonly lootRng: Rng;
  /** Rift level (fields: per-pack level follows nearby players). */
  readonly level: number;
  readonly difficulty: number;

  readonly players: Player[] = [];
  private byLink = new Map<PlayerLink, Player>();
  private byId = new Map<number, Player>();
  readonly mobs: Mob[] = [];
  private mobById = new Map<number, Mob>();
  readonly mobHash: SpatialHash<Mob>;
  readonly summons: Summon[] = [];
  readonly projs: Proj[] = [];
  readonly grounds: Ground[] = [];
  readonly portals: PortalEnt[] = [];
  readonly sched = new Scheduler();
  events: EvRec[] = [];
  readonly spawner: Spawner;
  readonly rift: RiftRuntime | null;
  /** Diagnostics for tests / tools. */
  readonly counters = { kills: 0, eliteKills: 0, playerDeaths: 0, lootSpawned: 0, lootPicked: 0, goblins: 0 };

  private tickTimes = new Float64Array(TICK_HISTORY);
  private tickCount = 0;
  private destroyed = false;

  constructor(opts: InstanceOptions) {
    this.opts = opts;
    this.key = opts.key;
    this.def = ZONES[opts.zoneId];
    if (!this.def) throw new Error(`unknown zone ${opts.zoneId}`);
    this.kind = this.def.kind;
    const theme = this.kind === 'rift' ? opts.theme : this.def.theme;
    this.map = generateMap(opts.zoneId, opts.seed, theme);
    this.cw = new CollisionWorld(this.map);
    this.widthPx = this.map.w * 64;
    this.heightPx = this.map.h * 64;
    this.mobHash = new SpatialHash<Mob>(this.widthPx, this.heightPx);
    this.rng = new Rng((opts.seed ^ 0x5bd1e995) >>> 0);
    this.lootRng = new Rng(((Math.random() * 0xffffffff) >>> 0) ^ opts.seed);
    this.level = Math.max(1, Math.min(70, opts.level ?? 1));
    const diff = this.kind === 'rift' ? opts.difficulty ?? 0 : 0;
    this.difficulty = Math.max(0, Math.min(DIFFICULTIES.length - 1, diff));
    this.zone = {
      zone: opts.zoneId, name: this.def.name, kind: this.kind, theme, seed: opts.seed, channel: opts.channel,
      instance: opts.key, difficulty: this.difficulty,
    };
    this.rift = this.kind === 'rift' ? new RiftRuntime(this, opts.owner ?? '') : null;
    this.spawner = new Spawner(this);
    this.spawner.init();
  }

  // ─────────────────────────── Entity registry ───────────────────────────

  addMob(m: Mob) {
    this.mobs.push(m);
    this.mobById.set(m.id, m);
    this.mobHash.insert(m);
  }

  /** Detach a monster (death / despawn). The array entry is compacted at the end of the monster update. */
  removeMob(m: Mob) {
    m.dead = true;
    this.mobById.delete(m.id);
    if (m.hCell >= 0) this.mobHash.remove(m);
  }

  mob(id: number): Mob | undefined { return this.mobById.get(id); }
  playerById(id: number): Player | null { return this.byId.get(id) ?? null; }

  addSummon(s: Summon) { this.summons.push(s); }

  /** Monsters whose body overlaps the circle (alive only). Returns a fresh array. */
  queryMobs(x: number, y: number, r: number): Mob[] {
    return this.mobHash.query(x, y, r, []);
  }

  /** Alive players within r of (x, y). */
  playersNear(x: number, y: number, r: number): Player[] {
    const out: Player[] = [];
    const r2 = r * r;
    for (const p of this.players) {
      if (p.deadMs > 0) continue;
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy <= r2) out.push(p);
    }
    return out;
  }

  nearestPlayer(x: number, y: number, r: number): Player | null {
    let best: Player | null = null, bd = r * r;
    for (const p of this.players) {
      if (p.deadMs > 0) continue;
      const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
      if (d2 <= bd) { bd = d2; best = p; }
    }
    return best;
  }

  // ─────────────────────────── Events ───────────────────────────

  /**
   * Damage numbers are merged per (target, owning player, dot) within a tick: area damage, Sentry copies and
   * pierce-all volleys can land dozens of hits on one monster in 50 ms. Sums (and so DPS meters) are exact;
   * the event carries the source of the largest hit, crit if any hit crit, and the killing-blow flag.
   */
  private dmgAgg = new Map<number, DmgAgg[]>();

  addDmg(m: Mob, owner: number, src: number, a: number, crit: boolean, dot: boolean, el: number, killed: boolean) {
    let list = this.dmgAgg.get(m.id);
    if (!list) this.dmgAgg.set(m.id, (list = []));
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (g.owner !== owner || g.dot !== dot) continue;
      g.a += a;
      if (a > g.best) { g.best = a; g.src = src; g.el = el; }
      if (crit) g.crit = true;
      if (killed) g.k = true;
      g.x = m.x; g.y = m.y;
      return;
    }
    list.push({ owner, src, a, best: a, crit, dot, el, k: killed, x: m.x, y: m.y });
    if (killed) this.flushDmg(m.id);
  }

  /** Emit the merged damage numbers of one target (before its death event) or of everything (end of tick). */
  flushDmg(targetId?: number) {
    if (targetId !== undefined) {
      const l = this.dmgAgg.get(targetId);
      if (l) { this.dmgAgg.delete(targetId); this.emitDmgList(targetId, l); }
      return;
    }
    for (const [id, l] of this.dmgAgg) this.emitDmgList(id, l);
    this.dmgAgg.clear();
  }

  private emitDmgList(id: number, list: DmgAgg[]) {
    for (const g of list) {
      const ev: { e: 'dmg'; t: number; a: number; c?: 1; el: number; s?: number; k?: 1; dot?: 1 } = { e: 'dmg', t: id, a: Math.round(g.a), el: g.el };
      if (g.crit) ev.c = 1;
      if (g.src) ev.s = g.src;
      if (g.k) ev.k = 1;
      if (g.dot) ev.dot = 1;
      this.events.push({ ev, x: g.x, y: g.y, a: g.owner, b: 0, only: 0 });
    }
  }

  /** Queue an event at a world position; `a`/`b` are players that always receive it. */
  emit(ev: GameEvent, x: number, y: number, a = 0, b = 0) {
    this.events.push({ ev, x, y, a, b, only: 0 });
  }

  /** Queue an event for one player only. */
  emitTo(playerId: number, ev: GameEvent) {
    this.events.push({ ev, x: 0, y: 0, a: playerId, b: 0, only: playerId });
  }

  // ─────────────────────────── InstanceApi ───────────────────────────

  addPlayer(link: PlayerLink, at?: { x: number; y: number }): number {
    const existing = this.byLink.get(link);
    if (existing) return existing.id;
    const p = addPlayerEntity(this, link, at ?? this.map.entry);
    this.players.push(p);
    this.byLink.set(link, p);
    this.byId.set(p.id, p);
    this.rift?.onPlayerJoin(p);
    return p.id;
  }

  removePlayer(link: PlayerLink): void {
    const p = this.byLink.get(link);
    if (!p) return;
    removePlayerEntity(this, p);
    clearPlayerLoot(p);
    this.byLink.delete(link);
    this.byId.delete(p.id);
    const i = this.players.indexOf(p);
    if (i >= 0) this.players.splice(i, 1);
    for (const m of this.mobs) if (m.target === p.id) m.target = 0;
  }

  queueInput(link: PlayerLink, input: Extract<C2S, { t: 'in' }>): void {
    const p = this.byLink.get(link);
    if (!p) return;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
    const last = p.inQ.length ? p.inQ[p.inQ.length - 1].seq : p.ack;
    const seq = typeof input.seq === 'number' && Number.isFinite(input.seq) ? input.seq : last + 1;
    if (seq <= last) return; // duplicate / out of order
    p.inQ.push({ seq, mx: num(input.mx), my: num(input.my), dash: !!input.dash });
    // A flooding / lagging client cannot bank more than ~1 s of movement.
    if (p.inQ.length > 20) p.inQ.splice(0, p.inQ.length - 20);
  }

  refreshPlayer(link: PlayerLink): void {
    const p = this.byLink.get(link);
    if (p) refreshPlayerStats(this, p, true);
  }

  /** Optional damage breakdown by skill id (diagnostics / balance tooling). */
  dmgBySkill: Map<string, number> | null = null;
  /** Optional per-phase timing (diagnostics): set to an array to accumulate ms per phase of the last tick. */
  phaseMs: number[] | null = null;
  static readonly PHASES = ['players', 'brain', 'summons', 'monsters', 'projectiles', 'grounds', 'scheduled', 'spawner', 'replicate'];
  private phaseT = 0;
  private mark(i: number) {
    if (!this.phaseMs) return;
    const n = performance.now();
    this.phaseMs[i] = n - this.phaseT;
    this.phaseT = n;
  }

  tick(): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    this.t += TICK_MS;
    this.tickNo++;
    const players = this.players;
    this.phaseT = t0;
    for (let i = 0; i < players.length; i++) processInputs(this, players[i]);
    for (let i = 0; i < players.length; i++) playerTick(this, players[i], TICK_MS);
    this.mark(0);
    for (let i = 0; i < players.length; i++) playerBrain(this, players[i], TICK_MS);
    this.mark(1);
    updateSummons(this, TICK_MS);
    this.mark(2);
    updateMonsters(this, TICK_MS);
    this.mark(3);
    updateProjectiles(this, TICK_MS);
    this.mark(4);
    updateGrounds(this, TICK_MS);
    this.mark(5);
    this.sched.run(this.t);
    this.compactMobs();
    this.mark(6);
    this.spawner.tick(TICK_MS);
    if (this.rift) riftTick(this.rift, TICK_MS);
    this.updatePortals(TICK_MS);
    this.mark(7);
    this.flushDmg();
    replicate(this);
    this.mark(8);
    this.events = [];
    const dt = performance.now() - t0;
    this.tickTimes[this.tickCount % TICK_HISTORY] = dt;
    this.tickCount++;
  }

  private compactMobs() {
    const ms = this.mobs;
    let w = 0;
    for (let r = 0; r < ms.length; r++) if (!ms[r].dead) ms[w++] = ms[r];
    ms.length = w;
  }

  private updatePortals(dtMs: number) {
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pt = this.portals[i];
      if (pt.lifeMs === Infinity) continue;
      pt.lifeMs -= dtMs;
      if (pt.lifeMs <= 0) this.portals.splice(i, 1);
    }
  }

  playerCount(): number {
    return this.players.length;
  }

  spawnPortal(spec: PortalSpec): number {
    const pt: PortalEnt = {
      kind: 'portal', id: nextId(), x: spec.x, y: spec.y, to: spec.kind, name: spec.label,
      lifeMs: spec.ttlMs > 0 ? spec.ttlMs : Infinity,
    };
    this.portals.push(pt);
    return pt.id;
  }

  removeEntity(id: number): void {
    const pi = this.portals.findIndex((p) => p.id === id);
    if (pi >= 0) { this.portals.splice(pi, 1); return; }
    const m = this.mobById.get(id);
    if (m) { this.removeMob(m); packMemberGone(this, m); return; }
    const si = this.summons.findIndex((s) => s.id === id);
    if (si >= 0) { this.summons[si].dead = true; return; }
    for (const p of this.players) for (const l of p.loot) if (l.id === id) { p.loot.delete(l); return; }
  }

  debug(link: PlayerLink, op: string): string | null {
    const p = this.byLink.get(link);
    if (!p) return 'Not in this instance';
    switch (op) {
      case 'heal':
        debugHeal(this, p);
        return null;
      case 'goblin':
        if (this.kind === 'town') return 'Monsters cannot be summoned in town';
        debugSpawnGoblin(this, p);
        return null;
      case 'elite':
        if (this.kind === 'town') return 'Monsters cannot be summoned in town';
        debugSpawnElite(this, p);
        return null;
      case 'boss':
        if (this.kind === 'town') return 'Monsters cannot be summoned in town';
        return debugBoss(this, p);
    }
    return `Unknown debug op ${op}`;
  }

  riftState(): RiftState | null {
    return this.rift ? this.rift.state() : null;
  }

  notice(text: string, kind: 'rift' | 'boss' | 'info' | 'legendary' | 'warn'): void {
    this.emit({ e: 'notice', text, kind }, 0, 0);
    // broadcast: mark every player as always-relevant
    const rec = this.events[this.events.length - 1];
    rec.a = -1;
  }

  tickStats(): { avg: number; max: number } {
    const n = Math.min(this.tickCount, TICK_HISTORY);
    if (!n) return { avg: 0, max: 0 };
    let sum = 0, max = 0;
    for (let i = 0; i < n; i++) { sum += this.tickTimes[i]; if (this.tickTimes[i] > max) max = this.tickTimes[i]; }
    return { avg: sum / n, max };
  }

  destroy(): void {
    this.destroyed = true;
    this.sched.clear();
    for (const p of [...this.players]) this.removePlayer(p.link);
    this.mobs.length = 0;
    this.summons.length = 0;
    this.projs.length = 0;
    this.grounds.length = 0;
    this.portals.length = 0;
    this.events = [];
  }
}

export const createInstance: CreateInstance = (opts) => new Instance(opts);
