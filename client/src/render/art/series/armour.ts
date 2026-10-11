// Armour in the maker series (docs/rework/gear/ART-DIRECTION.md §6): armour keeps the slot silhouettes of the rig
// (heroParts.ts, gear.ts) and takes, per series, its makers' MATERIALS (palette by material class), their MOTIF as a
// fitting (a badge where a buckle, brooch or brow jewel sits; a band where a trim runs) and one signature piece on helm
// and pauldron that changes the silhouette at hero scale (goggles, a pennant, a graduated halo, a hovering slab, a glass
// dome …). The craft ladder is the weapons' one: normal plain and, early, worn; magic finished with the maker's mark and
// the blue accent; rare the extra fittings, the gold accent and the series' light (painted, baked into the hero sheet —
// no additive sprite, no per-frame cost). Kindled / Fabled add the grade accents; legendaries / Sets keep their own
// palette and carry their motif in the series' bezel.
//
// Everything here is drawn once per look into the hero sheet and the icons: no filters, no new textures per item.
import type { ItemLook } from '@shared/types';
import { OUT, ball, blob, crease, fill, gem, inSilhouette, poly, rbox, spark, star, stitch, wash, type Ctx } from '../draw';
import { FABLED_LIGHT, TOP_COLORS, itemStyle, setArmourSeries, type ArtLook, type ItemStyle } from '../gearStyle';
import { clamp, light, mix, shade } from '../util';
import { emblem } from '../gearDecor';

const D2R = Math.PI / 180;

export interface ArmourSeries {
  name: string;
  /** Cloth (two dyes, by look variant), leather, the hard material of plate shapes, fittings, accent and light (0 = none). */
  cloth: number; cloth2: number; leather: number; metal: number; trim: number; accent: number; light: number;
}

/** Palettes from the series' weapon palettes and §6 (materials · fittings · light). [P] where §6 names no colour. */
export const ARMOUR_SERIES: readonly ArmourSeries[] = [
  // Millwright: canvas aprons and hemp, hemp-laced leather, rust-warm strap iron; mill red; no light
  { name: 'Millwright', cloth: 0xc9b994, cloth2: 0xb59f74, leather: 0x7a5230, metal: 0x86796a, trim: 0x5e6268, accent: 0xb8432e, light: 0 },
  // Kilnfolk: soot-dark cloth and leather, fired-clay plates, fire-scaled iron; celadon glaze; an ember (rare)
  { name: 'Kilnfolk', cloth: 0x4a3c3a, cloth2: 0x7a6450, leather: 0x4e3a30, metal: 0xb3603c, trim: 0x403a3a, accent: 0x86b29c, light: 0xff8a3a },
  // Brinekeeper: yellow oilskin, bleached cloth, oiled leather, salt-bleached hide plates, tar fittings; brine pink; sea-glass (rare)
  { name: 'Brinekeeper', cloth: 0xe2b22e, cloth2: 0xcdc3ac, leather: 0x9a7b4a, metal: 0xbdb39c, trim: 0x2c2b31, accent: 0xec9fad, light: 0x9ff0e0 },
  // Warden: crimson tabards, white enamel, oak leather, bright steel, brass; the beacon lamp (rare)
  { name: 'Warden', cloth: 0xb3242c, cloth2: 0xeee6d6, leather: 0x5a4434, metal: 0xbac4cc, trim: 0xcaa14e, accent: 0xeee6d6, light: 0xffd27a },
  // Array: lilac shawls, blue cloth, blued star-iron, copper (verdigris when plain); the dial; the lilac signal (rare)
  { name: 'Array', cloth: 0xc4b0e2, cloth2: 0x5a6c94, leather: 0x2e3a5c, metal: 0x6a7ca4, trim: 0xc47a4c, accent: 0xe8e0c8, light: 0xc2a8ff },
  // Faultstone: bone-wrapped cloth, slate leather and plates; the fracture tone; the runes (rare)
  { name: 'Faultstone', cloth: 0xdcd3c2, cloth2: 0x9a8fa6, leather: 0x3e3648, metal: 0x7c708a, trim: 0xdcd3c2, accent: 0xb0a4ba, light: 0xff4a9a },
  // Reliquary: dark glass-teal and bronze-brown cloth [P], bronze leather and plates, gold; glass; the relic (rare)
  { name: 'Reliquary', cloth: 0x3c5a58, cloth2: 0x5a3a2a, leather: 0x7a4a22, metal: 0xb4783a, trim: 0xe2c070, accent: 0x5fa8a2, light: 0x96ffec },
];

const CLOTH = new Set(['robe', 'tunic', 'cloth', 'sash', 'mantle', 'wizard_hat', 'hood', 'wraps', 'shoes']);
const JEWEL = new Set(['circlet', 'amulet', 'ring']);
const RARITY_ACCENT = [0, 0x5a7dff, 0xd4b13a];

/** What a fitting needs from the item: series, craft 0..2, lit (the series light shows), accent and grade. */
export interface Fit { S: ArmourSeries; gen: number; q: number; lit: boolean; acc: number; top: number; special: boolean; motif: ItemStyle['motif']; set?: ItemStyle['set']; seed: number }

export function fitOf(l: ItemLook | undefined): Fit | null {
  const s = itemStyle(l);
  if (!s || !l) return null;
  const q = s.special ? 2 : Math.min(2, s.rar);
  const S = ARMOUR_SERIES[s.gen];
  const acc = s.special ? (s.set?.main ?? (l.glow || s.light)) : RARITY_ACCENT[q];
  return { S, gen: s.gen, q, lit: !!S.light && (q >= 2 || s.top > 0), acc, top: s.top, special: s.special, motif: s.motif, set: s.set, seed: l.variant };
}

/** The colours of an armour look in its series (the hook artLook calls while the armour art switch is on). */
function seriesLook(l: ArtLook, s: ItemStyle, metal: boolean): ArtLook {
  const S = ARMOUR_SERIES[s.gen];
  const mat = metal ? S.metal : CLOTH.has(l.shape) ? (l.variant % 2 ? S.cloth2 : S.cloth) : JEWEL.has(l.shape) ? S.trim : S.leather;
  // a hint of the stored colour keeps two pieces of one series apart; legendaries / Sets keep their own palette
  let primary = s.special ? mix(l.primary, mat, 0.3) : mix(mat, l.primary, 0.1);
  if (!s.special && s.rar === 0 && s.gen <= 2) primary = mix(primary, 0x6a5e50, 0.16); // early plain pieces are worn
  const trimCol = s.gen === 4 && s.rar === 0 && !s.special ? 0x5f9f8a : S.trim; // plain Array copper has gone to verdigris
  const secondary = s.special ? mix(l.secondary, S.trim, 0.35) : s.rar === 0 ? shade(trimCol, 0.08) : s.rar === 1 ? trimCol : light(trimCol, 0.1);
  return { ...l, primary, secondary };
}

/** Switch the armour art to the maker series (called once at start by game/weaponArtPreview.ts). */
export function registerSeriesArmour(): void { setArmourSeries(seriesLook); }

// ─────────────────────────── light (painted) ───────────────────────────

/** A lit spot: the series light with a white core, a soft ring around (painted into the bake, no additive sprite). */
function litSpot(c: Ctx, x: number, y: number, r: number, col: number): void {
  if (inSilhouette()) { c.circle(x, y, r); fill(c, 0xffffff); return; }
  c.circle(x, y, r * 1.9).fill({ color: col, alpha: 0.22 });
  c.circle(x, y, r).fill(light(col, 0.15));
  c.circle(x - r * 0.25, y - r * 0.25, r * 0.5).fill(light(col, 0.8));
}
/** A lit line along a path (rims, channels). */
function litLine(c: Ctx, pts: number[], w: number, col: number): void {
  if (inSilhouette()) return;
  crease(c, pts, w + 1.8, col, 0.25);
  crease(c, pts, w, light(col, 0.25), 1);
  crease(c, pts, Math.max(0.4, w * 0.4), light(col, 0.85), 1);
}

// ─────────────────────────── the series badge (motif as a fitting) ───────────────────────────

/** The series' motif as a fitting at (x, y), radius r: buckle, brooch, brow jewel, knee boss. */
export function badge(c: Ctx, f: Fit, x: number, y: number, r: number): void {
  const { S, q } = f;
  switch (f.gen) {
    case 0: { // Millwright: a stamped mill wheel in strap iron (red-painted hub when restored)
      ball(c, x, y, r, r, S.metal, { ow: 1.2, hl: 0.3 });
      if (!inSilhouette()) {
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25).lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); }
        c.stroke({ width: Math.max(0.5, r * 0.18), color: shade(S.metal, 0.45) });
        c.circle(x, y, r * 0.82).stroke({ width: Math.max(0.5, r * 0.16), color: shade(S.metal, 0.45) });
      }
      c.rect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56); fill(c, q >= 2 ? S.accent : q === 1 ? f.acc : shade(S.metal, 0.3));
      break;
    }
    case 1: { // Kilnfolk: a terracotta disc, glaze-capped, the kiln cone stamped in; an ember brooch when lit
      ball(c, x, y, r, r, S.metal, { ow: 1.2, hl: 0.25 });
      if (!inSilhouette()) {
        c.moveTo(x - r * 0.95, y - r * 0.1).quadraticCurveTo(x, y - r * 0.55, x + r * 0.95, y - r * 0.1).arc(x, y, r * 0.95, -0.1, Math.PI + 0.1, true).closePath().fill(q === 0 ? 0x5c2a1c : S.accent);
        c.poly([x - r * 0.35, y + r * 0.55, x + r * 0.3, y + r * 0.55, x + r * 0.42, y - r * 0.05], true).fill(shade(S.metal, 0.45));
      }
      if (f.lit) litSpot(c, x + r * 0.05, y + r * 0.12, r * 0.42, S.light);
      else if (q === 1) gem(c, x, y + r * 0.15, r * 0.36, f.acc, 0.8);
      break;
    }
    case 2: { // Brinekeeper: salt cubes grown on a tarred whipping knot; a sea-glass toggle when lit
      ball(c, x, y + r * 0.2, r * 0.8, r * 0.7, S.trim, { ow: 1.1, hl: 0.2 });
      const n = q === 0 ? 2 : q === 1 ? 3 : 4;
      const spots = [[-0.45, -0.25, 0.55], [0.35, -0.35, 0.5], [0, -0.85, 0.45], [0.55, 0.25, 0.4]];
      for (let i = n - 1; i >= 0; i--) {
        const [dx, dy, k] = spots[i];
        const col = q >= 1 && i === 1 ? mix(f.acc, 0xf3efe8, 0.2) : i % 2 ? 0xf3efe8 : mix(0xf3efe8, S.accent, q >= 2 ? 0.7 : 0.4);
        cubeAt(c, x + dx * r, y + dy * r, r * k, col);
      }
      if (f.lit) litSpot(c, x + r * 0.1, y + r * 0.35, r * 0.34, S.light);
      break;
    }
    case 3: { // Warden: a white enamel shield badge, the key ward cut in crimson; a lamp lens when lit
      const pts = [x - r * 0.9, y - r * 0.85, x + r * 0.9, y - r * 0.85, x + r * 0.9, y + r * 0.1, x, y + r, x - r * 0.9, y + r * 0.1];
      poly(c, pts, S.trim, { ow: 1.2 });
      poly(c, pts.map((v, i) => (i % 2 === 0 ? x + (v - x) * 0.72 : y + (v - y) * 0.72)), q === 0 ? shade(0xeee6d6, 0.15) : 0xeee6d6, { ow: 0 });
      if (!inSilhouette()) c.poly([x - r * 0.3, y - r * 0.45, x + r * 0.3, y - r * 0.45, x + r * 0.3, y, x, y, x, y + r * 0.35, x - r * 0.3, y + r * 0.35], true).fill(q === 0 ? shade(0xb3242c, 0.3) : 0xb3242c);
      if (f.lit) litSpot(c, x, y - r * 0.15, r * 0.34, S.light);
      else if (q === 1) gem(c, x, y - r * 0.1, r * 0.3, f.acc, 0.7);
      break;
    }
    case 4: { // Array: a graduated ring (verdigris when plain) round a lens that carries the signal when lit
      const ring = q === 0 ? 0x5f9f8a : S.trim;
      ball(c, x, y, r, r, ring, { ow: 1.2, hl: 0.25 });
      if (!inSilhouette()) {
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r1 = r * (i % 3 === 0 ? 0.62 : 0.74); c.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1).lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92); }
        c.stroke({ width: Math.max(0.35, r * 0.1), color: q === 0 ? shade(ring, 0.4) : 0xe8e0c8 });
      }
      c.circle(x, y, r * 0.48); fill(c, q === 0 ? S.leather : 0x2e3a5c);
      if (f.lit) litSpot(c, x, y, r * 0.38, S.light);
      else if (q === 1) gem(c, x, y, r * 0.32, f.acc, 0.7);
      break;
    }
    case 5: { // Faultstone: a slate tablet split in two, a rune slot in each half (lit when lit)
      const g = q === 0 ? 0.15 : 0.35;
      poly(c, [x - r * 0.95, y - r, x - g * r, y - r, x - g * r, y + r, x - r * 0.95, y + r * 0.8], S.metal, { ow: 1.1 });
      poly(c, [x + g * r, y - r, x + r * 0.95, y - r * 0.8, x + r * 0.95, y + r, x + g * r, y + r], shade(S.metal, 0.1), { ow: 1.1 });
      for (const sx of [-1, 1]) {
        const cx = x + sx * (g + 0.95) * r * 0.5;
        if (f.lit) { if (inSilhouette()) continue; c.rect(cx - r * 0.12, y - r * 0.5, r * 0.24, r).fill(light(S.light, 0.3)); c.rect(cx - r * 0.24, y - r * 0.62, r * 0.48, r * 1.24).fill({ color: S.light, alpha: 0.25 }); }
        else { c.rect(cx - r * 0.12, y - r * 0.5, r * 0.24, r); fill(c, 0x1c1622); }
      }
      if (q === 1) gem(c, x, y + r * 1.15, r * 0.3, f.acc, 0.7);
      break;
    }
    default: { // Reliquary: a small ribbed glass dome on a bronze base with a gold finial; the relic glows inside when lit
      rbox(c, x - r, y + r * 0.2, r * 2, r * 0.7, r * 0.2, S.metal, { ow: 1.1, hl: 0.3 });
      const dome = () => { c.moveTo(x - r * 0.8, y + r * 0.25); c.bezierCurveTo(x - r * 0.8, y - r * 1.05, x + r * 0.8, y - r * 1.05, x + r * 0.8, y + r * 0.25); c.closePath(); };
      dome(); fill(c, f.lit ? mix(S.accent, S.light, 0.45) : q === 0 ? shade(S.accent, 0.25) : S.accent);
      if (!inSilhouette()) {
        c.moveTo(x, y + r * 0.25).lineTo(x, y - r * 0.72); c.moveTo(x - r * 0.4, y + r * 0.25).quadraticCurveTo(x - r * 0.42, y - r * 0.5, x, y - r * 0.72); c.moveTo(x + r * 0.4, y + r * 0.25).quadraticCurveTo(x + r * 0.42, y - r * 0.5, x, y - r * 0.72);
        c.stroke({ width: Math.max(0.35, r * 0.1), color: shade(S.metal, 0.25) });
        c.moveTo(x - r * 0.5, y).quadraticCurveTo(x - r * 0.45, y - r * 0.45, x - r * 0.15, y - r * 0.6).stroke({ width: Math.max(0.4, r * 0.12), color: 0xe6fff8, alpha: 0.9 });
      }
      dome(); c.stroke({ width: 1, color: OUT });
      if (f.lit) litSpot(c, x, y - r * 0.15, r * 0.3, S.light);
      ball(c, x, y - r * 0.95, Math.max(0.6, r * 0.22), Math.max(0.6, r * 0.22), S.trim, { ow: 0.8, hl: 0 });
      if (q === 1) gem(c, x + r * 0.62, y + r * 0.55, r * 0.26, f.acc, 0.6);
    }
  }
  if (f.special) medallion(c, f, x, y, r);
}

/** Legendary / Set: the item's motif on a disc in the series' bezel (its own colour), over the badge. */
function medallion(c: Ctx, f: Fit, x: number, y: number, r: number): void {
  const k = r * 0.62;
  ball(c, x + r * 0.95, y - r * 0.8, k, k, shade(f.set?.deep ?? f.S.trim, 0.1), { ow: 1, hl: 0.3 });
  emblem(c, f.motif, x + r * 0.95, y - r * 0.8, k * 0.72, light(f.acc || f.S.trim, 0.3));
}

/** One small salt cube (Brinekeeper). */
function cubeAt(c: Ctx, x: number, y: number, s: number, col: number): void {
  const h = s / 2;
  c.poly([x - h, y - h * 0.4, x, y - h, x + h, y - h * 0.4, x + h, y + h * 0.7, x, y + h * 1.1, x - h, y + h * 0.7], true); fill(c, col);
  if (inSilhouette()) return;
  c.poly([x, y - h * 0.15, x + h, y - h * 0.4, x + h, y + h * 0.7, x, y + h * 1.1], true).fill(shade(col, 0.18));
  c.poly([x - h, y - h * 0.4, x, y - h, x + h, y - h * 0.4, x, y - h * 0.15], true).fill(light(col, 0.5));
  c.poly([x - h, y - h * 0.4, x, y - h, x + h, y - h * 0.4, x + h, y + h * 0.7, x, y + h * 1.1, x - h, y + h * 0.7], true).stroke({ width: 0.55, color: OUT });
}

// ─────────────────────────── the series band (trim along a path) ───────────────────────────

/** A trim band along a polyline in the series' fitting: strap iron with pegs, a glazed collar with drips, tarred
 *  whipping, a brass edge over crimson enamel, graduated copper, a bone wrap, bronze leading with gold dots. */
export function band(c: Ctx, f: Fit, pts: number[], w: number): void {
  const { S, q } = f;
  if (pts.length < 4) return;
  const base = f.gen === 4 && q === 0 ? 0x5f9f8a : f.gen === 1 ? (q === 0 ? 0x5c2a1c : S.accent) : S.trim;
  crease(c, pts, w + 1.4, OUT, 0.9);
  crease(c, pts, w, base, 1);
  if (inSilhouette()) return;
  // marks along the band
  const marks = (step: number, draw: (x: number, y: number, nx: number, ny: number, i: number) => void) => {
    let acc = 0, i = 0;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const x0 = pts[k], y0 = pts[k + 1], x1 = pts[k + 2], y1 = pts[k + 3], L = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let d = step / 2 - acc; d < L; d += step) { const t = d / L; draw(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, nx, ny, i++); }
      acc = (acc + L) % step;
    }
  };
  switch (f.gen) {
    case 0: crease(c, pts, Math.max(0.5, w * 0.3), light(base, 0.35), 0.8); marks(w * 3.2, (x, y) => { c.rect(x - w * 0.22, y - w * 0.22, w * 0.44, w * 0.44).fill(q >= 2 ? S.accent : shade(base, 0.4)); }); break;
    case 1: crease(c, pts, Math.max(0.5, w * 0.35), light(base, 0.45), 0.8); marks(w * 2.4, (x, y, nx, ny, i) => { if (i % 2) return; const L = w * (0.9 + (i % 3) * 0.3); c.moveTo(x, y).lineTo(x + nx * L, y + ny * L).stroke({ width: w * 0.42, color: base, cap: 'round' }); }); break;
    case 2: marks(w * 0.9, (x, y, nx, ny) => { c.moveTo(x - nx * w * 0.45 - ny * 0.3, y - ny * w * 0.45 + nx * 0.3).lineTo(x + nx * w * 0.45 + ny * 0.3, y + ny * w * 0.45 - nx * 0.3).stroke({ width: 0.4, color: light(base, 0.3), alpha: 0.8 }); }); break;
    case 3: crease(c, pts, Math.max(0.5, w * 0.42), q === 0 ? shade(0xb3242c, 0.3) : 0xb3242c, 1); crease(c, pts, Math.max(0.3, w * 0.12), light(base, 0.5), 0.9); break;
    case 4: marks(w * 1.1, (x, y, nx, ny, i) => { const L = w * (i % 4 === 0 ? 0.48 : 0.28); c.moveTo(x - nx * L, y - ny * L).lineTo(x + nx * L * 0.2, y + ny * L * 0.2).stroke({ width: 0.35, color: q === 0 ? shade(base, 0.45) : 0xe8e0c8 }); }); break;
    case 5: marks(w * 1.3, (x, y, nx, ny) => { c.moveTo(x - nx * w * 0.5 + ny * 0.5, y - ny * w * 0.5 - nx * 0.5).lineTo(x + nx * w * 0.5 - ny * 0.5, y + ny * w * 0.5 + nx * 0.5).stroke({ width: 0.5, color: shade(base, 0.4) }); }); break;
    default: crease(c, pts, Math.max(0.4, w * 0.25), light(S.metal, 0.3), 0.8); marks(w * 2.2, (x, y) => { c.circle(x, y, w * 0.24).fill(light(base, 0.2)); }); break;
  }
  if (f.lit && (f.gen === 4 || f.gen === 5 || f.gen === 6)) litLine(c, pts, Math.max(0.4, w * 0.22), S.light);
}

// ─────────────────────────── grade accents ───────────────────────────

/** Kindled: an ember in a small three-bar iron cage. Fabled: a ring of Inscription ticks with a starlight glint. */
export function gradeAccent(c: Ctx, f: Fit, x: number, y: number, r: number): void {
  if (f.top >= 2) {
    if (!inSilhouette()) {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r1 = r * (i % 4 === 0 ? 0.72 : 0.84); c.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1).lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      c.stroke({ width: Math.max(0.4, r * 0.08), color: FABLED_LIGHT });
      c.circle(x, y, r * 0.92).stroke({ width: Math.max(0.35, r * 0.05), color: light(FABLED_LIGHT, 0.4), alpha: 0.8 });
    }
    spark(c, x + r * 0.7, y - r * 0.7, r * 0.42, 0xffffff);
  } else if (f.top >= 1) {
    litSpot(c, x, y, r * 0.42, TOP_COLORS[1]);
    if (!inSilhouette()) {
      for (const dx of [-0.42, 0, 0.42]) c.moveTo(x + dx * r, y - r * 0.62).lineTo(x + dx * r * 1.15, y + r * 0.55);
      c.stroke({ width: Math.max(0.5, r * 0.12), color: 0x403a3a });
      c.moveTo(x - r * 0.55, y - r * 0.62).lineTo(x + r * 0.55, y - r * 0.62).stroke({ width: Math.max(0.5, r * 0.14), color: 0x403a3a });
    }
  }
}

// ─────────────────────────── slots ───────────────────────────

type Pt = { x: number; y: number; d: number };
type Sph = (lon: number, lat: number, yaw: number, r?: number) => Pt;
type Vec = (fwd: number, up: number, side: number, yaw: number) => Pt;

/** Helm signature pieces on the turntable head (heroParts.drawHeadView). `back` = the pass behind the skull. */
export function headDecor(c: Ctx, l: ItemLook, yaw: number, back: boolean, sph: Sph, vec: Vec, R: number): void {
  const f = fitOf(l);
  if (!f) return;
  const shape = l.shape;
  const rr = shape === 'hood' ? R + 3.4 : shape === 'circlet' ? R + 1.9 : R + 2.4;
  const up = vec(0, 1, 0, yaw);
  const hat = shape === 'wizard_hat';
  // the ring round the head (front / back halves split by depth), used by the Millwright strap, Kilnfolk goggle strap,
  // Brinekeeper whipping and the Array halo
  const ringRun = (lat: number, r: number, front: boolean): number[][] => {
    const runs: number[][] = []; let cur: number[] = [];
    for (let i = 0; i <= 48; i++) {
      const q = sph(-Math.PI + (i / 48) * Math.PI * 2, lat, yaw, r);
      if ((q.d >= 0) === front) cur.push(q.x, q.y); else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    return runs.filter((r2) => r2.length >= 4);
  };
  const front = (lon: number, lat: number, r = rr) => sph(lon, lat, yaw, r);
  if (hat) {
    // wizard hats: the series badge on the hat band (the cone takes the crown)
    if (back) return;
    const b = front(0, 34 * D2R, R + 3.2);
    if (b.d > 0.15) badge(c, f, b.x, b.y - 1, 2.6 + f.q * 0.3);
    if (f.top && b.d > 0.15) gradeAccent(c, f, b.x + 5, b.y - 4, 2.2);
    return;
  }
  switch (f.gen) {
    case 0: { // Millwright: a strap-iron band round the crown, square pegs; the wheel at the brow from magic
      for (const run of ringRun(24 * D2R, rr + 0.3, !back)) band(c, f, run, back ? 1.8 : 2.2);
      if (back) break;
      if (f.q >= 1) { const b = front(0, 24 * D2R, rr + 0.8); if (b.d > 0.2) badge(c, f, b.x, b.y, 2.6); }
      break;
    }
    case 1: { // Kilnfolk: goggles pushed up on the brow, on a strap (lenses catch the ember when lit)
      for (const run of ringRun(20 * D2R, rr + 0.2, !back)) crease(c, run, back ? 1.6 : 2, OUT, 0.9), crease(c, run, back ? 0.8 : 1.2, f.S.leather, 1);
      if (back) break;
      for (const lon of [-24, 24]) {
        const q = front(lon * D2R, 21 * D2R, rr + 1.2);
        if (q.d < 0.08) continue;
        const k = clamp(q.d * 1.15, 0.35, 1), rx = 3.3 * k, ry = 3.1;
        c.ellipse(q.x, q.y, rx + 0.9, ry + 0.9); fill(c, f.S.trim); c.ellipse(q.x, q.y, rx + 0.9, ry + 0.9); c.stroke({ width: 1.1, color: OUT });
        c.ellipse(q.x, q.y, rx, ry); fill(c, f.lit ? mix(0x2a3a3a, f.S.light, 0.35) : 0x2a3a3a);
        if (!inSilhouette()) { c.ellipse(q.x - rx * 0.3, q.y - ry * 0.35, rx * 0.35, ry * 0.22).fill({ color: 0xffffff, alpha: 0.6 }); if (f.lit) c.ellipse(q.x + rx * 0.15, q.y + ry * 0.2, rx * 0.4, ry * 0.35).fill({ color: f.S.light, alpha: 0.7 }); }
      }
      if (f.q >= 1) { const g = front(0, 21 * D2R, rr + 1.4); if (g.d > 0.4) badge(c, f, g.x, g.y - 0.5, 1.5); }
      break;
    }
    case 2: { // Brinekeeper: a tarred whipping band, salt cubes grown at the temple (more and pinker with craft)
      for (const run of ringRun(14 * D2R, rr + 0.2, !back)) band(c, f, run, back ? 1.8 : 2.2);
      for (const side of [1, -1]) {
        const q = front(side * 72 * D2R, 22 * D2R, rr + 1.4);
        if ((q.d < -0.05) !== back) continue;
        const n = f.q === 0 ? 2 : f.q === 1 ? 3 : 5;
        const offs = [[0, 0, 2.4], [-2.2, 1.2, 1.8], [2.0, 0.6, 1.7], [-0.6, -2.2, 1.6], [1.6, -1.8, 1.4]];
        for (let i = n - 1; i >= 0; i--) { const [dx, dy, s] = offs[i]; cubeAt(c, q.x + dx, q.y + dy + up.y * 2, s, i === 1 && f.q >= 1 ? mix(f.acc, 0xf3efe8, 0.2) : i % 2 ? 0xf3efe8 : mix(0xf3efe8, f.S.accent, f.q >= 2 ? 0.7 : 0.4)); }
        if (f.lit && !back) litSpot(c, q.x + 0.4, q.y + 1.6, 1.2, f.S.light);
      }
      break;
    }
    case 3: { // Warden: a swallowtail pennant flying back off the crown; the lamp lens at the brow (lit on rare)
      const a = front(Math.PI, 66 * D2R, rr), top = { x: a.x + up.x * 7, y: a.y + up.y * 7 };
      if ((a.d < 0.05) === back) {
        crease(c, [a.x, a.y, top.x, top.y], 1.9, OUT, 1); crease(c, [a.x, a.y, top.x, top.y], 1.1, f.S.trim, 1);
        const bk = vec(-1, 0.25, 0, yaw);
        const dir = Math.atan2(bk.y, Math.abs(bk.x) < 0.05 ? 0.05 * Math.sign(bk.x || -1) : bk.x);
        pennant(c, top.x, top.y + 1.2, 11 + f.q, 4, dir, f.q === 0 ? 0xb88a86 : 0xb3242c, f.q === 0 ? mix(0xeee6d6, 0xb88a86, 0.4) : f.q === 2 ? 0x2a3862 : 0xeee6d6);
        ball(c, top.x, top.y, 1.3, 1.3, f.S.trim, { ow: 0.9, hl: 0.3 });
      }
      if (back) break;
      const g = front(0, 18 * D2R, rr + 0.6);
      if (g.d > 0.25) { if (f.lit) { ball(c, g.x, g.y, 2.3, 2.3, f.S.trim, { ow: 1, hl: 0.3 }); litSpot(c, g.x, g.y, 1.5, f.S.light); } else badge(c, f, g.x, g.y, 2.4); }
      break;
    }
    case 4: { // Array: a graduated halo floating round the head (behind and in front), the signal in it when lit
      for (const run of ringRun(30 * D2R, R + 6.4, !back)) {
        band(c, f, run, back ? 1.6 : 2.2);
      }
      if (back) break;
      if (f.q >= 1) { const g = front(0, 30 * D2R, R + 6.6); if (g.d > 0.3) badge(c, f, g.x, g.y, 2.4); }
      break;
    }
    case 5: { // Faultstone: a slate slab hovering over the crown, held off by the Faultline, a rune slot in it
      if (back) break;
      const t = front(0, Math.PI / 2, rr), gap = 4.2 + f.q * 1.4;
      const cx = t.x + up.x * (gap + 2.6), cy = t.y + up.y * (gap + 2.6);
      const ang = Math.atan2(up.x, -up.y), cs = Math.cos(ang), sn = Math.sin(ang);
      const P = (u: number, v: number) => [cx + u * cs - v * sn, cy + u * sn + v * cs];
      const w = 9 + f.q * 0.9;
      poly(c, [...P(-w, 2.0), ...P(w, 2.0), ...P(w * 0.82, -2.4), ...P(-w * 0.82, -2.4)], f.S.metal, { ow: 1.4, hl: 0.25 });
      poly(c, [...P(-w * 0.55, -2.6), ...P(w * 0.55, -2.6), ...P(0, -5.6)], shade(f.S.metal, 0.12), { ow: 1.2 });
      const s0 = P(-1.1, -1.6), s1 = P(1.1, 1.6);
      if (f.lit) litSpot(c, (s0[0] + s1[0]) / 2, (s0[1] + s1[1]) / 2, 1.3, f.S.light);
      else { c.poly([...P(-1, -1.8), ...P(1, -1.8), ...P(1, 1.6), ...P(-1, 1.6)], true); fill(c, 0x1c1622); }
      if (!inSilhouette()) { const [gx, gy] = P(0, 3.4 + gap * 0.5); c.circle(gx, gy, 0.5).fill({ color: f.lit ? f.S.light : f.S.accent, alpha: 0.8 }); }
      break;
    }
    default: { // Reliquary: a small ribbed glass dome crowning the helm, a gold finial; the relic glows inside when lit
      if (back) break;
      const t = front(0, Math.PI / 2, rr - 0.6);
      c.save?.(); c.translate(t.x, t.y); c.rotate(Math.atan2(up.x, -up.y));
      badge(c, { ...f, special: false }, 0, -3.2, 4.2 + f.q * 0.4);
      c.restore?.();
      const g = front(0, 18 * D2R, rr + 0.4);
      if (g.d > 0.3) band(c, f, [g.x - 5 * g.d, g.y + 0.6, g.x, g.y - 0.6, g.x + 5 * g.d, g.y + 0.6], 1.8);
    }
  }
  if (back) return;
  if (f.special) { const m = front(-30 * D2R, 34 * D2R, rr + 0.8); if (m.d > 0.3) medallion(c, f, m.x - 3, m.y + 2, 2.6); }
  if (f.top) { const g = front(34 * D2R, 40 * D2R, rr + 1); if (g.d > 0.2) gradeAccent(c, f, g.x, g.y, 2.4); }
}

/** A swallowtail pennant attached at (x, y), flying along angle `a`. */
function pennant(c: Ctx, x: number, y: number, len: number, h: number, a: number, col: number, stripe: number): void {
  const cs = Math.cos(a), sn = Math.sin(a), wave = 0.8;
  const P = (u: number, v: number) => [x + u * cs - v * sn, y + u * sn + v * cs];
  const pts = [...P(0, -h / 2), ...P(len * 0.35, -h / 2 - wave), ...P(len * 0.7, -h / 2 + wave * 0.4), ...P(len, -h / 2 + wave), ...P(len * 0.72, wave * 0.6), ...P(len, h / 2 + wave), ...P(len * 0.7, h / 2 + wave * 0.4), ...P(len * 0.35, h / 2 - wave), ...P(0, h / 2)];
  poly(c, pts, col, { ow: 1.1, sh: 0.22 });
  if (!inSilhouette()) c.poly([...P(0, -h * 0.12), ...P(len * 0.35, -h * 0.12 - wave), ...P(len * 0.66, -h * 0.12 + wave * 0.4), ...P(len * 0.66, h * 0.12 + wave * 0.4), ...P(len * 0.35, h * 0.12 - wave), ...P(0, h * 0.12)], true).fill(stripe);
}

/** Pauldron signature pieces (same frame as gear.drawShoulder: pivot at the shoulder joint, +x forward). */
export function shoulderDecor(c: Ctx, l: ItemLook, isBack: boolean): void {
  const f = fitOf(l);
  if (!f) return;
  const dim = (col: number) => (isBack ? shade(col, 0.2) : col);
  const rim = [-7.8, 3.4, 0.6, 5.6, 8.8, 3.6];
  switch (f.gen) {
    case 0: { // Millwright: two strap-iron bands across the pad with square pegs
      for (const x of [-3.2, 3.8]) band(c, f, [x - 0.6, -5.4, x, 0, x + 0.4, 5.2], 2.2);
      break;
    }
    case 1: { // Kilnfolk: fired-clay scales sewn on, glaze-dipped, drips running off the lower edge
      for (const [x, y] of [[-4.8, 2.6], [5.8, 2.6], [0.6, 3.6]] as const) {
        blob(c, [x - 3, y - 2.4, x, y - 3.8, x + 3, y - 2.4, x + 2.6, y + 1.8, x, y + 3.2, x - 2.6, y + 1.8], dim(f.S.metal), { ow: 1.3, hl: 0.25 });
        if (!inSilhouette()) { c.moveTo(x - 2.9, y - 1.6).quadraticCurveTo(x, y - 3.2, x + 2.9, y - 1.6).lineTo(x + 2.8, y - 0.6).quadraticCurveTo(x, y - 2.0, x - 2.8, y - 0.6).closePath().fill(dim(f.q === 0 ? 0x5c2a1c : f.S.accent)); c.moveTo(x + 0.8, y - 0.9).lineTo(x + 0.8, y + 0.6).stroke({ width: 0.9, color: dim(f.q === 0 ? 0x5c2a1c : f.S.accent), cap: 'round' }); }
      }
      if (f.lit && !isBack) litSpot(c, 0.6, 3.4, 1.2, f.S.light);
      break;
    }
    case 2: { // Brinekeeper: tarred whipping on the rim, salt grown on top
      band(c, f, rim, 2.2);
      if (!isBack) badge(c, f, 1.4, -6.2, 3.4);
      break;
    }
    case 3: { // Warden: a brass rim over crimson enamel, a pennant flying back off the pauldron
      band(c, f, rim, 2.2);
      if (!isBack) {
        crease(c, [-3.6, -4.4, -4.6, -11.4], 1.8, OUT, 1); crease(c, [-3.6, -4.4, -4.6, -11.4], 1, f.S.trim, 1);
        pennant(c, -4.6, -10.6, 9.5 + f.q, 3.4, Math.PI + 0.35, f.q === 0 ? 0xb88a86 : 0xb3242c, f.q === 2 ? 0x2a3862 : 0xeee6d6);
        if (f.lit) litSpot(c, 0.6, -0.6, 1.4, f.S.light);
      }
      break;
    }
    case 4: { // Array: a graduated copper ring for a rim, a lens on the plate (the signal when lit)
      band(c, f, [-8.2, 0.6, -6.6, 4.4, 0.6, 6.2, 7.8, 4.4, 9.4, 0.6], 2.4);
      if (!isBack) badge(c, f, 0.6, -1.4, 2.8);
      break;
    }
    case 5: { // Faultstone: a slate plate hovering over the pauldron, held off by the Faultline
      const g = 1.2 + f.q * 0.8;
      poly(c, [-7, -6.4 - g, 8, -7 - g, 6.4, -11 - g, -5.4, -10.4 - g], dim(f.S.metal), { ow: 1.4, hl: 0.25 });
      if (f.lit && !isBack) litSpot(c, 0.8, -8.6 - g, 1.1, f.S.light);
      else { c.rect(0, -9.8 - g, 1.6, 2.6); fill(c, 0x1c1622); }
      band(c, f, rim, 1.8);
      break;
    }
    default: { // Reliquary: a glass pane set in a bronze frame on the pad, a gold finial on top
      rbox(c, -4.4, -4.6, 10, 6.4, 1.4, dim(f.S.metal), { ow: 1.3, hl: 0.3 });
      c.roundRect(-3.2, -3.6, 7.6, 4.4, 0.9); fill(c, dim(f.lit ? mix(f.S.accent, f.S.light, 0.45) : f.q === 0 ? shade(f.S.accent, 0.25) : f.S.accent));
      if (!inSilhouette()) { c.moveTo(0.6, -3.6).lineTo(0.6, 0.8).moveTo(-3.2, -1.4).lineTo(4.4, -1.4).stroke({ width: 0.7, color: shade(f.S.metal, 0.25) }); c.moveTo(-2.4, 0).lineTo(-0.6, -3).stroke({ width: 0.7, color: 0xe6fff8, alpha: 0.85 }); }
      if (f.lit && !isBack) litSpot(c, 2.4, -1.4, 1.1, f.S.light);
      crease(c, [0.6, -4.6, 0.6, -8], 1.6, OUT, 1); crease(c, [0.6, -4.6, 0.6, -8], 0.9, f.S.trim, 1);
      ball(c, 0.6, -8.6, 1.4, 1.4, f.S.trim, { ow: 0.9, hl: 0.3 });
      band(c, f, rim, 1.8);
    }
  }
  if (isBack) return;
  if (f.special) medallion(c, f, -2.6, 2.2, 2.6);
  if (f.top) gradeAccent(c, f, 6.2, -2.8, 2.6);
}

/** Chest front fittings (heroParts.drawTorsoFront frame: centred, collar at y -21.8). */
export function torsoFrontDecor(c: Ctx, chest: ItemLook, cloth: boolean): void {
  const f = fitOf(chest);
  if (!f) return;
  band(c, f, [-6.2, -21.2, 0, -19.8, 6.2, -21.2], 1.8);
  switch (f.gen) {
    case 0: for (const y of [-15.4, -9.8]) { c.rect(-1.1, y - 1.1, 2.2, 2.2); fill(c, f.S.metal); if (!inSilhouette()) c.rect(-1.1, y - 1.1, 2.2, 2.2).stroke({ width: 0.7, color: OUT }); } break;
    case 2: if (!inSilhouette()) { for (const y of [-16, -12, -8]) crease(c, [-5.4, y, 5.4, y - 1.2], 1.6, f.S.trim, 0.9); } break;
    case 3: for (const y of [-16.4, -12.4, -8.4]) ball(c, 0, y, 1.1, 1.1, f.S.trim, { ow: 0.8, hl: 0.4 }); break;
    case 5: if (!inSilhouette()) { crease(c, [-6.4, -19, 5.6, -4], 1.6, f.S.trim, 0.95); crease(c, [6.4, -19, -5.6, -4], 1.6, f.S.trim, 0.95); } break;
    case 6: if (!inSilhouette()) { for (const x of [-4.2, 4.2]) { crease(c, [x, -19, x * 1.1, -4], 1.2, shade(f.S.metal, 0.1), 0.95); for (const y of [-16, -11, -6]) c.circle(x + (y + 19) * 0.006 * x, y, 0.6).fill(f.S.trim); } } break;
    default: break;
  }
  if (f.q >= 1 || f.gen === 1 || f.gen === 4) badge(c, f, 0, -12.6, cloth ? 2.8 : 3.2 + f.q * 0.2);
  if (f.top) gradeAccent(c, f, 5.6, -16.6, 2.6);
}

/** Belt buckle (heroParts.drawBeltFront frame, buckle centred at (0, y)). */
export function beltDecor(c: Ctx, w: ItemLook, y: number): void {
  const f = fitOf(w);
  if (!f) return;
  badge(c, f, w.shape === 'sash' ? 0.4 : 0, y + 0.4, w.shape === 'sash' ? 2.2 : 2.8);
  if (f.top) gradeAccent(c, f, 4.8, y + 0.2, 1.8);
}

/** Knee and boot-cuff fittings (heroParts.drawLegView frame; sn / cs = sine and cosine of the leg yaw). */
export function legDecor(c: Ctx, legs: ItemLook | undefined, feet: ItemLook | undefined, sn: number, cs: number): void {
  const lf = fitOf(legs), ff = fitOf(feet);
  if (lf && cs > -0.3 && (lf.q >= 1 || lf.gen === 4 || lf.gen === 6)) badge(c, { ...lf, special: false }, 0.7 * sn, 4.2, 1.7);
  if (ff) band(c, ff, [-4.4, 3.0, 0, 3.4, 4.4, 3.0], 1.5);
}

/** Glove cuff (gear.drawHand frame). */
export function handDecor(c: Ctx, hands: ItemLook): void {
  const f = fitOf(hands);
  if (!f) return;
  band(c, f, [-3.8, -4.2, 0, -4.8, 3.8, -4.2], 1.5);
  if (f.q >= 2) badge(c, { ...f, special: false }, 0, -4.6, 1.3);
}

// ─────────────────────────── icons (paper-doll poses, icons.ts) ───────────────────────────

/** Fittings on an armour icon, drawn over the icon pose (icons.ts drawIcon frames). */
export function iconDecor(c: Ctx, look: ItemLook, kind: string): void {
  const f = fitOf(look);
  if (!f) return;
  switch (kind) {
    case 'head': headIcon(c, f, look); break;
    case 'chest':
      band(c, f, [-5.4, -21.4, 1.2, -19.6, 7.8, -21.4], 2);
      badge(c, f, 4.2, -11.6, 3.6);
      if (f.top) gradeAccent(c, f, 8.6, -16.4, 2.8);
      break;
    case 'hands': band(c, f, [-11, 10.6, 0, 9.4, 11, 10.6], 2.4); badge(c, { ...f, special: false }, 0, 2, 3); if (f.top) gradeAccent(c, f, 7, -6, 2.6); break;
    case 'legs': band(c, f, [-11, -13, 0, -12.4, 11, -13], 2.2); if (f.q >= 1) for (const x of [-6.4, 6.4]) badge(c, { ...f, special: false }, x, 5, 2.4); if (f.top) gradeAccent(c, f, 0, -4, 2.6); break;
    case 'feet': band(c, f, [-11.6, 1.2, -6, 1.8, -0.4, 1.2], 2.2); band(c, f, [-0.6, 6.2, 5, 6.8, 10.6, 6.2], 2.2); if (f.top) gradeAccent(c, f, 0, -6, 2.4); break;
    case 'waist': badge(c, f, look.shape === 'sash' ? 4 : 0, look.shape === 'sash' ? 6.5 : 7, 4); if (f.top) gradeAccent(c, f, -9, 8, 2.4); break;
    default: break;
  }
}

/** Helm icon (gear.drawHead side view: head centre (0.5, -13.5), radius 16, face to +x): the series' helm piece. */
function headIcon(c: Ctx, f: Fit, look: ItemLook): void {
  const hx = 0.5, hy = -13.5;
  if (look.shape === 'wizard_hat') { badge(c, f, hx - 1, hy - 15.4, 3.4); if (f.top) gradeAccent(c, f, hx + 6, hy - 24, 2.8); return; }
  switch (f.gen) {
    case 0: band(c, f, [hx - 17, hy - 4, hx - 6, hy - 9.6, hx + 6, hy - 9.4, hx + 16.6, hy - 5], 2.6); if (f.q >= 1) badge(c, f, hx + 12.6, hy - 7, 3.2); break;
    case 1: {
      crease(c, [hx - 17, hy - 5, hx + 4, hy - 10, hx + 15, hy - 8], 2.6, OUT, 1); crease(c, [hx - 17, hy - 5, hx + 4, hy - 10, hx + 15, hy - 8], 1.6, f.S.leather, 1);
      for (const x of [hx + 8.6, hx + 14.2]) { c.ellipse(x, hy - 9.4, 3.6, 3.4); fill(c, f.S.trim); c.ellipse(x, hy - 9.4, 3.6, 3.4); c.stroke({ width: 1.2, color: OUT }); c.ellipse(x, hy - 9.4, 2.6, 2.5); fill(c, f.lit ? mix(0x2a3a3a, f.S.light, 0.4) : 0x2a3a3a); if (!inSilhouette()) c.ellipse(x - 0.8, hy - 10.4, 0.9, 0.6).fill({ color: 0xffffff, alpha: 0.6 }); }
      break;
    }
    case 2: band(c, f, [hx - 17, hy - 2, hx - 4, hy - 7.4, hx + 8, hy - 7, hx + 16.6, hy - 3], 2.6); badge(c, f, hx - 9, hy - 14, 4.4); break;
    case 3: {
      crease(c, [hx - 10, hy - 18, hx - 13, hy - 27], 2.2, OUT, 1); crease(c, [hx - 10, hy - 18, hx - 13, hy - 27], 1.3, f.S.trim, 1);
      pennant(c, hx - 13, hy - 26, 13 + f.q, 4.6, Math.PI + 0.25, f.q === 0 ? 0xb88a86 : 0xb3242c, f.q === 2 ? 0x2a3862 : 0xeee6d6);
      if (f.lit) { ball(c, hx + 13, hy - 6, 2.8, 2.8, f.S.trim, { ow: 1.1, hl: 0.3 }); litSpot(c, hx + 13, hy - 6, 1.8, f.S.light); } else badge(c, f, hx + 13, hy - 6, 3);
      break;
    }
    case 4: {
      if (!inSilhouette()) { c.ellipse(hx - 1, hy - 8, 22, 6.4).stroke({ width: 4.2, color: OUT }); }
      c.ellipse(hx - 1, hy - 8, 22, 6.4).stroke({ width: 2.6, color: f.q === 0 ? 0x5f9f8a : f.S.trim });
      if (f.lit && !inSilhouette()) c.ellipse(hx - 1, hy - 8, 22, 6.4).stroke({ width: 0.9, color: light(f.S.light, 0.4) });
      if (f.q >= 1) badge(c, f, hx + 14, hy - 4.4, 3);
      break;
    }
    case 5: {
      const g = 3 + f.q;
      poly(c, [hx - 11, hy - 18 - g, hx + 11, hy - 19 - g, hx + 9, hy - 25 - g, hx - 9, hy - 24 - g], f.S.metal, { ow: 1.6, hl: 0.25 });
      poly(c, [hx - 5, hy - 24.6 - g, hx + 5, hy - 25 - g, hx, hy - 29 - g], shade(f.S.metal, 0.12), { ow: 1.3 });
      if (f.lit) litSpot(c, hx, hy - 21.6 - g, 1.6, f.S.light); else { c.rect(hx - 1, hy - 23.4 - g, 2, 3.4); fill(c, 0x1c1622); }
      break;
    }
    default: badge(c, { ...f, special: false }, hx - 2, hy - 20, 5.2 + f.q * 0.5); band(c, f, [hx + 6, hy - 6.4, hx + 11, hy - 8, hx + 16.4, hy - 5.6], 2.2); break;
  }
  if (f.special) medallion(c, f, hx - 10, hy - 6, 3);
  if (f.top) gradeAccent(c, f, hx + 8, hy - 17, 3);
}

/** Bracers, amulets and rings in the series (icons only: they are not paper-doll slots). */
export function jewelIcon(c: Ctx, look: ItemLook, kind: 'wrists' | 'neck' | 'ring', key: string): boolean {
  const f = fitOf(look);
  if (!f) return false;
  const { S } = f;
  const metal = f.gen === 4 && f.q === 0 ? 0x5f9f8a : f.gen === 1 ? S.metal : f.gen === 2 ? S.cloth2 : f.gen === 5 ? S.metal : S.trim;
  if (kind === 'ring') {
    if (key === 'coil') {
      for (let i = 2; i >= 0; i--) { const y = 2 + i * 3; c.ellipse(0, y, 11, 5.6).stroke({ width: 5, color: OUT }); c.ellipse(0, y, 11, 5.6).stroke({ width: 3.2, color: i ? shade(metal, 0.12 * i) : metal }); }
      badge(c, f, 0, -4.4, 4.2);
    } else {
      c.ellipse(0, 3, 12, 7).stroke({ width: key === 'band' ? 7.6 : 6, color: OUT });
      c.ellipse(0, 3, 12, 7).stroke({ width: key === 'band' ? 5.4 : 3.8, color: metal });
      if (!inSilhouette()) c.ellipse(-2, 1, 9, 4.6).stroke({ width: 1, color: light(metal, 0.45), alpha: 0.8 });
      if (key === 'band') band(c, f, [-11.4, 4.6, -5, 9, 5, 9, 11.4, 4.6], 2.2);
      if (key === 'signet') { rbox(c, -6.4, -10.4, 12.8, 9.6, 2.4, metal, { ow: 1.6, hl: 0.35 }); badge(c, f, 0, -5.6, 3.8); }
      else badge(c, f, 0, -6, key === 'band' ? 3.4 : 5);
    }
  } else if (kind === 'neck') {
    if (!inSilhouette()) { c.moveTo(-12, -14).quadraticCurveTo(-11, 2, 0, 5).quadraticCurveTo(11, 2, 12, -14); c.stroke({ width: 3, color: OUT }); c.moveTo(-12, -14).quadraticCurveTo(-11, 2, 0, 5).quadraticCurveTo(11, 2, 12, -14); c.stroke({ width: 1.6, color: f.gen === 2 ? 0x2c2b31 : light(metal, 0.2) }); }
    if (key === 'torc') {
      c.moveTo(-11, -12).quadraticCurveTo(-12, 4, 0, 6).quadraticCurveTo(12, 4, 11, -12).stroke({ width: 6, color: OUT });
      c.moveTo(-11, -12).quadraticCurveTo(-12, 4, 0, 6).quadraticCurveTo(12, 4, 11, -12).stroke({ width: 4, color: metal });
      for (const x of [-11, 11]) badge(c, { ...f, special: false }, x, -12.6, 3.4);
      if (f.special) medallion(c, f, 0, 6, 3.2);
    } else if (key === 'locket') {
      ball(c, 0, 10, 6, 7.4, metal, { ow: 1.8, hl: 0.4 });
      badge(c, f, 0, 10, 4);
    } else if (key === 'charm') {
      crease(c, [0, 5, 0, 8], 1.4, OUT, 1);
      badge(c, f, 0, 12, 6);
    } else badge(c, f, 0, 9, 6.4);
  } else {
    // bracers: cuffs (cloth, narrow), vambraces (long plates), arm wraps (spiral strip); the default bracer between
    const long = key === 'vambraces', soft = key === 'cuffs' || key === 'armwraps';
    const mat = long ? S.metal : soft ? (key === 'cuffs' ? S.cloth : S.leather) : S.leather;
    for (const [x, sgn] of [[-6, -1], [6, 1]] as const) {
      const h = long ? 26 : 20, w = long ? 9 : 8;
      poly(c, [x - w / 2, -h / 2, x + w / 2, -h / 2 + 1, x + w / 2 + (long ? 1 : 0.5), h / 2, x - w / 2 - (long ? 1 : 0.5), h / 2 + 1], sgn < 0 ? shade(mat, 0.12) : mat, { ow: 2, hl: 0.3 });
      if (key === 'armwraps' && !inSilhouette()) for (let i = 0; i < 6; i++) crease(c, [x - w / 2, -h / 2 + 2 + i * 3.4, x + w / 2, -h / 2 + 4.4 + i * 3.4], 1, shade(mat, 0.35), 0.9);
      band(c, f, [x - w / 2, -h / 2 + 2.4, x + w / 2, -h / 2 + 3.2], 2);
      band(c, f, [x - w / 2 - 0.4, h / 2 - 2, x + w / 2 + 0.4, h / 2 - 1.2], 2);
      if (sgn > 0) badge(c, f, x, 0, 3.2);
    }
  }
  if (f.top) gradeAccent(c, f, 8, -8, 2.8);
  return true;
}

void stitch; void star; void wash;
