import { Container, Graphics, Text } from 'pixi.js';
import type { TownData } from '@shared/townTypes';
import { groundBoundary } from '@shared/townGeometry';
import type { MapLayers } from './index';

/** Deliberately flat placeholders for the layout gate. No final town art is implied. */
export function buildTownBlockout(t: TownData): MapLayers {
  const ground = new Container(), g = new Graphics();
  ground.addChild(g);
  g.rect(0, 0, t.size[0] * 64, t.size[1] * 64).fill(0x262a2e);
  for (const f of t.floors) g.poly(f.polygon.flat()).fill(0x565b60);
  for (const e of groundBoundary(t)) g.moveTo(e.ax, e.ay).lineTo(e.bx, e.by).stroke({ width: 2, color: 0x90979d });
  for (const b of t.buildings) {
    g.poly(b.footprint.flat()).fill(0x363c43).stroke({ color: 0x939ba4, width: 2 });
    const label = new Text({ text: b.label, style: { fontFamily: 'Arial', fontSize: 14, fill: 0xcbd0d5 } });
    label.anchor.set(.5); label.position.set(b.footprint.reduce((s, p) => s + p[0], 0) / b.footprint.length, b.footprint.reduce((s, p) => s + p[1], 0) / b.footprint.length);
    ground.addChild(label);
    for (const d of b.doors) g.moveTo(...d.a).lineTo(...d.b).stroke({ width: 3, color: 0x90ba9a });
  }
  for (const b of t.barriers) g.moveTo(...b.a).lineTo(...b.b).stroke({ width: b.radius * 2, color: 0xadb2b8, cap: 'round' });
  for (const p of t.props) g.circle(p.x, p.y, p.radius).fill(0x747b82);
  return { ground, sorted: [], decals: new Container() };
}

export function townCollisionOverlay(t: TownData): Container {
  const root = new Container(), g = new Graphics(); root.addChild(g);
  for (const e of groundBoundary(t)) {
    g.moveTo(e.ax, e.ay).lineTo(e.bx, e.by).stroke({ width: 1.5, color: 0x6affb1 });
    const x = (e.ax + e.bx) / 2, y = (e.ay + e.by) / 2;
    g.moveTo(x, y).lineTo(x + e.nx * 12, y + e.ny * 12).stroke({ width: 1, color: 0x6affb1 });
  }
  for (const b of t.buildings) {
    g.poly(b.footprint.flat()).stroke({ width: 2, color: 0xff7283 });
    for (let i = 1; i < b.baseline.length; i++) g.moveTo(...b.baseline[i - 1]).lineTo(...b.baseline[i]).stroke({ width: 3, color: 0xffc65e });
  }
  for (const n of t.npcs) {
    g.circle(n.x, n.y, n.r).stroke({ width: 2, color: 0xff7283 });
    if (n.interactionRadius) g.circle(n.x, n.y, n.interactionRadius).stroke({ width: 1, color: 0x85a7ff, alpha: .55 });
    g.circle(...n.approach, 16).stroke({ width: 1.5, color: 0x6affb1 });
  }
  for (const b of t.barriers) g.moveTo(...b.a).lineTo(...b.b).stroke({ width: b.radius * 2, color: 0xff7283, alpha: .7, cap: 'round' });
  for (const p of t.props) g.circle(p.x, p.y, p.radius).stroke({ width: 2, color: 0xff7283 });
  return root;
}
