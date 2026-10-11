// Per-player world states (docs/rework/quests/DESIGN.md §7; REFERENCES R7 phasing, R8 world states): zone visuals tagged
// with a quest milestone appear or vanish from this player's own save. Collision never changes. A state that turns on
// while the player is in the zone returns a reveal point so the scene can pan the camera to it (F-QST-08).
import { Container, Graphics } from 'pixi.js';
import type { AdventureData, ZonePhase } from '@shared/adventureTypes';
import type { CharacterSave } from '@shared/types';
import type { TownData } from '@shared/townTypes';
import { worldStateOn } from '@shared/quests';
import { TownLife } from './art/townLife';
import { place } from './art/zoneBuild';
import { flameSprite, glowSprite } from './art/fx';

import { activeWorldStates } from './worldStateFlags';

interface Group { phase: ZonePhase; life: TownLife; sprites: Container[]; overlays: Graphics[]; fires: { root: Container; flames: Container[]; glow: Container; x: number }[]; shown: boolean | null }

function lifeData(a: AdventureData, p: ZonePhase): TownData {
  return {
    id: `${a.id}:${p.key}:${p.on ? 1 : 0}`, lights: p.lights.map((l, i) => ({ id: `pl${i}`, position: [l.x, l.y], color: l.color, radius: l.radius, flicker: l.flicker ?? 0.12 })),
    emitters: p.emitters.map((e, i) => ({ id: `pe${i}`, position: [e.x, e.y], kind: e.kind, rate: e.rate })), props: [], decor: [], buildings: [],
    residents: p.residents, villagers: p.walkers.map((w) => ({ id: w.id, look: w.look, path: w.path, speed: w.speed, pause: w.pause })),
  } as unknown as TownData;
}
const centroid = (pts: { x: number; y: number }[]) => pts.length ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length } : undefined;

export class WorldPhases {
  /** Flood water and pools: above the painted ground, below people. */
  readonly ground = new Container();
  private groups: Group[] = [];
  private known = new Map<string, boolean>();
  constructor(private a: AdventureData, entities: Container) {
    for (const phase of a.paint?.phases ?? []) {
      const life = new TownLife(lifeData(a, phase), entities);
      const sprites: Container[] = [];
      for (const d of phase.decor) { const made = place(d.kind, d.s ?? 1, d.v ?? 0, d.x, d.y, d.flip ?? false); if (made) { made.root.zIndex = d.y; entities.addChild(made.root); sprites.push(made.root); } }
      const fires = phase.fires.map((f) => {
        const root = new Container(); root.position.set(f.x, f.y); root.zIndex = f.y + 1; root.scale.set(f.s);
        const glow = glowSprite(0xffb060, 150, 0.45, true); glow.position.set(0, -20);
        const flames = [0, 1, 2].map((i) => { const fl = flameSprite(i === 1 ? 0xffda83 : 0xef9b4c, 34); fl.x = (i - 1) * 10; return fl; });
        const logs = new Graphics().ellipse(0, 2, 26, 8).fill(0x2a1a10).rect(-22, -4, 44, 7).fill(0x5a3a22).rect(-16, -9, 32, 6).fill(0x6a4528);
        root.addChild(logs, glow, ...flames); entities.addChild(root);
        return { root, flames, glow, x: f.x };
      });
      const overlays = phase.overlays.map((o) => {
        const g = new Graphics().poly(o.polygon.flat()).fill({ color: o.kind === 'flood' ? 0x3c6a82 : 0x4f8fb0, alpha: o.kind === 'flood' ? 0.62 : 0.75 })
          .poly(o.polygon.flat()).stroke({ color: 0xbfe4f0, width: 5, alpha: 0.45 });
        this.ground.addChild(g); return g;
      });
      this.groups.push({ phase, life, sprites, overlays, fires, shown: null });
    }
  }
  /** Apply the save; returns the keys that turned on since the previous call (none on the first call). */
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
    for (const g of this.groups) {
      const show = worldStateOn(save, g.phase.key) === g.phase.on;
      if (show === g.shown) continue;
      g.shown = show; g.life.setActive(show);
      for (const s of g.sprites) s.visible = show;
      for (const o of g.overlays) o.visible = show;
      for (const f of g.fires) f.root.visible = show;
    }
    return turnedOn;
  }
  private primed = false;
  private spinKeys(): string[] {
    return [...(this.a.paint?.structures ?? []).flatMap((s) => s.spin ? [s.spin] : []), ...(this.a.wheel?.spin ? [this.a.wheel.spin] : []), ...this.a.interactions.flatMap((i) => (i.moves ?? []).map((m) => m.key))];
  }
  /** Where the change happened: a wheel or structure that starts turning, drained water, a new fire, or the people. */
  revealPoint(key: string): { x: number; y: number } | undefined {
    if (this.a.wheel?.spin === key) return { x: this.a.wheel.x, y: this.a.wheel.y - 40 };
    const st = this.a.paint?.structures?.find((s) => s.spin === key); if (st) return { x: st.x, y: st.y - st.d };
    const on = this.groups.filter((g) => g.phase.key === key), off = on.filter((g) => !g.phase.on), shown = on.filter((g) => g.phase.on);
    const water = off.flatMap((g) => g.phase.overlays.flatMap((o) => o.polygon.map(([x, y]) => ({ x, y }))));
    if (water.length) return centroid(water);
    const fire = shown.flatMap((g) => g.phase.fires); if (fire.length) return centroid(fire);
    const people = shown.flatMap((g) => [...g.phase.residents, ...g.phase.decor]); if (people.length) return centroid(people);
    const moved = this.a.interactions.flatMap((i) => (i.moves ?? []).filter((m) => m.key === key)); if (moved.length) return centroid(moved);
    return undefined;
  }
  update(dt: number, time: number, cx: number, cy: number, halfW: number, halfH: number) {
    for (const g of this.groups) {
      if (!g.shown) continue;
      g.life.update(dt, time, cx, cy, halfW, halfH);
      for (const f of g.fires) { f.flames.forEach((fl, i) => { fl.scale.y = 0.3 + Math.sin(time * 8 + i * 1.7 + f.x) * 0.05; }); f.glow.alpha = 0.4 + Math.sin(time * 6.3 + f.x) * 0.06; }
      for (const o of g.overlays) o.alpha = 0.92 + Math.sin(time * 1.3) * 0.08;
    }
  }
  destroy() {
    for (const g of this.groups) { g.life.destroy(); for (const s of g.sprites) s.destroy({ children: true }); for (const f of g.fires) f.root.destroy({ children: true }); }
    this.ground.destroy({ children: true }); this.groups = []; activeWorldStates.clear();
  }
}
