// Client-side entity store: snapshot buffering and interpolation of remote entities
// (render time = estimated server time − INTERP_DELAY_MS).

import { INTERP_DELAY_MS, TICK_MS } from '@shared/constants';
import { generateMap, type MapData } from '@shared/mapgen';
import { CollisionWorld } from '@shared/movement';
import { F_DEAD, F_LEFT, F_MOVING, STATE_STRIDE, type EntDesc, type Snapshot, type ZoneInfo } from '@shared/protocol';
import type { EntityView, Nameplate } from '../render/types';

interface Sample { t: number; x: number; y: number; hp: number; flags: number; aseq: number }

export class ClientEntity {
  samples: Sample[] = [];
  x = 0; y = 0; vx = 0; vy = 0;
  hp = 1;
  flags = 0;
  aseq = 0;
  view: EntityView | null = null;
  nameplate: Nameplate | null = null;
  /** Set when the server removed the entity; the view may still be playing a death animation. */
  removed = false;
  dying = false;
  /** Element index of the killing blow (for death styles). */
  deathEl = -1;
  constructor(public desc: EntDesc) {}

  get id() { return this.desc.id; }
  get kind() { return this.desc.k; }

  push(s: Sample) {
    const last = this.samples[this.samples.length - 1];
    if (last && s.t <= last.t) { this.samples[this.samples.length - 1] = s; return; }
    this.samples.push(s);
    if (this.samples.length > 12) this.samples.shift();
    if (this.samples.length === 1) { this.x = s.x; this.y = s.y; this.hp = s.hp; this.flags = s.flags; this.aseq = s.aseq; }
  }

  interpolate(t: number) {
    const ss = this.samples;
    if (!ss.length) return;
    let a = ss[0], b = ss[ss.length - 1];
    if (t <= a.t) { b = a; }
    else if (t >= b.t) {
      // Extrapolate briefly (max 1 tick) to hide jitter, then hold.
      const prev = ss.length > 1 ? ss[ss.length - 2] : b;
      const dt = Math.min(t - b.t, TICK_MS);
      const span = b.t - prev.t || TICK_MS;
      const vx = (b.x - prev.x) / span, vy = (b.y - prev.y) / span;
      this.set(b.x + vx * dt, b.y + vy * dt, b, vx * 1000, vy * 1000);
      return;
    } else {
      for (let i = ss.length - 1; i > 0; i--) if (ss[i - 1].t <= t) { a = ss[i - 1]; b = ss[i]; break; }
    }
    const span = b.t - a.t;
    const k = span > 0 ? (t - a.t) / span : 1;
    const vx = span > 0 ? ((b.x - a.x) / span) * 1000 : 0;
    const vy = span > 0 ? ((b.y - a.y) / span) * 1000 : 0;
    this.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, k > 0.5 ? b : a, vx, vy, a.hp + (b.hp - a.hp) * k);
  }

  private set(x: number, y: number, s: Sample, vx: number, vy: number, hp = s.hp) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.hp = hp;
    this.flags = s.flags;
    this.aseq = s.aseq;
  }

  /** Local player: position comes from prediction, but state (flags, life, attack sequence) must still
   *  follow the newest server sample, or channels like Whirlwind never show. */
  applyLatest() {
    const s = this.samples[this.samples.length - 1];
    if (!s) return;
    this.hp = s.hp;
    this.flags = s.flags;
    this.aseq = s.aseq;
  }

  get facingLeft() { return (this.flags & F_LEFT) !== 0; }
  get moving() { return (this.flags & F_MOVING) !== 0; }
  get dead() { return (this.flags & F_DEAD) !== 0; }
}

export interface WorldHooks {
  onAdd(e: ClientEntity): void;
  onRemove(e: ClientEntity): void;
}

export class ClientWorld {
  entities = new Map<number, ClientEntity>();
  map: MapData | null = null;
  collision: CollisionWorld | null = null;
  zone: ZoneInfo | null = null;
  myId = 0;
  /** serverTime ≈ performance.now() + offset */
  private offset = 0;
  private offsetInit = false;

  constructor(private hooks: WorldHooks) {}

  setZone(zone: ZoneInfo, myId: number) {
    for (const e of this.entities.values()) this.hooks.onRemove(e);
    this.entities.clear();
    this.zone = zone;
    this.myId = myId;
    this.map = generateMap(zone.zone, zone.seed, zone.theme);
    this.collision = new CollisionWorld(this.map);
  }

  serverNow() { return performance.now() + this.offset; }
  renderTime() { return this.serverNow() - INTERP_DELAY_MS; }

  /** Apply entity additions and state updates (events and removals are handled by the caller in order). */
  applySnapshot(s: Snapshot) {
    const est = s.time - performance.now();
    if (!this.offsetInit) { this.offset = est; this.offsetInit = true; }
    // Track the minimum one-way delay (newest snapshots arriving late shouldn't drag time backwards).
    else this.offset = est > this.offset ? this.offset + (est - this.offset) * 0.05 : this.offset + (est - this.offset) * 0.25;

    if (s.add) for (const d of s.add) {
      const existing = this.entities.get(d.id);
      if (existing && !existing.removed) { existing.desc = d; this.hooks.onAdd(existing); continue; }
      if (existing) this.hooks.onRemove(existing);
      const e = new ClientEntity(d);
      this.entities.set(d.id, e);
      this.hooks.onAdd(e);
    }
    const u = s.upd;
    for (let i = 0; i + STATE_STRIDE <= u.length; i += STATE_STRIDE) {
      const e = this.entities.get(u[i]);
      if (!e) continue;
      e.push({ t: s.time, x: u[i + 1], y: u[i + 2], hp: u[i + 3] / 1000, flags: u[i + 4], aseq: u[i + 5] });
    }
  }

  applyRemovals(ids: number[] | undefined) {
    if (!ids) return;
    for (const id of ids) {
      const e = this.entities.get(id);
      if (!e) continue;
      e.removed = true;
      this.entities.delete(id);
      this.hooks.onRemove(e);
    }
  }

  interpolate() {
    const t = this.renderTime();
    for (const e of this.entities.values()) {
      if (e.id === this.myId) e.applyLatest();
      else e.interpolate(t);
    }
  }

  get me() { return this.entities.get(this.myId) ?? null; }
}
