// Minimal stand-in for the gameplay simulation, ONLY for testing the server infrastructure while
// server/src/sim is in progress. Select it with SIM_STUB=1. It implements the InstanceApi contract:
// players move with the shared stepMove(), NPCs/portals exist, fields hold a few stationary monsters that
// die when a player stands next to them (emitting dmg/die events and granting XP), and rifts report
// progress and call onRiftComplete.

import type { CreateInstance, InstanceApi, InstanceOptions, PlayerLink, PortalSpec } from '../src/contracts';
import { DASH, PLAYER_RADIUS, TICK_MS, AOI_HALF_H, AOI_HALF_W } from '../../shared/src/constants';
import { ZONES } from '../../shared/src/data/zones';
import { playerLook } from '../../shared/src/character';
import { generateMap, type MapData } from '../../shared/src/mapgen';
import { CollisionWorld, stepMove, type MoveState } from '../../shared/src/movement';
import { addXp, monsterXp } from '../../shared/src/progression';
import { F_DEAD, F_LEFT, F_MOVING, type C2S, type EntDesc, type GameEvent, type MeState, type RiftState, type S2C, type Snapshot, type ZoneInfo } from '../../shared/src/protocol';

type InputMsg = Extract<C2S, { t: 'in' }>;

interface Ent {
  id: number;
  desc: EntDesc;
  x: number;
  y: number;
  hp: number;
  flags: number;
  deadAt: number;
  expires: number;
}

interface Pl {
  link: PlayerLink;
  ent: Ent;
  mv: MoveState;
  q: InputMsg[];
  last: { mx: number; my: number };
  ack: number;
  known: Set<number>;
}

export const createInstance: CreateInstance = (opts: InstanceOptions): InstanceApi => new StubInstance(opts);

class StubInstance implements InstanceApi {
  canInteract(link: PlayerLink, x: number, y: number, radius: number): boolean {
    const p = this.players.get(link);
    return !!p && p.ent.hp > 0 && Math.hypot(p.mv.x - x, p.mv.y - y) <= radius && !this.col.segmentBlocked(p.mv.x, p.mv.y, x, y);
  }
  readonly key: string;
  readonly zone: ZoneInfo;
  readonly map: MapData;
  private col: CollisionWorld;
  private players = new Map<PlayerLink, Pl>();
  private ents = new Map<number, Ent>();
  private nextId = 1;
  private tickNo = 0;
  /** Events with the position they happened at (null = global), filtered per player like the real AOI. */
  private events: { ev: GameEvent; x: number | null; y: number | null }[] = [];
  private durations: number[] = [];
  private kills = 0;
  private startedAt = Date.now();
  private completed = false;
  /** Counters tests can read through the health endpoint or logs. */
  refreshCalls = 0;

  constructor(private opts: InstanceOptions) {
    this.key = opts.key;
    const def = ZONES[opts.zoneId];
    this.map = generateMap(opts.zoneId, opts.seed, opts.theme);
    this.col = new CollisionWorld(this.map);
    this.zone = {
      zone: opts.zoneId, name: def.name, kind: def.kind, theme: opts.theme, seed: opts.seed,
      channel: opts.channel, instance: opts.key, difficulty: opts.difficulty ?? 0,
    };
    for (const n of this.map.npcs) {
      this.add({ id: 0, k: 'npc', t: n.role, n: n.name, r: n.r }, n.x, n.y);
    }
    if (def.kind !== 'town') {
      const spawns = this.map.spawns.slice(0, 18);
      for (const sp of spawns) for (let i = 0; i < 3; i++) this.spawnMob(sp.x + (i - 1) * 40, sp.y + (i % 2) * 30);
    }
  }

  private add(desc: EntDesc, x: number, y: number, hp = 1, expires = 0): Ent {
    const id = this.nextId++;
    const ent: Ent = { id, desc: { ...desc, id }, x, y, hp, flags: 0, deadAt: 0, expires };
    this.ents.set(id, ent);
    return ent;
  }

  private spawnMob(x: number, y: number, el: 0 | 1 | 2 | 4 | 5 = 0): Ent {
    const lv = this.opts.level ?? 10;
    return this.add({ id: 0, k: 'mob', t: 'slime', n: el === 4 ? 'Rift Guardian' : 'Slime', lv, el, mh: 100, r: 20, sc: el === 4 ? 2.6 : 1 }, x, y);
  }

  addPlayer(link: PlayerLink, at?: { x: number; y: number }): number {
    const p = at ?? this.map.entry;
    const ent = this.add({
      id: 0, k: 'player', t: link.save.classId, n: link.save.name, lv: link.save.level, mh: link.derived.life, r: PLAYER_RADIUS,
      look: playerLook(link.save), pl: link.save.paragon.level,
    }, p.x, p.y);
    const pl: Pl = {
      link, ent, q: [], last: { mx: 0, my: 0 }, ack: 0, known: new Set(),
      mv: { x: p.x, y: p.y, dashMs: 0, dashDx: 0, dashDy: 0, dashCdMs: 0, faceX: 1, faceY: 0 },
    };
    this.players.set(link, pl);
    return ent.id;
  }

  removePlayer(link: PlayerLink): void {
    const pl = this.players.get(link);
    if (!pl) return;
    this.players.delete(link);
    this.ents.delete(pl.ent.id);
  }

  queueInput(link: PlayerLink, input: InputMsg): void {
    const pl = this.players.get(link);
    if (!pl) return;
    if (pl.q.length < 10) pl.q.push(input);
  }

  refreshPlayer(link: PlayerLink): void {
    this.refreshCalls++;
    const pl = this.players.get(link);
    if (!pl) return;
    pl.ent.desc = { ...pl.ent.desc, lv: link.save.level, mh: link.derived.life, look: playerLook(link.save) };
    for (const o of this.players.values()) o.known.delete(pl.ent.id); // re-describe to viewers
  }

  playerCount(): number { return this.players.size; }

  spawnPortal(spec: PortalSpec): number {
    const e = this.add({ id: 0, k: 'portal', t: spec.kind, n: spec.label, r: 40 }, spec.x, spec.y, 1, spec.ttlMs ? Date.now() + spec.ttlMs : 0);
    return e.id;
  }

  removeEntity(id: number): void {
    this.ents.delete(id);
  }

  debug(link: PlayerLink, op: string): string | null {
    const pl = this.players.get(link);
    if (!pl) return 'Not in this instance';
    switch (op) {
      case 'goblin': this.spawnMob(pl.ent.x + 120, pl.ent.y, 5); return null;
      case 'elite': this.spawnMob(pl.ent.x + 120, pl.ent.y, 1); return null;
      case 'boss': this.spawnMob(pl.ent.x + 160, pl.ent.y, 4); return null;
      case 'heal': return null;
      default: return `Unknown debug op ${op}`;
    }
  }

  riftState(): RiftState | null {
    if (this.zone.kind !== 'rift') return null;
    return {
      progress: Math.min(100, this.kills * 4), phase: this.completed ? 'done' : this.kills * 4 >= 100 ? 'guardian' : 'hunt',
      level: this.opts.level ?? 1, difficulty: this.opts.difficulty ?? 0, elapsedMs: Date.now() - this.startedAt, owner: this.opts.owner ?? '',
    };
  }

  notice(text: string, kind: 'rift' | 'boss' | 'info' | 'legendary' | 'warn'): void {
    this.events.push({ ev: { e: 'notice', text, kind }, x: null, y: null });
  }

  tickStats(): { avg: number; max: number } {
    const d = this.durations;
    return { avg: d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0, max: d.length ? Math.max(...d) : 0 };
  }

  destroy(): void {
    this.players.clear();
    this.ents.clear();
  }

  tick(): void {
    const t0 = performance.now();
    this.tickNo++;
    const now = Date.now();

    for (const e of this.ents.values()) {
      if (e.expires && now >= e.expires) this.ents.delete(e.id);
      else if (e.deadAt && now - e.deadAt > 4000 && e.desc.k === 'mob') { e.deadAt = 0; e.hp = 1; e.flags &= ~F_DEAD; }
    }

    // Monsters notice nearby players and shuffle towards them.
    for (const e of this.ents.values()) {
      if (e.desc.k !== 'mob' || e.deadAt) continue;
      let best: Pl | null = null, bd = 650;
      for (const pl of this.players.values()) {
        const d = Math.hypot(pl.ent.x - e.x, pl.ent.y - e.y);
        if (d < bd) { bd = d; best = pl; }
      }
      if (!best || bd < 60) continue;
      const step = (110 * TICK_MS) / 1000;
      const p = this.col.moveCircle(e.x, e.y, 20, ((best.ent.x - e.x) / bd) * step, ((best.ent.y - e.y) / bd) * step);
      e.x = p.x;
      e.y = p.y;
    }

    for (const pl of this.players.values()) {
      for (let i = 0; i < 2; i++) {
        const inp = pl.q.shift();
        if (!inp) break;
        pl.last = { mx: inp.mx, my: inp.my };
        pl.ack = inp.seq;
        this.step(pl, inp.mx, inp.my, !!inp.dash);
      }
      if (!pl.q.length && pl.last.mx === 0 && pl.last.my === 0) { /* idle */ }
      // Attack anything standing next to the player.
      if (this.tickNo % 10 === 0) for (const e of this.ents.values()) {
        if (e.desc.k !== 'mob' || e.deadAt) continue;
        if (Math.hypot(e.x - pl.mv.x, e.y - pl.mv.y) > 110) continue;
        e.hp -= 0.35;
        this.events.push({ ev: { e: 'dmg', t: e.id, a: 123, el: 0, s: pl.ent.id }, x: e.x, y: e.y });
        if (e.hp <= 0) {
          e.deadAt = now;
          e.flags |= F_DEAD;
          this.events.push({ ev: { e: 'die', t: e.id, el: 0, x: e.x, y: e.y }, x: e.x, y: e.y });
          this.kills++;
          // Shared XP, like the real simulation: everybody within 1400 units.
          for (const o of this.players.values()) {
            if (Math.hypot(o.ent.x - e.x, o.ent.y - e.y) > 1400) continue;
            const res = addXp(o.link.save, monsterXp(e.desc.lv ?? 1, e.desc.el ?? 0, 0));
            if (res.levels) this.events.push({ ev: { e: 'level', t: o.ent.id, lv: o.link.save.level }, x: o.ent.x, y: o.ent.y });
            o.link.save.stats.kills++;
            o.link.markDirty();
          }
        }
      }
    }

    if (this.opts.onRiftComplete && !this.completed && this.kills * 4 >= 100) {
      this.completed = true;
      this.opts.onRiftComplete();
    }

    for (const pl of this.players.values()) this.snapshot(pl);
    this.events = [];
    this.durations.push(performance.now() - t0);
    if (this.durations.length > 100) this.durations.shift();
  }

  private step(pl: Pl, mx: number, my: number, dash: boolean): void {
    stepMove(this.col, pl.mv, { mx, my, dash }, pl.link.derived.ms, DASH.cooldownMs, TICK_MS, PLAYER_RADIUS);
    pl.ent.x = pl.mv.x;
    pl.ent.y = pl.mv.y;
    pl.ent.flags = (mx || my ? F_MOVING : 0) | (mx < 0 || (!mx && pl.ent.flags & F_LEFT) ? F_LEFT : 0);
  }

  private snapshot(pl: Pl): void {
    const px = pl.ent.x, py = pl.ent.y;
    const add: EntDesc[] = [];
    const upd: number[] = [];
    const rem: number[] = [];
    const visible = new Set<number>();
    for (const e of this.ents.values()) {
      if (Math.abs(e.x - px) > AOI_HALF_W || Math.abs(e.y - py) > AOI_HALF_H) continue;
      visible.add(e.id);
      if (!pl.known.has(e.id)) { pl.known.add(e.id); add.push(e.desc); }
      upd.push(e.id, e.x | 0, e.y | 0, (Math.max(0, e.hp) * 1000) | 0, e.flags, 0);
    }
    for (const id of pl.known) if (!visible.has(id)) { pl.known.delete(id); rem.push(id); }
    const d = pl.link.derived;
    const sv = pl.link.save;
    const me: MeState = {
      x: pl.mv.x, y: pl.mv.y, dashMs: pl.mv.dashMs, dashCd: pl.mv.dashCdMs, hp: d.life, mhp: d.life, res: 0, mres: d.maxResource,
      cds: [0, 0, 0, 0], ch: [0, 0, 0, 0], buffs: [], xp: sv.xp, lv: sv.level, pxp: sv.paragon.xp, pl: sv.paragon.level, gold: sv.gold, dead: 0,
    };
    const snap: Snapshot = { t: 's', tick: this.tickNo, time: Date.now(), ack: pl.ack, me, upd };
    if (add.length) snap.add = add;
    if (rem.length) snap.rem = rem;
    const evs = this.events.filter((r) => r.x === null || (Math.abs(r.x - px) <= AOI_HALF_W && Math.abs((r.y as number) - py) <= AOI_HALF_H)).map((r) => r.ev);
    if (evs.length) snap.ev = evs;
    const rs = this.riftState();
    if (rs) snap.rift = rs;
    pl.link.send(snap as S2C);
  }
}
