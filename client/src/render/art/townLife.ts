import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { TownData } from '@shared/townTypes';
import { townPatrol } from '@shared/townLife';
import { PlayerArt } from './player';
import { NpcArt } from './npcs';
import { RESIDENT_PRESETS, npcPreset } from './npcLooks';
import { flameSprite, glowSprite, sparkleSprite } from './fx';
import type { ViewState } from '../types';
import type { Speaker } from '../barks';
import { BARKS } from '@shared/data/barks';

type Motion = { root: Container; x: number; y: number; kind: string; parts: Container[]; seed: number };
const still = (): ViewState => ({ x: 0, y: 0, vx: 0, vy: 0, moving: false, facingLeft: false, flags: 0, attackSeq: 0, hpFrac: 1, time: 0, aps: 1 });
const BULBS = [0xffd27a, 0xff9a6a, 0x9fe0ff, 0xc8a0ff, 0xb8f08a];
let beamTex: Texture | null = null;
/** Soft lighthouse beam: bright at the lantern, fading with distance, feathered edges (white; tinted by the sprite). */
function beamTexture(): Texture {
  if (beamTex && !beamTex.destroyed) return beamTex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d')!;
  for (let x = 0; x < 256; x++) {
    const along = Math.pow(1 - x / 256, 1.6) * 0.22, half = 4 + (x / 256) * 28;
    const g = c.createLinearGradient(0, 32 - half, 0, 32 + half);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${along})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x, 32 - half, 1, half * 2);
  }
  beamTex = Texture.from(cv);
  return beamTex;
}

/** Fixed, pooled visual population (docs/rework/DESIGN.md §4). Nothing is allocated per frame. */
export class TownLife {
  readonly ground = new Container();
  readonly above = new Container();
  /** Townsfolk who may remark as the hero passes (walkers follow their patrol). */
  readonly speakers: Speaker[] = [];
  private motions: Motion[] = [];
  private walkers: { data: NonNullable<TownData['villagers']>[number]; view: PlayerArt; state: ViewState }[] = [];
  private residents: { view: NpcArt; x: number; y: number; state: ViewState }[] = [];
  private lightSprites: { data: TownData['lights'][number]; view: Sprite }[] = [];
  constructor(private town: TownData, private entities: Container) {
    for (const l of town.lights) {
      const glow = glowSprite(l.color, l.radius * 2, 0.2, true); glow.position.set(...l.position); glow.scale.y *= 0.65; this.ground.addChild(glow); this.lightSprites.push({ data: l, view: glow });
    }
    for (const e of town.emitters) {
      const root = new Container(); root.position.set(...e.position); this.above.addChild(root);
      const parts: Container[] = [], gull = e.id.includes('gull');
      for (let i = 0; i < e.rate; i++) {
        let p: Container;
        if (e.kind === 'smoke' || e.kind === 'fog') p = glowSprite(e.kind === 'fog' ? 0xaebcc8 : 0x8c8f88, e.kind === 'fog' ? 380 : 46, 0.1, false);
        else if (e.kind === 'embers' || e.kind === 'motes') p = sparkleSprite(e.kind === 'embers' ? 0xffba66 : 0xd2b8e2, 4, 0.8);
        else if (e.kind === 'fireflies') p = sparkleSprite(0xe8ff9a, 5, 0.9);
        else if (e.kind === 'birds') p = new Graphics().moveTo(-10, 0).quadraticCurveTo(-5, -5, 0, 0).quadraticCurveTo(5, -5, 10, 0).stroke({ color: gull ? 0xeef2f0 : 0x171f20, width: 2 });
        else p = new Graphics().poly([-3, 0, 0, -2, 5, 1, 0, 3]).fill([0x8b7845, 0x6b6b42, 0x9e7d43][i % 3]);
        parts.push(p); root.addChild(p);
      }
      this.motions.push({ root, parts, x: e.position[0], y: e.position[1], kind: e.kind, seed: this.motions.length });
    }
    for (const p of town.props.filter((p) => p.kind === 'brazier' || p.kind === 'hearth')) {
      const hearth = p.kind === 'hearth', root = new Container(), parts: Container[] = [];
      root.position.set(p.x, p.y - (hearth ? 6 : p.height ?? 40)); root.zIndex = p.y + 1; entities.addChild(root);
      for (let i = 0; i < 3; i++) { const f = flameSprite(i === 1 ? 0xffda83 : 0xef9b4c, hearth ? 18 : 24); f.x = (i - 1) * (hearth ? 10 : 8); parts.push(f); root.addChild(f); }
      this.motions.push({ root, parts, x: p.x, y: p.y, kind: 'flame', seed: 0 });
    }
    // string lights and laundry hang overhead, so they always draw above the walkers below them
    for (const d of town.decor ?? []) if ((d.kind === 'stringlights' || d.kind === 'laundry') && d.to) {
      const root = new Container(), parts: Container[] = [], [bx, by] = d.to, h = 150, sag = 26;
      const at = (t: number): [number, number] => [d.x + (bx - d.x) * t, d.y + (by - d.y) * t - h + Math.sin(t * Math.PI) * sag];
      const wire = new Graphics(); wire.moveTo(...at(0)); for (let k = 1; k <= 16; k++) wire.lineTo(...at(k / 16)); wire.stroke({ color: 0x2a2420, width: 1.5 });
      root.addChild(wire);
      const n = d.kind === 'stringlights' ? Math.max(6, Math.round(Math.hypot(bx - d.x, by - d.y) / 22)) : 6;
      for (let k = 1; k < n; k++) {
        const [x, y] = at(k / n);
        if (d.kind === 'stringlights') { const s = glowSprite(BULBS[k % BULBS.length], 26, 0.75, true); s.position.set(x, y + 3); parts.push(s); root.addChild(s); root.addChild(new Graphics().circle(x, y + 3, 2.4).fill(BULBS[k % BULBS.length])); }
        else { const cloth = new Graphics().poly([-9, 0, 9, 0, 8, 22, -8, 24]).fill([0xe8dcc0, 0x7a9ab8, 0xc86a5a, 0xd8c890, 0x8aa87a][k % 5]).stroke({ color: 0x2a2420, width: 1 }); cloth.position.set(x, y); parts.push(cloth); root.addChild(cloth); }
      }
      this.above.addChild(root);
      this.motions.push({ root, parts, x: (d.x + bx) / 2, y: (d.y + by) / 2, kind: d.kind, seed: this.motions.length });
    }
    for (const b of town.buildings) if (b.look?.kit?.beacon) {
      const cx = b.footprint.reduce((s, p) => s + p[0], 0) / b.footprint.length, cy = b.footprint.reduce((s, p) => s + p[1], 0) / b.footprint.length;
      const e = b.look.eaveHeight, root = new Container(); root.position.set(cx, cy - e + 20); this.above.addChild(root);
      const beam = new Sprite(beamTexture()); beam.anchor.set(0, 0.5); beam.width = 900; beam.height = 210; beam.tint = 0xffe2a0; beam.blendMode = 'add';
      const core = glowSprite(0xffe6a8, 150, 0.85, true), halo = glowSprite(0xffc070, 420, 0.25, true);
      root.addChild(halo, beam, core);
      this.motions.push({ root, parts: [beam, core, halo], x: cx, y: cy, kind: 'beacon', seed: 0 });
    }
    for (const r of town.residents ?? []) {
      const view = new NpcArt(r.look, r.name, undefined, undefined, undefined, { zone: town.id, id: r.id, facing: r.facing });
      view.root.position.set(r.x, r.y); view.root.zIndex = r.y; entities.addChild(view.root); view.showPlate(false);
      this.residents.push({ view, x: r.x, y: r.y, state: { ...still(), x: r.x, y: r.y } });
      const lines = BARKS[r.look];
      if (lines) this.speakers.push({ key: `resident:${r.id}`, x: r.x, y: r.y, height: view.height, lines });
    }
    for (const d of town.villagers ?? []) {
      const preset = RESIDENT_PRESETS[d.look] ?? npcPreset(town.id, d.id, 'resident', d.id);
      const view = new PlayerArt(preset.look, true); view.root.scale.set(preset.scale ?? 1); entities.addChild(view.root);
      const state = still();
      this.walkers.push({ data: d, view, state });
      const lines = BARKS[d.look];
      if (lines) this.speakers.push(Object.defineProperties({ key: `villager:${d.id}`, height: 68 * (preset.scale ?? 1), lines } as unknown as Speaker, { x: { get: () => state.x }, y: { get: () => state.y } }));
    }
  }
  update(dt: number, time: number, cx: number, cy: number, halfWidth: number, halfHeight: number) {
    for (const l of this.lightSprites) {
      l.view.visible = Math.abs(l.data.position[0] - cx) < halfWidth + l.data.radius && Math.abs(l.data.position[1] - cy) < halfHeight + l.data.radius;
      l.view.alpha = 0.12 * (1 + l.data.flicker * Math.sin(time * 7 + l.data.position[0]));
    }
    for (const m of this.motions) {
      m.root.visible = Math.abs(m.x - cx) < halfWidth + (m.kind === 'beacon' ? 900 : 400) && Math.abs(m.y - cy) < halfHeight + (m.kind === 'beacon' ? 700 : 340);
      if (!m.root.visible) continue;
      for (let i = 0; i < m.parts.length; i++) {
        const p = m.parts[i], ph = (time * 0.13 + i / m.parts.length + m.seed * 0.17) % 1;
        switch (m.kind) {
          case 'smoke': p.position.set(Math.sin(time * 0.4 + i) * 15 + ph * 27, -ph * 105); p.scale.set(0.14 + ph * 0.38); p.alpha = Math.sin(ph * Math.PI) * 0.19; break;
          case 'fog': p.position.set((ph - 0.5) * 760, Math.sin(i + time * 0.1) * 50); p.scale.set(2.2, 0.26); p.alpha = Math.sin(ph * Math.PI) * 0.07; break;
          case 'embers': case 'motes': p.position.set(Math.sin(time + i * 2) * 16, -ph * 65); p.alpha = Math.sin(ph * Math.PI) * 0.8; break;
          case 'fireflies': {
            const a = i * 2.39996, r = 60 + (i % 5) * 34;
            p.position.set(Math.cos(a + time * 0.11) * r + Math.sin(time * 0.7 + i) * 18, Math.sin(a + time * 0.09) * r * 0.5 - 20 + Math.cos(time * 0.9 + i * 1.3) * 12);
            p.alpha = Math.max(0, Math.sin(time * (1.1 + (i % 3) * 0.4) + i * 1.7)) * 0.95; break;
          }
          case 'leaves': p.position.set((ph - 0.5) * 550, Math.sin(i * 2 + time * 0.45) * 90); p.rotation = time * 0.3 + i; break;
          case 'birds': p.position.set(Math.sin(time * 0.075 + i) * 360, -150 + Math.cos(time * 0.075 + i) * 100); p.scale.y = Math.sin(time * 8 + i) * 0.65; break;
          case 'flame': p.scale.y = 0.2 + Math.sin(time * 8 + i) * 0.035; break;
          case 'stringlights': p.alpha = 0.62 + Math.sin(time * 1.7 + i * 1.3) * 0.18; break;
          case 'laundry': p.skew.x = Math.sin(time * 1.4 + i * 0.8) * 0.12; break;
          case 'beacon':
            if (i === 0) { const sweep = Math.sin(time * 0.35); p.rotation = Math.PI / 2 + 1.2 * sweep; p.alpha = 0.55 + 0.45 * Math.abs(Math.cos(time * 0.35)); }
            else p.alpha = (i === 1 ? 0.8 : 0.24) * (1 + Math.sin(time * 1.6) * 0.06);
            break;
          case 'puddle': p.scale.set(0.25 + ph); p.alpha = (1 - ph) * 0.35; break;
          default: p.skew.x = Math.sin(time * 1.2 + i) * 0.04;
        }
      }
    }
    for (const r of this.residents) {
      const vis = Math.abs(r.x - cx) < halfWidth + 80 && Math.abs(r.y - cy) < halfHeight + 120;
      r.view.root.visible = vis;
      if (!vis) continue;
      r.state.time = time; r.view.update(dt, r.state);
      r.view.showPlate(Math.hypot(r.x - cx, r.y - cy) < 170);
    }
    for (const w of this.walkers) {
      const s = w.state; townPatrol(w.data.path, w.data.speed, w.data.pause, time, s); s.time = time; s.moving = Math.hypot(s.vx, s.vy) > 1; s.facingLeft = s.vx < 0;
      const root = w.view.root; root.position.set(s.x, s.y); root.zIndex = s.y; root.visible = Math.abs(s.x - cx) < halfWidth + 80 && Math.abs(s.y - cy) < halfHeight + 90;
      if (root.visible) w.view.update(dt, s);
    }
  }
  destroy() {
    for (const m of this.motions) if (!m.root.destroyed) m.root.destroy({ children: true });
    for (const w of this.walkers) w.view.destroy();
    for (const r of this.residents) r.view.destroy();
    this.ground.destroy({ children: true }); this.above.destroy({ children: true });
  }
}
