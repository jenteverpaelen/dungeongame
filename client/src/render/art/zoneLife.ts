// Zone life (docs/rework/worlds/DESIGN.md §1): client-only, deterministic, pooled. Birds and crows sit in flocks and lift
// off when the hero comes close, butterflies and moths flutter, fish jump, hares and deer bolt, bats and rats scurry.
// Residents, walkers, smoke, embers and light flicker reuse the town's TownLife through a small adapter.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { glowSprite } from './fx';
import { nameLabel } from './npcs';
import type { AdventureData } from '@shared/adventureTypes';
import type { TownData } from '@shared/townTypes';
import { ellipse, INK, line, poly, type Paint } from './townKit';

type Critter = { kind: string; x: number; y: number; hx: number; hy: number; view: Container; phase: number; state: number; t: number; vx: number; vy: number; r: number };
const rnd = (a: number, b: number) => { let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

function bird(color: number, size = 1): Container {
  const c = new Container();
  const body = new Graphics().ellipse(0, -4, 6 * size, 3.6 * size).fill(color).stroke({ color: 0x14100e, width: 1 })
    .circle(5 * size, -7 * size, 2.8 * size).fill(color).stroke({ color: 0x14100e, width: 1 }).poly([7.5 * size, -7 * size, 10.5 * size, -6 * size, 7.5 * size, -5.6 * size]).fill(0xd8a040);
  const wing = new Graphics().moveTo(-6 * size, -4).quadraticCurveTo(-1, -14 * size, 4 * size, -5).fill(color).stroke({ color: 0x14100e, width: 1 });
  c.addChild(body, wing); (c as Container & { wing?: Graphics }).wing = wing; return c;
}
function butterfly(color: number): Container {
  const g = new Graphics().ellipse(-3, 0, 3.4, 2.4).fill(color).ellipse(3, 0, 3.4, 2.4).fill(color).rect(-0.6, -2, 1.2, 4).fill(0x2a2420); const c = new Container(); c.addChild(g); return c;
}
function quad(kind: 'hare' | 'deer' | 'rat'): Container {
  const g = new Graphics(), col = kind === 'deer' ? 0x9a6a3e : kind === 'hare' ? 0x9a8a72 : 0x5a5250, s = kind === 'deer' ? 1.6 : kind === 'hare' ? 0.8 : 0.55;
  g.ellipse(0, -10 * s, 12 * s, 6.5 * s).fill(col).stroke({ color: 0x14100e, width: 1.2 });
  g.circle(11 * s, -15 * s, 4.6 * s).fill(col).stroke({ color: 0x14100e, width: 1.2 });
  if (kind === 'hare') g.ellipse(11 * s, -24 * s, 1.6 * s, 6 * s).fill(col).stroke({ color: 0x14100e, width: 1 });
  if (kind === 'deer') { g.moveTo(10 * s, -19 * s).lineTo(8 * s, -27 * s).lineTo(5 * s, -30 * s).moveTo(8 * s, -27 * s).lineTo(11 * s, -31 * s).stroke({ color: 0x5a4030, width: 1.6 }); for (const x of [-8, -4, 5, 9]) g.rect(x * s, -6 * s, 2 * s, 6 * s).fill(0x5a4030); }
  if (kind === 'rat') g.moveTo(-12 * s, -9 * s).quadraticCurveTo(-22 * s, -6 * s, -26 * s, -12 * s).stroke({ color: 0x8a7a72, width: 1.4 });
  const c = new Container(); c.addChild(g); return c;
}
/** A sitting frog (reed beds, fens): squats, throat pulses, hops away when the hero comes close. */
function frog(): Container {
  const g = new Graphics()
    .ellipse(0, -5, 8, 5).fill(0x5a7a34).stroke({ color: 0x14100e, width: 1 })
    .ellipse(-6, -2, 3.4, 2.4).fill(0x4a6a2c).stroke({ color: 0x14100e, width: 0.8 }).ellipse(6, -2, 3.4, 2.4).fill(0x4a6a2c).stroke({ color: 0x14100e, width: 0.8 })
    .circle(-3, -9, 2.2).fill(0xd8d070).stroke({ color: 0x14100e, width: 0.8 }).circle(3, -9, 2.2).fill(0xd8d070).stroke({ color: 0x14100e, width: 0.8 })
    .circle(-3, -9, 0.9).fill(0x14100e).circle(3, -9, 0.9).fill(0x14100e);
  const c = new Container(); c.addChild(g); return c;
}
function fishArc(): Container { const g = new Graphics().ellipse(0, 0, 7, 3).fill(0xb8c8c8).stroke({ color: 0x1a2a2a, width: 1 }).poly([-7, 0, -11, -3, -11, 3]).fill(0xb8c8c8); const c = new Container(); c.addChild(g); return c; }
function bat(): Container { const g = new Graphics().moveTo(-10, 0).quadraticCurveTo(-5, -6, 0, -1).quadraticCurveTo(5, -6, 10, 0).quadraticCurveTo(5, -2, 0, 2).quadraticCurveTo(-5, -2, -10, 0).fill(0x1a1618); const c = new Container(); c.addChild(g); return c; }

export class ZoneCritters {
  readonly ground = new Container();
  readonly above = new Container();
  private list: Critter[] = [];
  constructor(a: AdventureData) {
    let seed = 1;
    for (const grp of a.paint?.critters ?? []) for (let i = 0; i < grp.n; i++) {
      seed++;
      const ang = rnd(seed, 1) * Math.PI * 2, d = Math.sqrt(rnd(seed, 2)) * grp.r, x = grp.x + Math.cos(ang) * d, y = grp.y + Math.sin(ang) * d * 0.6;
      let view: Container;
      switch (grp.kind) {
        case 'birds': view = bird([0x8a5a3a, 0x6a6a72, 0xb87a4a][i % 3], 0.9); break;
        case 'crows': view = bird(0x22201e, 1.1); break;
        case 'gulls': view = bird(0xeef0ec, 1.2); break;
        case 'butterflies': view = butterfly([0xf2c94c, 0xe98ab4, 0xf4efe2, 0x9ad8ff][i % 4]); break;
        case 'moths': view = butterfly(0xd8c8a8); break;
        case 'fish': view = fishArc(); break;
        case 'bats': view = bat(); break;
        case 'rats': view = quad('rat'); break;
        case 'hares': view = quad('hare'); break;
        case 'deer': view = quad('deer'); break;
        case 'frogs': view = frog(); break;
        default: view = bird(0x6a6a72); break;
      }
      view.position.set(x, y);
      (grp.kind === 'butterflies' || grp.kind === 'moths' || grp.kind === 'bats' || grp.kind === 'fish' ? this.above : this.ground).addChild(view);
      this.list.push({ kind: grp.kind, x, y, hx: x, hy: y, view, phase: rnd(seed, 3) * 6.28, state: 0, t: 0, vx: 0, vy: 0, r: grp.r });
    }
  }
  update(dt: number, time: number, cx: number, cy: number, halfW: number, halfH: number, hx: number, hy: number) {
    const s = dt / 1000;
    for (const c of this.list) {
      const vis = Math.abs(c.hx - cx) < halfW + 300 && Math.abs(c.hy - cy) < halfH + 300;
      c.view.visible = vis; if (!vis) { if (c.state === 1 && time - c.t > 12) { c.state = 0; c.x = c.hx; c.y = c.hy; } continue; }
      const near = Math.hypot(c.x - hx, c.y - hy) < (c.kind === 'deer' ? 330 : 230);
      switch (c.kind) {
        case 'birds': case 'crows': case 'gulls': {
          const wing = (c.view as Container & { wing?: Graphics }).wing;
          if (c.state === 0) {
            if (near) { c.state = 1; c.t = time; const a = Math.atan2(c.y - hy, c.x - hx) + (rnd(c.hx, c.hy) - 0.5); c.vx = Math.cos(a) * 260; c.vy = -180 - rnd(c.hy, c.hx) * 120; }
            else { const hop = Math.max(0, Math.sin(time * 3 + c.phase * 5)) > 0.97; c.view.y = c.y - (hop ? 4 : 0); c.view.scale.x = Math.sin(time * 0.3 + c.phase) > 0 ? 1 : -1; if (wing) wing.scale.y = 1; }
          } else {
            c.x += c.vx * s; c.y += c.vy * s; c.vy -= 20 * s; c.view.position.set(c.x, c.y); c.view.scale.x = c.vx >= 0 ? 1 : -1;
            if (wing) wing.scale.y = Math.sin(time * 26 + c.phase) > 0 ? 1 : -0.8;
            if (time - c.t > 14 && Math.hypot(c.hx - hx, c.hy - hy) > 600) { c.state = 0; c.x = c.hx; c.y = c.hy; c.view.position.set(c.x, c.y); }
          }
          break;
        }
        case 'butterflies': case 'moths': {
          const a = time * (0.6 + rnd(c.hx, 7) * 0.5) + c.phase;
          c.view.position.set(c.hx + Math.cos(a) * 40 + Math.sin(a * 2.3) * 14, c.hy - 26 + Math.sin(a * 1.3) * 18); c.view.scale.x = 0.4 + Math.abs(Math.sin(time * 14 + c.phase)) * 0.6; break;
        }
        case 'bats': { const a = time * 1.4 + c.phase; c.view.position.set(c.hx + Math.cos(a) * c.r * 0.4, c.hy - 120 + Math.sin(a * 1.7) * 30); c.view.scale.y = Math.sin(time * 18 + c.phase) > 0 ? 1 : 0.4; break; }
        case 'fish': {
          const cyc = (time * 0.18 + c.phase) % 1, jumping = cyc < 0.12;
          c.view.visible = jumping; if (jumping) { const t = cyc / 0.12; c.view.position.set(c.hx + (t - 0.5) * 50, c.hy - Math.sin(t * Math.PI) * 34); c.view.rotation = (t - 0.5) * 1.6; }
          break;
        }
        case 'frogs': {
          if (near && c.state === 0) { c.state = 1; c.t = time; const a = Math.atan2(c.y - hy, c.x - hx); c.vx = Math.cos(a) * 160; c.vy = Math.sin(a) * 90; }
          if (c.state === 1) { const t = (time - c.t) / 0.45; c.view.position.set(c.x + c.vx * Math.min(t, 1) * 0.45, c.y + c.vy * Math.min(t, 1) * 0.45 - Math.sin(Math.min(t, 1) * Math.PI) * 22); if (t >= 1) { c.state = 2; c.t = time; c.view.visible = false; } }
          else if (c.state === 2) { c.view.visible = false; if (time - c.t > 15 && Math.hypot(c.hx - hx, c.hy - hy) > 500) { c.state = 0; c.view.visible = true; c.view.position.set(c.hx, c.hy); } }
          else { c.view.position.set(c.x, c.y); c.view.scale.y = 1 + Math.max(0, Math.sin(time * 5 + c.phase)) * 0.08; }
          break;
        }
        case 'hares': case 'deer': case 'rats': {
          if (near && c.state === 0) { c.state = 1; c.t = time; const a = Math.atan2(c.y - hy, c.x - hx); c.vx = Math.cos(a) * (c.kind === 'deer' ? 300 : 240); c.vy = Math.sin(a) * 170; }
          if (c.state === 1) { c.x += c.vx * s; c.y += c.vy * s; c.view.position.set(c.x, c.y - Math.abs(Math.sin(time * (c.kind === 'rats' ? 30 : 12))) * (c.kind === 'rats' ? 1 : 6)); c.view.scale.x = c.vx >= 0 ? 1 : -1; c.view.alpha = Math.max(0, 1 - (time - c.t) / 2.5); if (time - c.t > 2.5) { c.state = 2; c.t = time; } }
          else if (c.state === 2) { if (time - c.t > 18 && Math.hypot(c.hx - hx, c.hy - hy) > 700) { c.state = 0; c.x = c.hx; c.y = c.hy; c.view.alpha = 1; c.view.position.set(c.x, c.y); } }
          else { c.view.position.set(c.x, c.y); if (c.kind === 'rats') { c.x = c.hx + Math.sin(time * 0.8 + c.phase) * 40; } }
          break;
        }
      }
      c.view.zIndex = c.y;
    }
  }
  destroy() { this.ground.destroy({ children: true }); this.above.destroy({ children: true }); this.list = []; }
}

/** The zone's lights, emitters, residents and walkers in the shape TownLife reads (visual only). */
export function zoneAsTown(a: AdventureData): TownData {
  const p = a.paint!;
  return {
    id: a.id, lights: p.lights.map((l, i) => ({ id: `zl${i}`, position: [l.x, l.y], color: l.color, radius: l.radius, flicker: l.flicker ?? 0.12 })),
    emitters: p.emitters.map((e, i) => ({ id: `ze${i}`, position: [e.x, e.y], kind: e.kind, rate: e.rate })),
    props: [], decor: [], buildings: [], residents: p.residents, villagers: p.walkers.map((w) => ({ id: w.id, look: w.look, path: w.path, speed: w.speed, pause: w.pause })),
  } as unknown as TownData;
}

/** A shrine or cache: baked once, glows while ready, dims after use (server decides; the client only shows it). */
export function poiArt(kind: 'shrine' | 'cache', shrine?: string): (c: Paint) => void {
  if (kind === 'cache') return (c) => {
    ellipse(c, 2, 2, 26, 8, 'rgba(10,8,12,0.35)');
    poly(c, [[-24, 0], [-24, -24], [24, -24], [24, 0]], '#6a4a30', INK, 1.4); poly(c, [[-26, -24], [-22, -36], [22, -36], [26, -24]], '#7a5a3a', INK, 1.4);
    for (const x of [-16, 16]) line(c, [[x, -36], [x, 0]], '#3a3c3e', 4); rrectLock(c);
  };
  const glow = shrine === 'empowered' ? '#ff9a5a' : shrine === 'frenzied' ? '#7ad0ff' : '#c8a0ff';
  return (c) => {
    ellipse(c, 0, 2, 40, 13, 'rgba(10,8,12,0.35)');
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ellipse(c, Math.cos(a) * 34, Math.sin(a) * 11, 6, 4, '#7a756a', INK, 1); }
    poly(c, [[-14, 0], [-17, -60], [-6, -82], [8, -80], [17, -58], [14, 0]], '#8a857a', INK, 1.5);
    poly(c, [[-12, -4], [-14, -58], [-5, -76], [-2, -40]], '#9a958a');
    for (let k = 0; k < 3; k++) line(c, [[-6, -24 - k * 16], [0, -30 - k * 16], [6, -24 - k * 16]], glow, 2.2);
    ellipse(c, 0, -88, 6, 6, glow, INK, 1);
  };
}
function rrectLock(c: Paint) { c.fillStyle = '#d8b54a'; c.fillRect(-4, -26, 8, 9); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(-4, -26, 8, 9); }

/** Scene view for a point of interest (EntityView contract; never hit, never dies). */
export class PoiView {
  readonly root = new Container();
  readonly height: number;
  private glow: Container;
  private readyAt = 0;
  private plate: import('pixi.js').Text;
  constructor(private poi: NonNullable<AdventureData['pois']>[number]) {
    const draw = poiArt(poi.kind, poi.shrine), cv = document.createElement('canvas'), D = 1.6, w = 96, h = 120;
    cv.width = w * D; cv.height = h * D; const c = cv.getContext('2d')!; c.setTransform(D, 0, 0, D, (w / 2) * D, (h - 12) * D); draw(c);
    const tex = Texture.from(cv), sp = new Sprite(tex); sp.scale.set(1 / D); sp.position.set(-w / 2, -(h - 12)); this.root.addChild(sp);
    const color = poi.kind === 'cache' ? 0xffd27a : poi.shrine === 'empowered' ? 0xff9a5a : poi.shrine === 'frenzied' ? 0x7ad0ff : 0xc8a0ff;
    this.glow = glowSprite(color, poi.kind === 'cache' ? 90 : 150, 0.5, true); this.glow.position.set(0, poi.kind === 'cache' ? -24 : -60); this.root.addChild(this.glow);
    this.height = poi.kind === 'cache' ? 46 : 96;
    this.plate = nameLabel(poi.name, -this.height - 14, 0xf2e8d5); this.plate.visible = false; this.root.addChild(this.plate);
    sp.on('destroyed', () => tex.destroy(true));
  }
  /** Server answered: show the used look until the cooldown it reported ends. */
  setUsed(readyInMs: number) { this.readyAt = performance.now() + readyInMs; }
  update(_dt: number, s: { time: number }) {
    const ready = performance.now() >= this.readyAt;
    this.glow.alpha = ready ? 0.45 + Math.sin(s.time * 2.4 + this.poi.x) * 0.12 : 0.06;
    this.plate.visible = false;
  }
  showPlate(v: boolean) { this.plate.visible = v; }
  hit() { /* inert */ }
  die(_e: number, done: () => void) { done(); }
  destroy() { this.root.destroy({ children: true }); }
}
