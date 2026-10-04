// Shared state for every effect module: particle system, textures, clock, timers, ongoing effects,
// a light registry of entities seen through createNameplate (tier / colours / players) and helpers.

import { Container } from 'pixi.js';
import { MONSTERS } from '@shared/data/monsters';
import { sfx } from '../../audio/sfx';
import type { VfxContext, VfxLayers } from './index';
import { getFxAtlas, type FxTextures } from './atlas';
import { FxSystem } from './particles';

export interface EntInfo {
  kind: 'player' | 'mob';
  /** Elite tier for mobs (0 normal, 1 champion, 2 rare, 3 minion, 4 boss, 5 goblin). */
  tier: number;
  body: number;
  accent: number;
  /** Class id (players) or monster id. */
  t: string;
}

/** An ongoing effect. Return false from update() when finished; kill() releases its resources early. */
export interface Effect {
  update(dt: number): boolean;
  kill(): void;
}

interface Timer { at: number; fn: () => void }
interface Mark { kind: string; x: number; y: number; t: number }

export class VfxCore {
  readonly T: FxTextures;
  readonly sys: FxSystem;
  /** Graphics telegraphs, above ground particles. */
  readonly teleLayer = new Container({ label: 'vfx-telegraphs' });
  /** Seconds since start (advances with real time, frozen during our own hit-stops for world fx). */
  time = 0;
  /** Real clock (never frozen). */
  real = 0;
  readonly ents = new Map<number, EntInfo>();
  /** Player nameplates listening for level / paragon changes. */
  readonly levelHooks = new Map<number, (lv: number, paragon: boolean) => void>();
  readonly players = new Set<number>();
  private timers: Timer[] = [];
  private effects: Effect[] = [];
  private marks: Mark[] = [];
  private mineCache = new Map<number, { mine: boolean; at: number }>();
  /** Recent deaths (loot fountain origins). */
  readonly deaths: { x: number; y: number; t: number; n: number }[] = [];
  hitStopUntil = 0;
  private lastHitStop = -1;
  private lastShake = -1;
  /** EMA of my recent non-crit hit amounts (to detect "big" crits). */
  hitEma = 0;
  /** Time since the last clear() (zone change) — loot added right after a zone change is not "fresh". */
  zoneAge = 0;

  constructor(readonly layers: VfxLayers, readonly ctx: VfxContext) {
    this.T = getFxAtlas();
    this.sys = new FxSystem(this.T, layers.groundFx, layers.aboveFx);
    layers.groundFx.addChild(this.teleLayer);
  }

  // ───────── registry ─────────

  register(id: number, kind: 'player' | 'mob', t: string, tier: number): void {
    const def = kind === 'mob' ? MONSTERS[t] : undefined;
    this.ents.set(id, { kind, tier, t, body: def?.colors.body ?? 0xd8cfc0, accent: def?.colors.accent ?? 0x8a7a6a });
    if (kind === 'player') this.players.add(id);
    if (this.ents.size > 6000) {
      // Drop the oldest half (insertion order) — entities that left the AOI without dying.
      let n = 0;
      for (const k of this.ents.keys()) { if (n++ > 3000) break; this.ents.delete(k); this.players.delete(k); }
    }
  }

  forget(id: number): void {
    this.ents.delete(id);
    this.players.delete(id);
    this.mineCache.delete(id);
  }

  tierOf(id: number | undefined): number {
    return id === undefined ? 0 : this.ents.get(id)?.tier ?? 0;
  }

  isElite(id: number): boolean {
    const t = this.tierOf(id);
    return t === 1 || t === 2 || t === 4 || t === 5;
  }

  /**
   * Is this damage/projectile source the local player (or one of its summons)? Summon ownership is not
   * replicated to the effects context, so a summon belongs to the nearest known player.
   */
  isMine(src: number | undefined): boolean {
    const me = this.ctx.myId();
    if (!src || src === me) return true;
    const info = this.ents.get(src);
    if (info) return false;
    const c = this.mineCache.get(src);
    if (c && this.real - c.at < 1) return c.mine;
    let mine = true;
    const sp = this.ctx.entityPos(src);
    const mp = this.ctx.entityPos(me);
    if (sp && mp && this.players.size > 1) {
      const dm = Math.hypot(sp.x - mp.x, sp.y - mp.y);
      for (const p of this.players) {
        if (p === me) continue;
        const pp = this.ctx.entityPos(p);
        if (pp && Math.hypot(sp.x - pp.x, sp.y - pp.y) < dm - 1) { mine = false; break; }
      }
    }
    this.mineCache.set(src, { mine, at: this.real });
    if (this.mineCache.size > 400) this.mineCache.clear();
    return mine;
  }

  /** Feet position + sprite height of an entity. */
  body(id: number): { x: number; y: number; h: number; r: number } | null {
    const p = this.ctx.entityPos(id);
    if (!p) return null;
    const v = this.ctx.entityView(id);
    return { x: p.x, y: p.y, h: v?.height ?? 40, r: this.ctx.entityRadius(id) };
  }

  myPos(): { x: number; y: number } | null {
    return this.ctx.entityPos(this.ctx.myId());
  }

  // ───────── feedback (throttled) ─────────

  hitStop(ms: number): void {
    if (this.real - this.lastHitStop < 0.3) return;
    this.lastHitStop = this.real;
    this.hitStopUntil = this.real + ms / 1000;
    this.ctx.hitStop(ms);
  }

  shake(mag: number, ms: number, minGap = 0.08): void {
    if (this.real - this.lastShake < minGap) return;
    this.lastShake = this.real;
    this.ctx.shake(mag, ms);
  }

  /** Shake only when the effect is near the local player (screen-relevant). */
  shakeNear(x: number, y: number, mag: number, ms: number): void {
    const m = this.myPos();
    if (!m) { this.shake(mag, ms); return; }
    const d = Math.hypot(x - m.x, y - m.y);
    if (d > 900) return;
    this.shake(mag * (d < 350 ? 1 : 1 - (d - 350) / 700), ms);
  }

  sound(name: string, x?: number, y?: number, vol = 1): void {
    sfx.play(name, x === undefined ? { vol } : { x, y, vol });
  }

  // ───────── scheduling & effects ─────────

  after(seconds: number, fn: () => void): void {
    if (seconds <= 0) { fn(); return; }
    this.timers.push({ at: this.time + seconds, fn });
  }

  add(e: Effect): void {
    this.effects.push(e);
  }

  get effectCount(): number {
    return this.effects.length;
  }

  /** Record a visual so a duplicate event (e.g. aoe after its telegraph resolved) can be suppressed. */
  mark(kind: string, x: number, y: number): void {
    this.marks.push({ kind, x, y, t: this.real });
    if (this.marks.length > 64) this.marks.splice(0, this.marks.length - 64);
  }

  /** True (and consumes the mark) if a matching visual was recorded within `win` seconds and `dist` units. */
  consume(kind: string, x: number, y: number, win = 0.2, dist = 50): boolean {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      if (this.real - m.t > win) continue;
      if (m.kind === kind && Math.abs(m.x - x) < dist && Math.abs(m.y - y) < dist) {
        this.marks.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  noteDeath(x: number, y: number): void {
    this.deaths.push({ x, y, t: this.real, n: 0 });
    if (this.deaths.length > 40) this.deaths.shift();
  }

  /** Most recent death within `dist` of (x, y) in the last 1.6 s (loot fountain origin). */
  deathNear(x: number, y: number, dist = 150): { x: number; y: number; t: number; n: number } | null {
    for (let i = this.deaths.length - 1; i >= 0; i--) {
      const d = this.deaths[i];
      if (this.real - d.t > 1.6) break;
      if (Math.abs(d.x - x) < dist && Math.abs(d.y - y) < dist) return d;
    }
    return null;
  }

  update(dt: number, realDt: number): void {
    this.real += realDt;
    this.zoneAge += realDt;
    this.time += dt;
    if (this.timers.length) {
      const due: Timer[] = [];
      this.timers = this.timers.filter((t) => (t.at <= this.time ? (due.push(t), false) : true));
      for (const t of due) t.fn();
    }
    if (this.effects.length) {
      let w = 0;
      const list = this.effects;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.update(dt)) list[w++] = e;
        else e.kill();
      }
      list.length = w;
    }
    this.sys.update(dt);
  }

  clear(): void {
    for (const e of this.effects) e.kill();
    this.effects = [];
    this.timers = [];
    this.marks = [];
    this.deaths.length = 0;
    this.mineCache.clear();
    this.ents.clear();
    this.players.clear();
    this.levelHooks.clear();
    this.sys.clear();
    for (const c of this.teleLayer.removeChildren()) c.destroy({ children: true });
    this.zoneAge = 0;
  }
}
