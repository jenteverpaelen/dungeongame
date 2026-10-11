// Bespoke legendaries (ART-DIRECTION.md §5): one-off objects that keep their identity at every level and grow in three
// stages (early G0–G2, mid G3–G4, late G5–G6), the way Darkest Dungeon's upgrades add craft to the same weapon (DD1).
// Each is a real object turned into a weapon, read from the item's own name and flavour (shared/src/data/powers), in
// the item's own colours. Light is their core, not a halo (R6); the icon backdrop is the only halo they get.
import { detail, disc, float, glowLine, glowSpot, lash, pole, qpts, ribbon, ring, slab, bevel, type K } from './kit';
import { light, mix, shade } from '../util';
import { OUT } from '../draw';

export interface LegendaryArt {
  family: 'blade' | 'axe' | 'bow' | 'staff' | 'wand';
  idea: string;
  draw: (k: K, stage: 0 | 1 | 2) => void;
}

// ── Bloodwake (sword): "The blade weeps for every wound it opens." A one-sided flamberge: the edge is a wake of waves
//    trailing down the blade, a blood gutter runs the spine and drips from every trough (flamberge: a real wavy-edged
//    sword form [K]). Colours from the item: crimson 0x9e1b1b, near-black 0x3a0d0d, light 0xff3b3b.
const BW = { steel: 0x7a3c3e, dark: 0x3a0d0d, red: 0x9e1b1b, glow: 0xff3b3b, edge: 0xf0d4cc, bone: 0xd8c8b4, gold: 0xc89a4e };
function bloodwake(k: K, st: 0 | 1 | 2): void {
  const waves = 2 + st, base = -6.4, top = -31.4 - st * 1.8, A = 1.25 + st * 0.15;
  // the edge (+x): a sine wake that tapers into the point; the spine (-x) straight
  const edge: number[] = [], troughs: [number, number][] = [];
  const N = 44;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = base + (top - base) * t;
    const taper = t < 0.78 ? 1 : 1 - (t - 0.78) / 0.22;
    const ph = t * waves * Math.PI * 2 / 0.78;
    const x = (3.6 + (t < 0.78 ? A * Math.sin(ph - Math.PI / 2) : 0)) * taper + (1 - taper) * -0.6;
    edge.push(x, y);
  }
  // troughs: the wave is back in where cos(phase) = 1, once per wave
  for (let w = 1; w <= waves; w++) { const t = (w * 0.78) / waves; troughs.push([3.6 - A, base + (top - base) * t]); }
  const out = [-2.6, base, ...edge, -2.4, top + 3.6];
  const lit = [-2.6, base, 0.6, base, 0.6, top + 4.4, -2.4, top + 3.6];
  bevel(k, out, lit, BW.steel, { edgeCol: BW.edge, ridge: [0.6, base - 0.5, 0.6, top + 4.6] });
  if (k.pass === 'paint') detail(k, edge.map((v, i) => (i % 2 === 0 ? v - 0.75 : v)).slice(4, -6), BW.edge, 0.7, 0.9);
  // the blood gutter along the spine: a narrow channel, lit only in its lower two thirds
  glowLine(k, [-1.2, base - 1.4, -1.2, base + (top - base) * 0.68], 0.65, BW.glow, true, BW.dark);
  for (const [x, y] of troughs) slab(k, [x - 0.65, y - 0.3, x + 0.55, y - 0.3, x + 0.65, y + 1.6, x, y + 2.7, x - 0.65, y + 1.6], BW.red, { smooth: true, line: 0.6 });
  if (st === 2) for (let i = 0; i < 2; i++) float(k, troughs[i][0] + 0.4, troughs[i][1] + 4.6, (kk) => slab(kk, [-0.5, -0.8, 0.5, -0.8, 0.6, 0.6, 0, 1.4, -0.6, 0.6], BW.red, { smooth: true, line: 0.5 }), { bob: 1.8, phase: i * 2.2, glow: BW.glow, glowR: 2.5, deco: true });
  // guard: the wake's curl, swept up on the edge side (bigger with each stage)
  const g = 1 + st * 0.18;
  slab(k, [-5.0 * g, -5.2, 2.4, -5.6, 5.4 * g, -7.6, 7.2 * g, -10.8 * g, 6.0 * g, -11.8 * g, 4.4 * g, -9.2, 2.0, -7.4, -4.4 * g, -7.0, -6.2 * g, -5.8], BW.dark, { smooth: true, hi: [[-4.4, -6.2, 2.0, -6.6]] });
  if (st >= 1) disc(k, 6.6 * g, -11.2 * g, 1.0, 1.0, BW.gold, { line: 0.6 });
  slab(k, [-1.6, -5.0, 1.8, -5.0, 1.8, 4.0, -1.6, 4.0], BW.dark, { line: 0.8 });
  lash(k, 0.1, -4.6, 3.8, 3.4, BW.red, { gap: 1.3, slant: 0.9, bulge: 0.2 });
  slab(k, [-2.2, 4.0, 2.4, 4.0, 2.0, 6.8, 0, 8.4, -1.8, 6.8], BW.bone, { smooth: true, hi: [[-1.4, 4.8, -0.2, 7.4]] });
  if (st >= 1) glowSpot(k, 0.1, 5.8, 0.7 + st * 0.2, BW.glow, true);
  k.anchor = { x: 0, y: -6.2, r: 3.2 };
}

// ── Rainspindle (bow): "The string remembers every arrow still in the sky." The grip is a drop spindle — shaft, a
//    whorl, a cop of wound thread (ART-REFERENCES RW5); the limbs end in spindle hooks; a second thread on the back
//    carries glass rain-drops, one more per stage (rig-safe: it is part of the bow, not the string). Colours from the
//    item: slate blue 0x384c59, pale 0xaacacb, light 0xb8e7f0.
const RS = { wood: 0x384c59, wood2: 0x58707e, pale: 0xaacacb, glow: 0xb8e7f0, thread: 0xe4ece8, brass: 0xc8a25a };
function rainspindle(k: K, st: 0 | 1 | 2): void {
  const limbs = [qpts(-2.4, -21.6, 10.6, -14.6, 3.0, -4.8, 14), qpts(-2.4, 21.6, 10.6, 14.6, 3.0, 4.8, 14)];
  for (const cl of limbs) {
    const n = cl.length / 2, ws: number[] = []; for (let i = 0; i < n; i++) ws.push(1.3 + (i / (n - 1)) * 2.0);
    slab(k, ribbon(cl, ws), RS.wood, { line: 0, flat: true });
    if (k.pass === 'paint') {
      slab(k, ribbon(cl, ws, 0, -1, -0.1), RS.wood2, { line: 0, flat: true, inner: true });
      detail(k, ribbon(cl, ws, 0, -0.7, -0.6).slice(0, 24), light(RS.pale, 0.3), 0.5, 0.9);
      k.c.poly(ribbon(cl, ws), true).stroke({ width: 0.9, color: OUT, join: 'round' });
    }
  }
  // spindle hooks at the tips
  for (const s of [-1, 1]) { pole(k, [-2.4, s * 21.6, -3.6, s * 23.4, -2.2, s * 24.4], 0.8, RS.brass, { curve: true }); }
  // the spindle: shaft through the grip, a cop of thread, the whorl
  pole(k, [3.2, -7.4, 3.2, 7.6], 2.2, mix(RS.wood2, RS.pale, 0.3));
  slab(k, [1.0, 0.8, 5.4, 0.8, 6.2, 3.2, 5.0, 6.0, 1.4, 6.0, 0.2, 3.2], RS.thread, { smooth: true, hi: [[1.6, 2.0, 4.6, 1.6]] });
  if (k.pass === 'paint') for (let y = 1.6; y < 5.8; y += 0.9) detail(k, [0.8, y, 5.6, y - 0.5], shade(RS.thread, 0.3), 0.4, 0.9);
  disc(k, 3.2, -1.2, 5.6 + st * 0.6, 2.0, RS.pale, { line: 0.8 });
  if (k.pass === 'paint') k.c.ellipse(3.2, -1.6, 4.4 + st * 0.5, 1.0).fill(light(RS.pale, 0.35));
  if (k.pass === 'paint') for (let i = 0; i < 4 + st * 2; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / (4 + st * 2)); k.c.circle(3.2 + Math.cos(a) * (5.0 + st * 0.6), -1.2 + Math.sin(a) * 1.4 + 0.1, 0.42).fill(shade(RS.wood, 0.3)); }
  if (st >= 1) glowLine(k, [3.2 - 4.4 - st * 0.5, -0.8, 3.2 + 4.4 + st * 0.5, -0.8], 0.45, RS.glow, true, RS.wood);
  disc(k, 3.2, -8.0, 1.0, 1.0, RS.brass, { line: 0.6 });
  // the rain thread on the back of the upper limb, carrying drops
  const back = qpts(-0.8, -19.8, 12.4, -12.8, 6.4, -2.4, 10);
  pole(k, back, 0.45, RS.thread, { flat: true, curve: false });
  const drops = 2 + st * 2;
  for (let i = 0; i < drops; i++) {
    const t = 0.15 + (i / Math.max(1, drops - 1)) * 0.7, j = Math.round(t * 10), x = back[j * 2], y = back[j * 2 + 1];
    slab(k, [x - 0.9, y + 0.1, x + 0.9, y + 0.1, x + 0.8, y + 1.8, x, y + 3.0, x - 0.8, y + 1.8], RS.glow, { smooth: true, line: 0.55 });
    if (k.pass === 'paint') k.c.circle(x - 0.25, y + 0.9, 0.3).fill(0xffffff);
    if (st === 2 && i % 2 === 0) glowSpot(k, x, y + 1.3, 0.7, RS.glow, true);
  }
  if (!k.rig) pole(k, [-2.4, -21.4, -2.4, 21.4], 0.7, RS.thread, { flat: true });
  k.anchor = { x: 3.2, y: -1.2, r: 3 };
}

export const LEGENDARY_ART: Record<string, LegendaryArt> = {
  bloodwake: { family: 'blade', idea: 'a one-sided flamberge whose waves drip from a blood gutter', draw: bloodwake },
  rainspindle: { family: 'bow', idea: 'a drop spindle for a grip, rain-drops threaded on its back', draw: rainspindle },
};
