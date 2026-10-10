// Baked gear ornaments (docs/rework/gear/DESIGN.md §2): overlays drawn on top of the base item drawings, so every
// tier step changes the SILHOUETTE (spikes, plates, crests, crowns, wings, charms) and the FINISH (trims, studs,
// runes, filigree, gems), not just the colour. They are baked into the hero sheet (and icons) like the base art,
// so they cost nothing per frame. Looks without progression (townsfolk) get no ornaments.

import type { ItemLook } from '@shared/types';
import { OUT, OW, ball, blob, crease, fill, gem, line, outline, poly, rbox, rivet, spark, star, inSilhouette, type Ctx } from './draw';
import { itemStyle, motifColor, type ItemStyle, type Motif } from './gearStyle';
import { clamp, light, mix, shade } from './util';

const D2R = Math.PI / 180;
type Pt = { x: number; y: number; d: number };

/** Filigree swirl: a short S curve of emissive metal (Ancient amber / Primal crimson). */
export function filigree(c: Ctx, x: number, y: number, s: number, col: number, flip = 1): void {
  if (inSilhouette()) return;
  c.moveTo(x - 3 * s * flip, y + 1.5 * s).bezierCurveTo(x - 1 * s * flip, y - 2.5 * s, x + 1 * s * flip, y + 2.5 * s, x + 3 * s * flip, y - 1.5 * s);
  c.stroke({ width: 1.1 * s, color: light(col, 0.25), alpha: 0.95, cap: 'round' });
  c.circle(x + 3 * s * flip, y - 1.5 * s, 0.7 * s).fill({ color: light(col, 0.5), alpha: 0.95 });
}

/** One motif ornament pointing up from (x, y) with height h (local "up" = -y). Used on pauldrons, crests, charms. */
export function motifSpike(c: Ctx, m: Motif | null, x: number, y: number, h: number, w: number, s: ItemStyle, lean = 0): void {
  const acc = light(s.accent || s.metal, 0.12), metal = s.metal;
  const tx = x + lean * h, ty = y - h;
  switch (m) {
    case 'wind': { // swept fin, curling backwards
      blob(c, [x - w, y, x - w * 0.2, y - h * 0.4, tx - h * 0.35, ty, x + w * 0.3, y - h * 0.55, x + w, y], light(acc, 0.1), { ow: 1.6, hl: 0.3 });
      crease(c, [x - w * 0.3, y - 1, tx - h * 0.25, ty + h * 0.25], 0.9, light(acc, 0.6), 0.9);
      break;
    }
    case 'star': {
      poly(c, [x - w, y, tx, ty + h * 0.2, x + w, y], shade(s.set?.deep ?? metal, 0.05), { ow: 1.6 });
      star(c, tx, ty + h * 0.15, 5, w * 1.3, w * 0.55, light(acc, 0.35), 1.2);
      break;
    }
    case 'ember': case 'flame': {
      blob(c, [x - w, y, x - w * 0.8, y - h * 0.5, tx, ty, x + w * 0.5, y - h * 0.45, x + w, y], mix(acc, 0xff4a1a, 0.3), { ow: 1.5, hl: 0.35 });
      blob(c, [x - w * 0.45, y, tx - lean * 2, y - h * 0.62, x + w * 0.45, y], light(acc, 0.45), { ow: 0 });
      break;
    }
    case 'stone': {
      poly(c, [x - w * 1.1, y, x - w * 0.7, y - h * 0.6, tx, ty, x + w * 0.9, y - h * 0.45, x + w, y], mix(s.set?.deep ?? 0x6a5a48, 0x8a7a68, 0.5), { ow: 1.7, hl: 0.25 });
      crease(c, [x, y - 1, tx - 1, ty + h * 0.35], 1, light(acc, 0.3), 0.9);
      break;
    }
    case 'feather': {
      blob(c, [x - w * 0.6, y, x - w, y - h * 0.5, tx, ty, x + w, y - h * 0.4, x + w * 0.6, y], light(acc, 0.25), { ow: 1.5, hl: 0.2 });
      crease(c, [x, y, tx, ty + 1], 0.8, shade(acc, 0.35), 0.9);
      for (let i = 1; i < 4; i++) crease(c, [x + (tx - x) * i / 4, y - h * i / 4, x + (tx - x) * i / 4 - w * 0.7, y - h * i / 4 + 2], 0.7, shade(acc, 0.3), 0.6);
      break;
    }
    case 'rain': {
      line(c, (k) => k.moveTo(x, y).lineTo(tx, ty + h * 0.4), 1, light(metal, 0.2), 1, false);
      poly(c, [tx, ty, tx + w * 0.8, ty + h * 0.45, tx, ty + h * 0.62, tx - w * 0.8, ty + h * 0.45], light(acc, 0.3), { ow: 1.3, hl: 0.4 });
      break;
    }
    case 'shard': {
      poly(c, [x - w, y, tx - w * 0.3, ty + h * 0.15, tx, ty, tx + w * 0.4, ty + h * 0.2, x + w, y], light(acc, 0.35), { ow: 1.4, hl: 0.5 });
      crease(c, [x, y, tx, ty + 1], 0.8, 0xffffff, 0.7);
      break;
    }
    case 'lantern': {
      blob(c, [x - w, y, x - w * 0.6, y - h * 0.6, tx, ty, x + w * 0.4, y - h * 0.5, x + w * 0.9, y], 0x5f9a45, { ow: 1.5, hl: 0.25 });
      crease(c, [x, y, tx, ty + 2], 0.8, 0x2f5a25, 0.9);
      ball(c, tx + w * 0.4, ty + h * 0.55, w * 0.55, w * 0.7, 0xffd27a, { ow: 1.2, hl: 0.5 });
      break;
    }
    case 'cog': {
      const r = Math.max(2.2, w * 1.1);
      const cx = x + lean * h * 0.5, cy = y - h * 0.55;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.rect(cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2); }
      fill(c, light(acc, 0.1));
      ball(c, cx, cy, r, r, mix(acc, 0xb08a3a, 0.4), { ow: 1.4, hl: 0.35 });
      c.circle(cx, cy, r * 0.35); fill(c, shade(acc, 0.5));
      break;
    }
    default: { // tiered metal spike with an emissive tip
      poly(c, [x - w, y, tx, ty, x + w, y], light(metal, 0.1), { ow: 1.6, hl: 0.2 });
      if (s.tier >= 7 && !inSilhouette()) { c.moveTo(x, y - 1).lineTo(tx - lean * 1.5, ty + h * 0.3); c.stroke({ width: 1, color: light(acc, 0.5), alpha: 0.9 }); }
    }
  }
}

// ═══════════════════════════════ SHOULDERS ═══════════════════════════════

/** Pauldron overlay (pivot at the shoulder joint, same frame as drawShoulder). */
export function decorShoulder(c: Ctx, l: ItemLook, isBack: boolean): void {
  const s = itemStyle(l);
  if (!s) return;
  const T = s.tier, p = isBack ? shade(l.primary, 0.2) : l.primary;
  if (T >= 5) {
    // a raised top plate widens the silhouette
    blob(c, [-10.5, -2.4, -5.6, -9.4, 5.8, -10, 12, -2.8, 6.4, -5.2, -4.6, -5], light(p, 0.08), { ow: 1.8, hl: 0.35 });
    crease(c, [-8, -4.2, 0, -8, 9, -4.4], 1.2, s.metal, 0.95);
  }
  if (T >= 6) {
    const n = T >= 7 ? 3 : 2, h = 5 + (T - 5) * 2.2, w = 2.3 + (T - 6) * 0.25;
    const xs = n === 3 ? [-5.2, 0.8, 6.8] : [-3, 4.6];
    xs.forEach((x, i) => motifSpike(c, s.motif, x, -6.6 - (i === 1 && n === 3 ? 1.6 : 0), h * (i === 1 && n === 3 ? 1.25 : 1), w, s, (x - 0.8) * 0.06));
  }
  if (T >= 3) {
    crease(c, [-7.8, 3.4, 0.6, 5.6, 8.8, 3.6], 1.6, s.metal, 1);
    if (!isBack) for (const x of T >= 4 ? [-4.6, 0.6, 5.8] : [0.6]) rivet(c, x, 4.1 - Math.abs(x) * 0.08, 0.9, light(s.metal, 0.3));
  }
  if (T >= 7 && !isBack) gem(c, 0.6, -1.2, 2.2, light(s.accent, 0.2), 1.1);
  if (T >= 8 && !isBack) { filigree(c, -4.6, 0.6, 0.9, s.metal); filigree(c, 5.6, 0.6, 0.9, s.metal, -1); }
}

/** How much bigger the pauldrons get (rig scale factor). */
export function shoulderScale(l: ItemLook | undefined): number {
  const T = itemStyle(l)?.tier ?? 0;
  return 1 + 0.035 * Math.max(0, T - 2);
}

// ═══════════════════════════════ HEAD (sphere views) ═══════════════════════════════

type Sph = (lon: number, lat: number, yaw: number, r?: number) => Pt;
type Vec = (fwd: number, up: number, side: number, yaw: number) => Pt;

/** Helm ornaments on the turntable head: crest, crown points, side wings, brow gem. `back` = the pass behind the
 *  skull. Shape-aware: wizard hats get a jewelled band and tip, circlets grow into crowns. */
export function decorHead(c: Ctx, l: ItemLook | undefined, yaw: number, back: boolean, sph: Sph, vec: Vec, R: number): void {
  const s = itemStyle(l);
  if (!s || !l) return;
  const T = s.tier, shape = l.shape;
  const up = vec(0, 1, 0, yaw);
  const top = shape === 'wizard_hat' ? 0 : 1;
  const rr = shape === 'hood' ? R + 3.4 : R + 2.2;
  // side wings / horns (Ancient and Primal)
  if (T >= 8) for (const side of [1, -1]) {
    const base = sph(side * 82 * D2R, 18 * D2R, yaw, rr);
    if ((base.d < -0.05) !== back) continue;
    const out = vec(-0.35, 0, side, yaw);
    const L = T >= 9 ? 17 : 14;
    const tip = { x: base.x + out.x * L * 0.9 + up.x * L * 0.9, y: base.y + out.y * L * 0.9 + up.y * L * 0.9 };
    const mid = { x: base.x + out.x * L * 0.65 + up.x * L * 0.25, y: base.y + out.y * L * 0.65 + up.y * L * 0.25 };
    const col = back ? shade(s.metal, 0.25) : light(s.metal, 0.1);
    blob(c, [base.x, base.y - 3, mid.x, mid.y - 2.4, tip.x, tip.y, mid.x + 1.6, mid.y + 2.6, base.x, base.y + 3], col, { ow: 1.7, hl: 0.35 });
    if (!back) crease(c, [base.x, base.y, mid.x, mid.y, tip.x, tip.y], 0.9, light(s.accent, 0.5), 0.8);
  }
  // crown points ringing the head (Heroic+)
  if (T >= 7 && top && shape !== 'hood') {
    const n = 7, lat = (shape === 'circlet' ? 22 : 40) * D2R;
    for (let i = 0; i < n; i++) {
      const lon = -Math.PI + (i + 0.5) * (Math.PI * 2 / n);
      const b = sph(lon, lat, yaw, rr + 0.4);
      if ((b.d < 0) !== back) continue;
      const front = Math.cos(lon);
      const h = (4 + (T - 7) * 1.6) * (0.75 + 0.35 * Math.max(0, front));
      const w = 1.9;
      const col = back ? shade(s.metal, 0.3) : s.metal;
      poly(c, [b.x - w, b.y, b.x + up.x * h, b.y + up.y * h, b.x + w, b.y], col, { ow: 1.4 });
      if (!back && b.d > 0.4 && T >= 8) c.circle(b.x + up.x * h, b.y + up.y * h, 0.9).fill({ color: light(s.accent, 0.5) });
    }
  }
  if (back) return;
  // crest along the crown (Runic+): motif fin / plume
  if (T >= 5 && top && shape !== 'circlet') {
    const H = 5 + (T - 5) * 2.2;
    const pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) pts.push(sph(Math.PI * (k / 6), (62 + 28 * Math.sin((k / 6) * Math.PI)) * D2R, yaw, rr));
    const vis = pts.filter((q) => q.d > -0.15);
    if (vis.length >= 2) {
      if (s.motif === 'cog') {
        // engineered: one big cog at the temple with a little antenna
        const q = sph(-70 * D2R, 30 * D2R, yaw, rr + 0.5);
        if (q.d > -0.1) { c.save?.(); c.translate(q.x, q.y); motifSpike(c, 'cog', 0, 4, 6 + (T - 5) * 1.2, 2.6 + (T - 5) * 0.3, s, 0); c.restore?.(); }
        const a1 = sph(-20 * D2R, 70 * D2R, yaw, rr);
        if (a1.d > -0.1) { line(c, (k) => k.moveTo(a1.x, a1.y).lineTo(a1.x + up.x * H, a1.y + up.y * H), 1, s.metal, 1, false); c.circle(a1.x + up.x * H, a1.y + up.y * H, 1.6); fill(c, light(s.accent, 0.3)); }
      } else if (s.motif && s.motif !== 'gold' && s.motif !== 'blood' && s.motif !== 'shadow') {
        // a row of motif spikes over the crown, tallest at the top (3 at Runic/Storied, 5 from Heroic)
        const keep = T >= 7 ? [1, 2, 3, 4, 5] : [2, 3, 4];
        const order = keep.filter((k) => pts[k].d > -0.15).sort((a, b) => pts[a].d - pts[b].d);
        for (const k of order) {
          const q = pts[k];
          const h = H * (0.55 + 0.45 * Math.sin((k / 6) * Math.PI));
          c.save?.(); c.translate(q.x, q.y); c.rotate(Math.atan2(up.x, -up.y));
          motifSpike(c, s.motif, 0, 0, h, 2.1, s, -0.1);
          c.restore?.();
        }
      } else {
        const fin: number[] = [];
        for (let k = 0; k <= 6; k++) { const h = H * Math.sin((k / 6) * Math.PI * 0.9 + 0.2); fin.push(pts[k].x + up.x * h, pts[k].y + up.y * h); }
        for (let k = 6; k >= 0; k--) fin.push(pts[k].x, pts[k].y);
        blob(c, fin, light(s.accent || s.metal, 0.05), { hl: 0.3 });
        if (pts[3].d > 0) crease(c, [pts[1].x + up.x * H * 0.4, pts[1].y + up.y * H * 0.4, pts[5].x + up.x * H * 0.4, pts[5].y + up.y * H * 0.4], 1, s.metal, 0.9);
      }
    }
  }
  // wizard hat: jewelled band + tip ornament
  if (shape === 'wizard_hat' && T >= 4) {
    const f = Math.cos(yaw);
    const brim = vec(0, R * 0.62, 0, yaw);
    if (f > -0.2) for (let i = -2; i <= 2; i++) {
      const x = brim.x + Math.sin(yaw) * 6.5 * 0 + i * 4.4 * clamp(Math.abs(f) + 0.2, 0.3, 1), y = brim.y - 3.4;
      if (Math.abs(i) <= (T >= 6 ? 2 : 1)) gem(c, x, y, i === 0 ? 1.9 : 1.3, i === 0 ? light(s.accent, 0.2) : s.metal, 0.9);
    }
  }
  // brow jewel (Masterwork+) on helms, hoods and caps
  if (T >= 4 && (shape === 'helm' || shape === 'helm_horned' || shape === 'hood' || shape === 'cap')) {
    const g = sph(0, (shape === 'cap' ? 22 : 16) * D2R, yaw, rr + 0.3);
    if (g.d > 0.25) gem(c, g.x, g.y, 2 + (T >= 6 ? 0.6 : 0), s.gem ? light(s.gem, 0.15) : light(s.accent || s.metal, 0.15), 1);
  }
  // circlet → diadem → crown
  if (shape === 'circlet' && T >= 5) {
    for (const lon of [-30, 30]) { const q = sph(lon * D2R, 20 * D2R, yaw, R + 2.3); if (q.d > 0.25) gem(c, q.x, q.y, 1.5, s.metal, 0.9); }
  }
  // Ancient / Primal filigree on the dome
  if (T >= 8 && (shape === 'helm' || shape === 'helm_horned')) {
    const q = sph(-28 * D2R, 30 * D2R, yaw, rr), q2 = sph(28 * D2R, 30 * D2R, yaw, rr);
    if (q.d > 0.3) filigree(c, q.x, q.y, 0.85, s.metal);
    if (q2.d > 0.3) filigree(c, q2.x, q2.y, 0.85, s.metal, -1);
  }
}

// ═══════════════════════════════ TORSO / BELT / LEGS / HANDS ═══════════════════════════════

/** Front of the chest: Threadbare patches, gem studs, the emblem medallion, filigree and the amulet pendant. */
export function decorTorsoFront(c: Ctx, chest: ItemLook | undefined, neck: number | undefined, neckColor: number): void {
  const s = itemStyle(chest);
  if (s) {
    const T = s.tier;
    if (T === 0) patch(c, -6.4, -12, 4.6, 4, chest!.primary);
    if (s.fx.gems > 0 && s.gem) for (let i = 0; i < s.fx.gems; i++) gem(c, (i - (s.fx.gems - 1) / 2) * 5, -16.4, 1.5, light(s.gem, 0.1), 0.9);
    if (T >= 6) {
      const col = s.accent || s.metal;
      ball(c, 0, -9.6, 3.6, 3.6, shade(s.set?.deep ?? s.metal, 0.1), { ow: 1.6, hl: 0.3 });
      emblem(c, s.motif, 0, -9.6, 2.6, light(col, 0.25));
      if (T >= 7) { crease(c, [-7, -14.6, -3.4, -11.4], 1.3, s.metal, 1); crease(c, [7, -14.6, 3.4, -11.4], 1.3, s.metal, 1); }
    }
    if (T >= 8) { filigree(c, -5.4, -4.6, 1, s.metal); filigree(c, 5.4, -4.6, 1, s.metal, -1); }
  }
  if (neck !== undefined && neck > 0) {
    // pendant: a chain V and a jewel in the jewellery's colour, larger for higher tiers
    const t = neck & 15;
    if (t >= 2) {
      const r = 1.4 + Math.min(1.6, (t - 2) * 0.25);
      if (!inSilhouette()) { c.moveTo(-4.4, -21.4).quadraticCurveTo(-1.4, -16.6, 0, -15.6 + (t >= 6 ? 0.6 : 0)).quadraticCurveTo(1.4, -16.6, 4.4, -21.4); c.stroke({ width: 0.9, color: 0xe8c66a, alpha: 0.95 }); }
      gem(c, 0, -14.6 + (t >= 6 ? 0.6 : 0), r, light(neckColor, 0.15), 0.9);
    }
  }
}

/** A sewn-on patch (Threadbare gear: the starter rags read as rags). */
export function patch(c: Ctx, x: number, y: number, w: number, h: number, col: number): void {
  c.roundRect(x, y, w, h, 0.6); fill(c, mix(shade(col, 0.15), 0xb89a6a, 0.35));
  if (inSilhouette()) return;
  c.roundRect(x, y, w, h, 0.6); c.stroke({ width: 0.8, color: OUT, alpha: 0.5 });
  for (let i = 0; i < 3; i++) { c.moveTo(x + 0.8 + i * (w - 1.6) / 2, y - 0.5).lineTo(x + 0.8 + i * (w - 1.6) / 2, y + 0.6); }
  c.stroke({ width: 0.6, color: 0xefe2c0, alpha: 0.7 });
}

/** Small motif glyph (chest medallion, shield face, icons). */
export function emblem(c: Ctx, m: Motif | null, x: number, y: number, r: number, col: number): void {
  switch (m) {
    case 'star': star(c, x, y, 5, r, r * 0.45, col, 0.8); break;
    case 'wind': case 'storm': c.moveTo(x - r, y + r * 0.3).quadraticCurveTo(x, y - r * 1.2, x + r, y - r * 0.2).quadraticCurveTo(x - r * 0.1, y - r * 0.2, x - r * 0.4, y + r * 0.6); fill(c, col); break;
    case 'ember': case 'flame': blob(c, [x - r * 0.7, y + r * 0.7, x, y - r * 1.1, x + r * 0.7, y + r * 0.7], col, { ow: 0 }); break;
    case 'stone': poly(c, [x - r, y + r * 0.6, x - r * 0.4, y - r, x + r * 0.8, y - r * 0.5, x + r, y + r * 0.6], col, { ow: 0 }); break;
    case 'feather': blob(c, [x, y + r, x - r * 0.6, y, x, y - r, x + r * 0.5, y], col, { ow: 0 }); break;
    case 'rain': poly(c, [x, y - r, x + r * 0.7, y + r * 0.2, x, y + r * 0.8, x - r * 0.7, y + r * 0.2], col, { ow: 0 }); break;
    case 'shard': poly(c, [x, y - r, x + r * 0.6, y, x, y + r, x - r * 0.6, y], col, { ow: 0 }); break;
    case 'lantern': ball(c, x, y, r * 0.7, r * 0.9, col, { ow: 0.8, hl: 0.4 }); break;
    case 'cog': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.circle(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.3); } fill(c, col); c.circle(x, y, r * 0.55); fill(c, col); break;
    default: spark(c, x, y, r * 1.1, col); break;
  }
}

/** Charms hanging from the belt buckle (Fine+: one, Runic+: two, Heroic+: three with a glowing jewel). */
export function decorBelt(c: Ctx, w: ItemLook, y: number): void {
  const s = itemStyle(w);
  if (!s || s.tier < 3) return;
  const n = s.tier >= 7 ? 3 : s.tier >= 5 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 3.6, len = 5 + (i === (n - 1) / 2 ? 2 : 0) + (s.tier >= 7 ? 1.5 : 0);
    if (!inSilhouette()) { c.moveTo(x, y + 2.6).lineTo(x, y + 2.6 + len); c.stroke({ width: 0.8, color: 0x3a2a1c, alpha: 0.9 }); }
    if (s.tier >= 6 && i === Math.floor(n / 2)) gem(c, x, y + 3.6 + len, 1.7, light(s.accent || s.metal, 0.2), 0.9);
    else emblem(c, s.motif, x, y + 3.4 + len, 1.4, s.metal);
  }
}

/** Leg view ornaments (knee cops, boot cuffs, Threadbare patch). yaw in radians. */
export function decorLeg(c: Ctx, legs: ItemLook | undefined, feet: ItemLook | undefined, sn: number, cs: number): void {
  const ls = itemStyle(legs), fs = itemStyle(feet);
  if (ls) {
    if (ls.tier === 0 && cs > -0.3) patch(c, -2.4 + sn * 0.6, 1.2, 3.4, 3, legs!.primary);
    if (ls.tier >= 6 && cs > -0.3) poly(c, [0.7 * sn - 1.8, 2.6, 0.7 * sn + 2.2 * sn, -0.6, 0.7 * sn + 1.8, 2.6], light(ls.metal, 0.1), { ow: 1.3 });
    if (ls.tier >= 4) crease(c, [-3.4, 8, 3.4, 8], 1.1, ls.metal, 0.9);
  }
  if (fs && fs.tier >= 5) {
    crease(c, [-4.4, 3.1, 4.4, 3.1], 1.3, fs.metal, 1);
    if (fs.tier >= 7 && Math.abs(sn) > 0.3) {
      // a small swept fin at the ankle (profile views)
      const k = Math.sign(sn);
      blob(c, [-1.6 * k, 4.4, -6.4 * k, 1.4, -4.4 * k, 6.6], light(fs.accent || fs.metal, 0.1), { ow: 1.3, hl: 0.3 });
    }
  }
}

/** Glove ornaments: knuckle spikes on armoured hands, a cuff jewel. */
export function decorHand(c: Ctx, hands: ItemLook | undefined): void {
  const s = itemStyle(hands);
  if (!s || s.tier < 5) return;
  if (s.tier >= 6) for (const x of [-2.6, 0, 2.6]) poly(c, [x - 0.9, -2.6, x, -5.8 - (s.tier - 6) * 0.5, x + 0.9, -2.6], light(s.metal, 0.1), { ow: 1.1 });
  gem(c, 0, -4.6, 1.3, light(s.accent || s.metal, 0.2), 0.8);
}

// ═══════════════════════════════ WEAPONS / OFF-HANDS ═══════════════════════════════

/** Weapon embellishments by tier (grip at the origin, business end towards -y; same frame as drawWeapon). */
export function decorWeapon(c: Ctx, l: ItemLook): void {
  const s = itemStyle(l);
  if (!s || s.tier < 4) return;
  const T = s.tier, acc = light(s.accent || s.metal, 0.2), metal = s.metal;
  const runes = (x0: number, y0: number, y1: number) => {
    if (inSilhouette()) return;
    for (let y = y0; y > y1; y -= 4.2) { c.moveTo(x0 - 0.8, y).lineTo(x0 + 0.8, y - 1.6); c.moveTo(x0 + 0.8, y - 2).lineTo(x0 - 0.6, y - 3.2); }
    c.stroke({ width: 0.9, color: light(acc, 0.35), alpha: 0.95, cap: 'round' });
  };
  switch (l.shape) {
    case 'sword': case 'sword2h': {
      const big = l.shape === 'sword2h';
      const gy = big ? -7.4 : -4.7, gw = big ? 10 : 6.4, tipY = big ? -46 : -29;
      if (T >= 5) runes(0, gy - 4, tipY + 8);
      if (T >= 6) for (const k of [1, -1]) blob(c, [k * gw * 0.7, gy - 0.6, k * (gw + 4.4 + (T - 6)), gy - 4.6 - (T - 6), k * (gw + 1.2), gy + 1.8], light(metal, 0.05), { ow: 1.6, hl: 0.35 });
      if (T >= 7) for (const y of big ? [-18, -28] : [-12]) for (const k of [1, -1]) poly(c, [k * (big ? 4 : 3), y, k * (big ? 7 : 5.4), y - 3, k * (big ? 4.1 : 3), y - 5], light(l.primary, 0.1), { ow: 1.3 });
      gem(c, 0, gy, T >= 6 ? 2.2 : 1.7, acc, 1);
      gem(c, 0, big ? 10.4 : 5, T >= 6 ? 1.8 : 1.4, s.gem ? light(s.gem, 0.15) : metal, 0.9);
      if (T >= 8) { filigree(c, -1.4, gy - 8, 0.8, metal); filigree(c, 1.4, gy - 14, 0.8, metal, -1); }
      break;
    }
    case 'axe': case 'axe2h': {
      const big = l.shape === 'axe2h';
      if (T >= 5) runes(big ? 9 : 7, big ? -30 : -17, big ? -42 : -24);
      if (T >= 6) poly(c, big ? [-12.4, -30, -20 - (T - 6) * 1.5, -40, -13.6, -42.6] : [-0.6, -23, -9 - (T - 6), -28, -0.6, -18], light(metal, 0.05), { ow: 1.6, hl: 0.3 });
      if (T >= 7) poly(c, big ? [-1.8, -50, 0, -58 - (T - 7) * 2, 1.8, -50] : [-1.4, -27, 0, -33, 1.4, -27], light(metal, 0.15), { ow: 1.4 });
      gem(c, 0, big ? -36 : -20, T >= 6 ? 2.3 : 1.7, acc, 1);
      if (T >= 8) filigree(c, big ? 8 : 6, big ? -36 : -20, 0.9, metal);
      break;
    }
    case 'mace': {
      if (T >= 6) for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 1.1; poly(c, [Math.cos(a) * 6 - 1.6, -20.6 + Math.sin(a) * 6, Math.cos(a) * (12 + T - 6), -20.6 + Math.sin(a) * (12 + T - 6), Math.cos(a) * 6 + 1.6, -20.6 + Math.sin(a) * 6], light(metal, 0.1), { ow: 1.4 }); }
      gem(c, 0, -20.6, T >= 6 ? 2.6 : 2, acc, 1);
      break;
    }
    case 'staff': {
      if (T >= 5) runes(0, 4, -26);
      if (T >= 6) { line(c, (k) => k.moveTo(-6, -38).quadraticCurveTo(-12 - (T - 6), -48, -4, -58 - (T - 6) * 1.5), 1.8, metal, 1.2); line(c, (k) => k.moveTo(6, -38).quadraticCurveTo(12 + (T - 6), -48, 4, -58 - (T - 6) * 1.5), 1.8, metal, 1.2); }
      if (T >= 7) star(c, 0, -60 - (T - 7) * 1.5, 4, 3, 1.2, acc, 1);
      break;
    }
    case 'wand': {
      if (T >= 6) for (const k of [1, -1]) poly(c, [k * 1.6, -15, k * (5.4 + (T - 6) * 0.6), -21, k * 1.2, -19], light(metal, 0.1), { ow: 1.1 });
      if (T >= 5) runes(0, 2, -10);
      break;
    }
    case 'bow': {
      if (T >= 6) for (const k of [1, -1]) poly(c, [-2.6, k * 19.4, -7.4 - (T - 6), k * (25 + (T - 6) * 1.2), -1, k * 22.6], light(metal, 0.05), { ow: 1.4 });
      gem(c, 2.4, 0, T >= 6 ? 2 : 1.6, acc, 1);
      if (T >= 7) { gem(c, 1.6, -11, 1.2, metal, 0.8); gem(c, 1.6, 11, 1.2, metal, 0.8); }
      break;
    }
    case 'crossbow': case 'handxbow': {
      const k = l.shape === 'crossbow' ? 1 : 0.7;
      if (T >= 6) for (const sd of [1, -1]) poly(c, [sd * 11 * k, -16.6 * k, sd * (15 + T - 6) * k, -21 * k, sd * 9 * k, -18 * k], light(metal, 0.05), { ow: 1.3 });
      gem(c, 0, -6 * k, T >= 6 ? 1.8 : 1.4, acc, 0.9);
      break;
    }
  }
}

/** Shield rim spikes and a jewelled boss. */
export function decorShield(c: Ctx, l: ItemLook): void {
  const s = itemStyle(l);
  if (!s || s.tier < 4) return;
  if (s.tier >= 6) {
    const n = s.tier >= 8 ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * (n === 6 ? 0.55 : 0.75);
      const r0 = 11.4, r1 = 15.6 + (s.tier - 6) * 0.8;
      poly(c, [Math.cos(a - 0.12) * r0, Math.sin(a - 0.12) * r0, Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a + 0.12) * r0, Math.sin(a + 0.12) * r0], light(s.metal, 0.05), { ow: 1.4 });
    }
    emblem(c, s.motif, 0, 4.4, 3, light(s.accent || s.metal, 0.3));
  }
  gem(c, 0, -6, s.tier >= 6 ? 2.6 : 2, light(s.accent || s.metal, 0.2), 1.1);
  if (s.tier >= 8) { filigree(c, -5, 0, 1, s.metal); filigree(c, 5, 0, 1, s.metal, -1); }
}

/** Weapon length factor of the rig (higher tiers carry visibly larger weapons; reach / hitboxes are unchanged). */
export function weaponScale(l: ItemLook | undefined): number {
  const T = itemStyle(l)?.tier ?? 0;
  return 1 + 0.024 * T;
}

// ═══════════════════════════════ BACK PIECES ═══════════════════════════════

/** Cloth back piece seen from behind (pivot at the nape, hangs +y): a short cape (Storied), a long trimmed mantle
 *  (Heroic+). Colours from the chest, trim in tier metal, a motif medallion and an emissive hem on Ancient+. */
export function drawBackPiece(c: Ctx, kind: 'cape' | 'mantle', primary: number, metal: number, accent: number, motif: Motif | null, tier: number, k = 1): void {
  c.save?.(); c.scale(k, k);
  drawBackShape(c, kind, primary, metal, accent, motif, tier);
  c.restore?.();
}

function drawBackShape(c: Ctx, kind: 'cape' | 'mantle', primary: number, metal: number, accent: number, motif: Motif | null, tier: number): void {
  const p = shade(primary, 0.1);
  const L = kind === 'mantle' ? 44 : 33, W = kind === 'mantle' ? 16 : 13.6;
  const pts = [-9, 0, 0, -2, 9, 0, W - 1, L * 0.45, W + 1.2, L * 0.86, W * 0.45, L, 0, L - 3, -W * 0.45, L, -W - 1.2, L * 0.86, -W + 1, L * 0.45];
  blob(c, pts, p, { hl: 0.1, sh: 0.32 });
  crease(c, [-W, L * 0.84, -W * 0.45, L - 1.4, 0, L - 4, W * 0.45, L - 1.4, W, L * 0.84], kind === 'mantle' ? 2.6 : 2, metal, 1);
  crease(c, [-4, 4, -6.4, L - 6], 1, OUT, 0.22); crease(c, [4, 4, 6.4, L - 6], 1, OUT, 0.22); crease(c, [0, 6, 0, L - 6], 1, OUT, 0.16);
  // shoulder clasps
  for (const x of [-8.6, 8.6]) ball(c, x, 0.6, 2.4, 2.4, metal, { ow: 1.3, hl: 0.4 });
  if (kind === 'mantle') {
    ball(c, 0, L * 0.34, 4.2, 4.2, shade(primary, 0.35), { ow: 1.4, hl: 0.2 });
    emblem(c, motif, 0, L * 0.34, 3, light(accent || metal, 0.25));
  }
  if (tier >= 8 && !inSilhouette()) {
    c.moveTo(-W, L * 0.86).quadraticCurveTo(0, L + 1.6, W, L * 0.86);
    c.stroke({ width: 1.2, color: light(metal, 0.4), alpha: 0.9 });
  }
}

/** One wing (attach point at the origin, spreading towards +x and up). Motif-specific silhouettes. */
export function drawWing(c: Ctx, motif: Motif | 'light' | 'primal', main: number, deep: number, k = 1.5): void {
  c.save?.(); c.scale(k, k);
  drawWingShape(c, motif, main, deep);
  c.restore?.();
}

function drawWingShape(c: Ctx, motif: Motif | 'light' | 'primal', main: number, deep: number): void {
  const m = main, d = deep;
  switch (motif) {
    case 'wind': { // three swept gale blades
      for (let i = 2; i >= 0; i--) {
        const k = 1 - i * 0.22;
        blob(c, [0, 2, 10 * k, -6 - i * 4, 30 * k, -22 - i * 6, 40 * k, -30 - i * 4, 26 * k, -14 - i * 5, 12 * k, 2 + i], i === 0 ? light(m, 0.2) : mix(m, d, 0.25 + i * 0.2), { ow: 1.6, hl: 0.3 });
      }
      break;
    }
    case 'star': { // constellation membrane with star nodes
      blob(c, [0, 0, 12, -18, 30, -34, 40, -30, 36, -14, 24, -4, 14, 4], mix(d, m, 0.2), { ow: 1.8, hl: 0.15 });
      const nodes = [[12, -14], [22, -22], [32, -28], [30, -14], [20, -6]];
      if (!inSilhouette()) { c.moveTo(4, -2); for (const [x, y] of nodes) c.lineTo(x, y); c.stroke({ width: 0.9, color: light(m, 0.4), alpha: 0.9 }); }
      for (const [x, y] of nodes) star(c, x, y, 4, 2.6, 0.9, light(m, 0.5));
      break;
    }
    case 'ember': case 'flame': case 'primal': {
      // flame tongues swept out sideways (wide silhouette), the top ones rising
      const col = motif === 'primal' ? 0xff3a2a : m;
      const n = motif === 'primal' ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const a = -0.1 - i * (motif === 'primal' ? 0.24 : 0.28), L = 41 - i * 3.6;
        const tx = Math.cos(a) * L, ty = Math.sin(a) * L - 6;
        blob(c, [0, 0, tx * 0.45 - 3, ty * 0.45, tx, ty, tx * 0.55 + 4, ty * 0.5 + 3], i % 2 ? mix(col, 0xffd27a, 0.3) : col, { ow: 1.5, hl: 0.35 });
      }
      if (motif === 'primal') for (let i = 0; i < 3; i++) blob(c, [2, 0, 12 + i * 6, -10 - i * 6, 18 + i * 6, -16 - i * 7, 10 + i * 4, -4 - i * 2], 0xfff0e0, { ow: 0 });
      break;
    }
    case 'stone': { // floating rock plates in a wing formation (drawn as separate slabs)
      const slabs = [[6, -6, 7], [16, -14, 8], [27, -24, 7], [20, -2, 6], [33, -12, 6]];
      for (const [x, y, r] of slabs) {
        poly(c, [x - r, y + r * 0.4, x - r * 0.4, y - r * 0.8, x + r * 0.9, y - r * 0.5, x + r, y + r * 0.6, x, y + r * 0.9], mix(d, 0x8a7a68, 0.55), { ow: 1.6, hl: 0.25 });
        crease(c, [x - r * 0.4, y, x + r * 0.5, y - r * 0.3], 1, light(m, 0.3), 0.9);
      }
      break;
    }
    case 'feather': {
      for (let i = 0; i < 6; i++) {
        const a = -0.15 - i * 0.24, L = 22 + i * 3.2;
        const tx = Math.cos(a) * L, ty = Math.sin(a) * L;
        blob(c, [0, 0, tx * 0.5 - 1, ty * 0.5 - 3, tx, ty, tx * 0.6 + 2, ty * 0.5 + 2], i % 2 ? light(m, 0.25) : mix(m, d, 0.3), { ow: 1.4, hl: 0.25 });
      }
      blob(c, [0, 2, 10, -8, 16, -6, 10, 4], d, { ow: 1.4 });
      break;
    }
    case 'rain': { // mist wing: soft lobes with hanging drops
      blob(c, [0, 2, 8, -14, 22, -24, 36, -22, 40, -10, 28, -2, 14, 4], mix(m, 0xffffff, 0.25), { ow: 1.4, hl: 0.4 });
      for (const [x, y] of [[14, 6], [24, 2], [33, -4]]) poly(c, [x, y, x + 1.6, y + 3, x, y + 4.4, x - 1.6, y + 3], light(m, 0.4), { ow: 1 });
      break;
    }
    case 'shard': {
      const sh = [[0, 0, 22, -30, 8], [4, 2, 34, -20, 7], [6, 4, 38, -6, 6], [2, -2, 12, -34, 5]];
      for (const [x0, y0, x1, y1, w] of sh) {
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), px = -dy / l * w * 0.5, py = dx / l * w * 0.5;
        poly(c, [x0, y0, x0 + dx * 0.6 + px, y0 + dy * 0.6 + py, x1, y1, x0 + dx * 0.6 - px, y0 + dy * 0.6 - py], light(m, 0.3), { ow: 1.3, hl: 0.5 });
      }
      break;
    }
    case 'lantern': { // two big leaves + a lantern hanging from the tip
      blob(c, [0, 0, 10, -20, 30, -32, 36, -24, 22, -6], 0x5f9a45, { ow: 1.6, hl: 0.25 });
      blob(c, [2, 2, 18, -6, 38, -8, 34, 2, 16, 6], 0x4a7d36, { ow: 1.6, hl: 0.2 });
      crease(c, [2, 0, 30, -28], 0.9, 0x2f5a25, 0.8); crease(c, [4, 2, 34, -4], 0.9, 0x2f5a25, 0.8);
      line(c, (k) => k.moveTo(32, -26).lineTo(36, -18), 0.8, 0x3a2a1c, 0.8, false);
      ball(c, 36.4, -14, 3, 3.8, 0xffd27a, { ow: 1.2, hl: 0.5 });
      break;
    }
    case 'cog': { // siege engine: a brass frame arm carrying cogs and a pennant
      line(c, (k) => k.moveTo(0, 0).lineTo(14, -14).lineTo(30, -20), 3, mix(m, 0x6a4a1a, 0.45), 1.6);
      line(c, (k) => k.moveTo(14, -14).lineTo(18, -32), 2.4, mix(m, 0x6a4a1a, 0.45), 1.4);
      for (const [x, y, r] of [[14, -14, 7], [30, -20, 5], [18, -32, 4.4]] as const) {
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; c.rect(x + Math.cos(a) * r - 1.3, y + Math.sin(a) * r - 1.3, 2.6, 2.6); }
        fill(c, m);
        ball(c, x, y, r, r, mix(m, 0xb08a3a, 0.35), { ow: 1.4, hl: 0.4 });
        c.circle(x, y, r * 0.38); fill(c, shade(d, 0.2));
      }
      poly(c, [18, -32, 34, -38, 30, -30], light(m, 0.15), { ow: 1.3 });
      break;
    }
    default: { // 'light' and legendary motifs: layered feathered energy (three lobes, light inner layer)
      for (let i = 0; i < 3; i++) {
        const k = 1 - i * 0.18, dy = i * 7;
        blob(c, [0, 2, 9 * k, -12 * k + dy, 24 * k, -28 * k + dy, 40 * k, -34 * k + dy * 0.6, 34 * k, -20 * k + dy, 20 * k, -6 + dy * 0.6, 8, 4],
          i === 0 ? mix(m, d, 0.3) : mix(m, d, 0.45 + i * 0.12), { ow: 1.5, hl: 0.2 });
      }
      blob(c, [3, 0, 12, -12, 26, -24, 36, -28, 30, -18, 18, -6], light(m, 0.35), { ow: 0, hl: 0.35 });
    }
  }
}

/** Which back piece a hero wears: from the gear rank and the worn Set (see DESIGN.md §2.3). */
export function backPieceFor(rank: number, topSetCount: number, primals: number): 'none' | 'cape' | 'mantle' | 'wings' {
  if (topSetCount >= 6 || rank >= 8 || primals > 0) return 'wings';
  if (rank >= 7 || topSetCount >= 4) return 'mantle';
  if (rank >= 6) return 'cape';
  return 'none';
}

void outline; void rbox; void OW;
