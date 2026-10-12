// Per-player world states (docs/rework/quests/DESIGN.md §7; REFERENCES R7 phasing, R8 world states): zone visuals tagged
// with a quest milestone appear or vanish from this player's own save. Collision never changes. A state that turns on
// while the player is in the zone returns a reveal point so the scene can pan the camera to it (F-QST-08), and the change
// then plays out there instead of popping before the camera arrives: water drains, new things settle in, fires flare up,
// wheels spin up (worldStateFlags.stateRamp) and a glint marks the spot. Owner 2026-10-12: "it took my camera somewhere
// ... and nothing was happening there". Timings are [P] placeholders, judged by eye in the browser.
import { Container, Graphics, type Sprite } from 'pixi.js';
import type { AdventureData, ZonePhase } from '@shared/adventureTypes';
import type { CharacterSave } from '@shared/types';
import type { TownData } from '@shared/townTypes';
import { worldStateOn } from '@shared/quests';
import { TownLife } from './art/townLife';
import { place } from './art/zoneBuild';
import { flameSprite, glowSprite, ringSprite, sparkleSprite } from './art/fx';
import { motionReduced } from '../game/preferences';

import { activeWorldStates, worldStateSince } from './worldStateFlags';

interface Fire { root: Container; flames: Container[]; glow: Sprite; glowScale: number; x: number; s: number }
interface Group {
  phase: ZonePhase; life: TownLife; sprites: { root: Container; y: number }[]; overlays: Graphics[]; fires: Fire[];
  /** What the save asks for (null before the first refresh). */ shown: boolean | null;
  /** Drawn right now (a group fading out is still drawn). */ live: boolean;
  /** 0..1 how much of the group shows; flare 0..1 while its fires catch. */ fade: number; flare: number;
}
interface Change { g: Group; show: boolean; start: number }
interface Burst { root: Container; ring: Sprite; glow: Sprite; motes: Sprite[]; start: number }

/** [P] A change takes CHANGE_MS once the camera is there; water drains a little slower; the glint lasts BURST_MS. */
const CHANGE_MS = 1500, DRAIN_MS = 2400, BURST_MS = 1700;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function lifeData(a: AdventureData, p: ZonePhase): TownData {
  return {
    id: `${a.id}:${p.key}:${p.on ? 1 : 0}`, lights: p.lights.map((l, i) => ({ id: `pl${i}`, position: [l.x, l.y], color: l.color, radius: l.radius, flicker: l.flicker ?? 0.12 })),
    emitters: p.emitters.map((e, i) => ({ id: `pe${i}`, position: [e.x, e.y], kind: e.kind, rate: e.rate })), props: [], decor: [], buildings: [],
    residents: p.residents, villagers: p.walkers.map((w) => ({ id: w.id, look: w.look, path: w.path, speed: w.speed, pause: w.pause })),
  } as unknown as TownData;
}
const centroid = (pts: { x: number; y: number }[]) => pts.length ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length } : undefined;
/** The group of points nearest the hero (or the first), so a change spread over the zone frames one real spot, not the empty middle. */
function cluster(pts: { x: number; y: number }[], near?: { x: number; y: number }) {
  if (!pts.length) return undefined;
  const anchor = near ? pts.reduce((b, p) => Math.hypot(p.x - near.x, p.y - near.y) < Math.hypot(b.x - near.x, b.y - near.y) ? p : b) : pts[0];
  return centroid(pts.filter((p) => Math.hypot(p.x - anchor.x, p.y - anchor.y) < 800));
}
const area = (poly: [number, number][]) => Math.abs(poly.reduce((s, [x, y], i) => { const [nx, ny] = poly[(i + 1) % poly.length]; return s + x * ny - nx * y; }, 0)) / 2;

export class WorldPhases {
  /** Flood water and pools: above the painted ground, below people. */
  readonly ground = new Container();
  private groups: Group[] = [];
  private known = new Map<string, boolean>();
  private changes: Change[] = [];
  private bursts: Burst[] = [];
  private pendingAt = 0;
  constructor(private a: AdventureData, private entities: Container) {
    for (const phase of a.paint?.phases ?? []) {
      const life = new TownLife(lifeData(a, phase), entities);
      const sprites: Group['sprites'] = [];
      for (const d of phase.decor) { const made = place(d.kind, d.s ?? 1, d.v ?? 0, d.x, d.y, d.flip ?? false); if (made) { made.root.zIndex = d.y; entities.addChild(made.root); sprites.push({ root: made.root, y: made.root.y }); } }
      const fires = phase.fires.map((f) => {
        const root = new Container(); root.position.set(f.x, f.y); root.zIndex = f.y + 1; root.scale.set(f.s);
        const glow = glowSprite(0xffb060, 150, 0.45, true); glow.position.set(0, -20);
        const flames = [0, 1, 2].map((i) => { const fl = flameSprite(i === 1 ? 0xffda83 : 0xef9b4c, 34); fl.x = (i - 1) * 10; return fl; });
        const logs = new Graphics().ellipse(0, 2, 26, 8).fill(0x2a1a10).rect(-22, -4, 44, 7).fill(0x5a3a22).rect(-16, -9, 32, 6).fill(0x6a4528);
        root.addChild(logs, glow, ...flames); entities.addChild(root);
        return { root, flames, glow, glowScale: glow.scale.x, x: f.x, s: f.s };
      });
      const overlays = phase.overlays.map((o) => {
        const g = new Graphics().poly(o.polygon.flat()).fill({ color: o.kind === 'flood' ? 0x3c6a82 : 0x4f8fb0, alpha: o.kind === 'flood' ? 0.62 : 0.75 })
          .poly(o.polygon.flat()).stroke({ color: 0xbfe4f0, width: 5, alpha: 0.45 });
        // Scaled about its own middle, so draining water pulls in from the banks.
        const c = centroid(o.polygon.map(([x, y]) => ({ x, y })))!; g.pivot.set(c.x, c.y); g.position.set(c.x, c.y);
        this.ground.addChild(g); return g;
      });
      this.groups.push({ phase, life, sprites, overlays, fires, shown: null, live: true, fade: 1, flare: 0 });
    }
  }
  /** Apply the save; returns the keys that turned on since the previous call (none on the first call). Changes after the
   *  first call wait for `start()` (the camera is on its way) and then play out; the first call (zone entry) is instant. */
  refresh(save: CharacterSave | null): string[] {
    const turnedOn: string[] = [], first = this.known.size === 0 && !this.primed;
    const keys = new Set([...this.groups.map((g) => g.phase.key), ...this.spinKeys()]);
    activeWorldStates.clear();
    for (const key of keys) {
      const on = worldStateOn(save, key);
      if (on) activeWorldStates.add(key);
      if (!first && on && this.known.get(key) === false) turnedOn.push(key);
      this.known.set(key, on);
    }
    this.primed = true;
    const calm = motionReduced();
    // Wheels and kilns hold still until the reveal starts them (stateRamp).
    if (!calm) for (const key of turnedOn) worldStateSince.set(key, Infinity);
    for (const g of this.groups) {
      const show = worldStateOn(save, g.phase.key) === g.phase.on;
      if (show === g.shown) continue;
      const animate = g.shown !== null && !calm;
      g.shown = show; this.changes = this.changes.filter((c) => c.g !== g);
      if (!animate) { this.setLive(g, show); this.paint(g, 1, false); continue; }
      this.setLive(g, true); this.paint(g, show ? 0 : 1, show);
      this.changes.push({ g, show, start: Infinity });
    }
    this.pendingAt = performance.now();
    return turnedOn;
  }
  /** The camera is on its way (or already there): pending changes play after `delayMs`, with a glint at `at`. */
  start(delayMs: number, at?: { x: number; y: number }) {
    const t = performance.now() + delayMs;
    for (const c of this.changes) if (c.start === Infinity) c.start = t;
    for (const [k, v] of worldStateSince) if (v === Infinity) worldStateSince.set(k, t);
    if (at && !motionReduced()) this.burst(at.x, at.y, t);
  }
  private primed = false;
  private spinKeys(): string[] {
    return [...(this.a.paint?.structures ?? []).flatMap((s) => s.spin ? [s.spin] : []), ...(this.a.wheel?.spin ? [this.a.wheel.spin] : []), ...this.a.interactions.flatMap((i) => (i.moves ?? []).map((m) => m.key))];
  }
  /** Where the change happened: drained water, a kiln that goes cold, a wheel that starts turning, a new fire, fog or
   *  lights that go, or the people. Spread-out changes frame the spot nearest the hero (`near`). */
  revealPoint(key: string, near?: { x: number; y: number }): { x: number; y: number } | undefined {
    const on = this.groups.filter((g) => g.phase.key === key), off = on.filter((g) => !g.phase.on), shown = on.filter((g) => g.phase.on);
    // Draining water is the largest visible change: frame the biggest pool, never the middle of several.
    const pools = off.flatMap((g) => g.phase.overlays).sort((x, y) => area(y.polygon) - area(x.polygon));
    if (pools.length) return centroid(pools[0].polygon.map(([x, y]) => ({ x, y })));
    const kilns = (this.a.kilns ?? []).filter((k) => k.cold === key);
    if (kilns.length) return cluster(kilns.map((k) => ({ x: k.x + k.w / 2, y: k.y + k.d - k.h * 0.3 })), near);
    // A wheel that starts turning shares the frame with the people and props that change around it.
    const st = this.a.paint?.structures?.find((s) => s.spin === key);
    const spin = this.a.wheel?.spin === key ? { x: this.a.wheel.x, y: this.a.wheel.y - 40 } : st ? { x: st.x, y: st.y - st.d } : undefined;
    if (spin) {
      const nearby = on.flatMap((g) => [...g.phase.residents, ...g.phase.decor]).filter((p) => Math.hypot(p.x - spin.x, p.y - spin.y) < 900);
      if (!nearby.length) return spin;
      const c = centroid(nearby)!; return { x: (spin.x + c.x) / 2, y: (spin.y + c.y) / 2 };
    }
    return cluster(shown.flatMap((g) => g.phase.fires), near)
      ?? cluster(off.flatMap((g) => [...g.phase.emitters, ...g.phase.lights]), near)
      ?? cluster(shown.flatMap((g) => [...g.phase.residents, ...g.phase.decor]), near)
      ?? cluster(this.a.interactions.flatMap((i) => (i.moves ?? []).filter((m) => m.key === key)), near)
      ?? cluster(off.flatMap((g) => [...g.phase.residents, ...g.phase.decor]), near);
  }
  private setLive(g: Group, on: boolean) {
    g.live = on; g.life.setActive(on);
    for (const s of g.sprites) s.root.visible = on;
    for (const o of g.overlays) o.visible = on;
    for (const f of g.fires) f.root.visible = on;
  }
  /** Draw a group at `a` (0 gone … 1 fully there); `arriving` things settle down into place and fires catch from small. */
  private paint(g: Group, a: number, arriving: boolean) {
    g.fade = a; g.life.setAlpha(a);
    for (const s of g.sprites) { s.root.alpha = a; s.root.y = s.y - (arriving ? (1 - a) * 14 : 0); }
    for (const o of g.overlays) o.scale.set(0.8 + 0.2 * a);
    for (const f of g.fires) f.root.scale.set(f.s * (arriving ? 0.15 + 0.85 * a : Math.max(0.05, a)));
  }
  private burst(x: number, y: number, start: number) {
    const root = new Container(); root.position.set(x, y); root.zIndex = y + 4000; root.visible = false;
    const glow = glowSprite(0xffe2a0, 260, 0, true), ring = ringSprite(0xffd890, 80, 0, true);
    const motes = Array.from({ length: 14 }, () => sparkleSprite(0xfff0c0, 8, 0));
    root.addChild(glow, ring, ...motes); this.entities.addChild(root);
    this.bursts.push({ root, ring, glow, motes, start });
  }
  update(dt: number, time: number, cx: number, cy: number, halfW: number, halfH: number) {
    const now = performance.now();
    // A refresh nobody started (no reveal point and no camera move) still plays, just without waiting.
    if (this.changes.some((c) => c.start === Infinity) && now - this.pendingAt > 2500) this.start(0);
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const c = this.changes[i]; if (now < c.start) continue;
      const t = (now - c.start) / (!c.show && c.g.overlays.length ? DRAIN_MS : CHANGE_MS), e = ease(t);
      this.paint(c.g, c.show ? e : 1 - e, c.show); c.g.flare = c.show && c.g.fires.length ? Math.sin(Math.PI * Math.min(1, t)) : 0;
      if (t >= 1) { this.changes.splice(i, 1); c.g.flare = 0; if (!c.show) { this.setLive(c.g, false); this.paint(c.g, 1, false); } }
    }
    for (const g of this.groups) {
      if (!g.live) continue;
      g.life.update(dt, time, cx, cy, halfW, halfH);
      for (const f of g.fires) {
        f.flames.forEach((fl, i) => { fl.scale.y = 0.3 + Math.sin(time * 8 + i * 1.7 + f.x) * 0.05 + g.flare * 0.25; });
        f.glow.alpha = 0.4 + Math.sin(time * 6.3 + f.x) * 0.06 + g.flare * 0.6; f.glow.scale.set(f.glowScale * (1 + g.flare * 0.9));
      }
      for (const o of g.overlays) o.alpha = (0.92 + Math.sin(time * 1.3) * 0.08) * g.fade;
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i], t = (now - b.start) / BURST_MS;
      if (t < 0) continue;
      if (t >= 1) { b.root.destroy({ children: true }); this.bursts.splice(i, 1); continue; }
      b.root.visible = true;
      const w = 90 + 560 * ease(t); b.ring.width = w; b.ring.height = w * 0.5; b.ring.alpha = (1 - t) * 0.85;
      b.glow.alpha = Math.sin(Math.PI * Math.min(1, t * 1.5)) * 0.5;
      b.motes.forEach((m, k) => { const ang = (k / b.motes.length) * Math.PI * 2 + k * 0.7, r = 50 + 190 * ease(t); m.position.set(Math.cos(ang) * r, Math.sin(ang) * r * 0.5 - 110 * t - 20); m.alpha = Math.sin(Math.PI * t) * 0.95; });
    }
  }
  destroy() {
    for (const g of this.groups) { g.life.destroy(); for (const s of g.sprites) s.root.destroy({ children: true }); for (const f of g.fires) f.root.destroy({ children: true }); }
    for (const b of this.bursts) b.root.destroy({ children: true });
    this.ground.destroy({ children: true }); this.groups = []; this.changes = []; this.bursts = []; activeWorldStates.clear(); worldStateSince.clear();
  }
}
