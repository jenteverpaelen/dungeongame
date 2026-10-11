// Item icons: the same vector drawings as the paper doll, posed for an inventory cell (weapons on the
// diagonal, armour as pairs / on a dark mannequin), with a rarity glow behind legendary & set pieces.
// Rendered once per look+size through the main renderer and cached as data URLs / canvas textures.

import { CanvasSource, Container, Graphics, GraphicsContext, Rectangle, Texture } from 'pixi.js';
import type { ItemKind, ItemLook } from '@shared/types';
import { OUT, OW, ball, blob, blobPath, crease, fill, gem, gloss, line, outline, paint, poly, rbox, rivet, spark, star, stitch, wash, type Ctx } from './draw';
import { GOLD } from './palette';
import { light, mix, shade } from './util';
import { getRenderer } from './fx';
import {
  drawAmulet, drawArm, drawBracers, drawHand, drawHead, drawLeg, drawOrb, drawQuiver, drawRing, drawShield, drawShoulder,
  drawTorso, drawWeapon, trim, type Body,
} from './gear';
import { rgba } from './util';
import { GEAR_TIER_COLORS, lookFx } from '@shared/gearVisual';
import { ANCIENT_GOLD, PRIMAL_CORE, PRIMAL_RED, SET_STYLE } from './gearStyle';
import { decorShoulder } from './gearDecor';

const MANNEQUIN: Body = { cls: 'warrior', skin: 0x2b2220, hair: 0, hairStyle: 'none', eyes: 0 };

/** Draw the icon pose of an item into a context (origin roughly at the item's centre). */
function drawIcon(c: Ctx, look: ItemLook, kind: ItemKind): void {
  const shape = look.shape;
  const sub = (fn: (k: Ctx) => void, x: number, y: number, rot = 0, sx = 1, sy = 1) => {
    c.save?.();
    c.translate(x, y); c.rotate(rot); c.scale(sx, sy);
    fn(c);
    c.restore?.();
  };
  switch (kind) {
    case 'head': if (shape === 'circlet') circletIcon(c, look); else drawHead(c, MANNEQUIN, look, true); break;
    case 'shoulders': shoulderIcon(c, look); break;
    case 'chest':
      sub((k) => drawArm(k, MANNEQUIN, look, true), -9.5, -17, 0.5);
      sub((k) => drawArm(k, MANNEQUIN, look, false), 11, -17, -0.5);
      drawTorso(c, MANNEQUIN, look, undefined);
      break;
    case 'hands': gloveIcon(c, look); break;
    case 'legs': legsIcon(c, look); break;
    case 'feet': shoesIcon(c, look); break;
    case 'waist': waistIcon(c, look); break;
    case 'wrists': drawBracers(c, look); break;
    case 'neck': drawAmulet(c, look); break;
    case 'ring': drawRing(c, look); break;
    case 'offhand':
      if (shape === 'quiver') sub((k) => drawQuiver(k, look), 0, 0, 0.5);
      else if (shape === 'orb') drawOrb(c, look);
      else drawShield(c, look);
      break;
    default: // weapons on the diagonal
      sub((k) => drawWeapon(k, look), 0, 0, shape === 'crossbow' || shape === 'handxbow' ? Math.PI / 4 : Math.PI / 4);
  }
}


// ─────────────────────────── dedicated icon poses ───────────────────────────

function gloveIcon(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  const plate = l.shape === 'gauntlets', wraps = l.shape === 'wraps';
  // cuff
  if (plate) poly(c, [-11, 8, 11, 8, 13, 20, -13, 20], s, { hl: 0.35 });
  else if (!wraps) poly(c, [-10, 9, 10, 9, 12, 19, -12, 19], s, { hl: 0.3 });
  // thumb
  blob(c, [-9, 2, -15, -4, -17, -10, -13, -12, -8, -6, -5, -1], plate ? shade(p, 0.08) : p, { hl: 0.2 });
  // fingers
  for (let i = 0; i < 4; i++) {
    const x = -6 + i * 4.6, top = -17 + Math.abs(i - 1.4) * 2.2;
    rbox(c, x - 2.4, top, 4.8, 14, 2.4, plate ? light(p, 0.06) : p, { ow: 2, hl: 0.3 });
    if (plate) { crease(c, [x - 2, top + 5, x + 2, top + 5], 1, OUT, 0.5); crease(c, [x - 2, top + 9, x + 2, top + 9], 1, OUT, 0.5); }
  }
  // back of the hand
  rbox(c, -9, -6, 18, 16, 5, p, { hl: plate ? 0.5 : 0.3 });
  if (plate) { for (let i = 0; i < 4; i++) rivet(c, -6 + i * 4.6, -5, 1); crease(c, [-8, 2, 8, 2], 1.2, OUT, 0.45); }
  if (wraps) { for (const y of [-2, 3, 8]) crease(c, [-9, y + 1, 9, y - 1], 1.6, s, 1); line(c, (k) => k.moveTo(9, 6).quadraticCurveTo(15, 12, 12, 20), 1.6, s, 1.2, false); }
  else stitch(c, [-7, 7, 7, 7], light(p, 0.4), 1.4, 1.2);
  if (l.glow) gem(c, 0, 1, 2.2, light(l.glow, 0.2), 1.1);
}

function shoulderIcon(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  switch (l.shape) {
    case 'plate':
    case 'spiked': {
      if (l.shape === 'spiked') for (const [x, h, a] of [[-8, 11, -0.35], [0, 14, 0], [8, 11, 0.35]] as const) {
        const tx = x + Math.sin(a) * h, ty = -8 - Math.cos(a) * h;
        poly(c, [x - 3, -6, x + 3, -6, tx, ty], light(s, 0.1), { ow: 2 });
      }
      ball(c, 0, 0, 16, 11, p, { hl: 0.55 });
      wash(c, (k) => k.ellipse(0, 6.4, 14, 4.4), s, 1);
      for (let i = -2; i <= 2; i++) rivet(c, i * 5.4, 6.6 - Math.abs(i) * 0.6, 1.1);
      c.ellipse(0, 0, 16, 11); outline(c, OW);
      gloss(c, -5, -5, 6, 2.4, 0.45);
      break;
    }
    case 'mantle': {
      blob(c, [-17, 2, -12, -9, 0, -11, 12, -9, 17, 2, 12, 10, 0, 12, -12, 10], p, { hl: 0.25 });
      blob(c, [-7, -10, 0, -6, 7, -10, 4, -12, -4, -12], shade(p, 0.25), { ow: 1.8 });
      line(c, (k) => k.moveTo(-15, 4).quadraticCurveTo(0, 15, 15, 4), 2, s, 1.4, false);
      star(c, 0, 1, 5, 4, 1.7, light(s, 0.35), 1.2);
      break;
    }
    default: { // pads: stacked leather lames
      for (let i = 2; i >= 0; i--) {
        const y = -6 + i * 7, w = 15 - i * 1.6;
        blob(c, [-w, y + 3, -w * 0.7, y - 4, w * 0.7, y - 4, w, y + 3, w * 0.8, y + 6, -w * 0.8, y + 6], i === 0 ? p : shade(p, i * 0.1), { ow: 2.2, hl: 0.25 });
        crease(c, [-w * 0.8, y + 4.4, w * 0.8, y + 4.4], 1.5, s, 1);
      }
      rivet(c, 0, -5, 1.2, light(s, 0.3));
    }
  }
  if (l.glow) gem(c, 0, l.shape === 'mantle' ? 1 : -2, 2.2, light(l.glow, 0.2), 1.1);
  // the same tier ornaments as on the hero (raised plates, motif spikes, studs, filigree), at icon scale
  c.save?.(); c.translate(-1.1, 1.1); c.scale(1.9, 1.9); decorShoulder(c, l, false); c.restore?.();
}

function legsIcon(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  const pts = [-11, -15, 11, -15, 12, 4, 11, 17, 2.4, 17, 0.6, -1, -0.6, -1, -2.4, 17, -11, 17, -12, 4];
  poly(c, pts, p, { hl: 0.25, px: -0.25 });
  c.rect(-11, -15, 22, 4); fill(c, shade(p, 0.25)); c.rect(-11, -15, 22, 4); outline(c, 1.6);
  if (l.shape === 'plate') {
    for (const x of [-6.4, 6.4]) { ball(c, x, 5, 4.4, 3.6, light(p, 0.15), { ow: 1.8, hl: 0.55 }); c.circle(x, 5, 1.4); fill(c, s); }
    crease(c, [-11, -5, -1, -5], 1, OUT, 0.4); crease(c, [1, -5, 11, -5], 1, OUT, 0.4);
  } else if (l.shape === 'leather') {
    for (const x of [-6.4, 6.4]) ball(c, x, 5, 3.6, 3, s, { ow: 1.6, hl: 0.3 });
    stitch(c, [-9, -9, -8, 14], light(p, 0.4), 1.4, 1.2); stitch(c, [9, -9, 8, 14], light(p, 0.4), 1.4, 1.2);
  } else {
    c.rect(-11, 13, 8.6, 3.4); fill(c, s); c.rect(2.4, 13, 8.6, 3.4); fill(c, s);
    crease(c, [-5, -8, -4, 10], 1, OUT, 0.25); crease(c, [5, -8, 4, 10], 1, OUT, 0.25);
  }
  c.poly(pts, true); outline(c, OW);
  if (l.glow) gem(c, 0, -13, 2, light(l.glow, 0.2), 1);
}

function waistIcon(c: Ctx, l: ItemLook): void {
  const p = l.primary, s = trim(l);
  // belt seen as a loop from slightly above
  line(c, (k) => k.ellipse(0, 0, 16, 7), 5, shade(p, 0.25), OW, false);
  line(c, (k) => k.moveTo(-16, 0).quadraticCurveTo(-16, 7, 0, 7).quadraticCurveTo(16, 7, 16, 0), 5, p, OW);
  if (l.shape === 'sash') {
    blob(c, [2, 6, 6, 8, 9, 22, 4, 22, 3, 12], p, { ow: 2 });
    blob(c, [5, 6, 9, 6, 15, 19, 11, 20], shade(p, 0.15), { ow: 2 });
    ball(c, 4, 6.5, 3.6, 3, s, { ow: 1.8 });
  } else {
    rbox(c, -5, 2.4, 10, 9, 2, s, { ow: 2, hl: 0.5 });
    c.roundRect(-2.4, 4.8, 4.8, 4.2, 1); fill(c, shade(s, 0.5));
    for (const x of [8, 11, 14]) { c.circle(x, 4.6 - (x - 8) * 0.45, 0.8); fill(c, shade(p, 0.5)); }
  }
  if (l.glow) gem(c, l.shape === 'sash' ? 4 : 0, l.shape === 'sash' ? 6.5 : 7, 1.8, light(l.glow, 0.2), 1);
}

function circletIcon(c: Ctx, l: ItemLook): void {
  const s = trim(l);
  line(c, (k) => k.ellipse(0, 0, 15, 6.4), 2.6, shade(GOLD, 0.2), OW, false);
  line(c, (k) => k.moveTo(-15, 0).quadraticCurveTo(-15, 6.4, 0, 6.4).quadraticCurveTo(15, 6.4, 15, 0), 2.6, GOLD, OW);
  for (const x of [-9, 9]) { c.circle(x, 5, 1.6); fill(c, light(GOLD, 0.3)); c.circle(x, 5, 1.6); outline(c, 1); }
  poly(c, [-4, 6, 0, -2, 4, 6], GOLD, { ow: 1.8 });
  gem(c, 0, 3.4, 3.6, l.glow ? light(l.glow, 0.15) : s);
  if (l.variant >= 2) spark(c, 6, -4, 2.6, 0xffffff);
}

function shoesIcon(c: Ctx, l: ItemLook): void {
  // a pair of boots / slippers seen side-on, staggered
  const MAN: Body = { cls: 'mage', skin: 0x2b2220, hair: 0, hairStyle: 'none', eyes: 0 };
  c.save(); c.translate(-6, -3); c.scale(1.5, 1.5); drawLeg(c, MAN, undefined, l, true, 'foot'); c.restore();
  c.save(); c.translate(5, 2); c.scale(1.5, 1.5); drawLeg(c, MAN, undefined, l, false, 'foot'); c.restore();
}


const urlCache = new Map<string, string>();
const texCache = new Map<string, Texture>();

function keyOf(look: ItemLook, kind: ItemKind, size: number): string {
  return `${kind}|${look.shape}|${look.primary}|${look.secondary}|${look.glow}|${look.variant}|${look.fx ?? ''}|${size}`;
}

/** Render an icon to a square canvas, or null when no renderer is available yet. */
function renderIcon(look: ItemLook, kind: ItemKind, size: number): HTMLCanvasElement | null {
  const renderer = getRenderer();
  if (!renderer) return null;
  const ctx = new GraphicsContext();
  drawIcon(ctx, look, kind);
  const g = new Graphics(ctx);
  const b = g.getLocalBounds();
  const bw = Math.max(1, b.maxX - b.minX), bh = Math.max(1, b.maxY - b.minY);
  const inner = size * (kind === 'ring' || kind === 'neck' ? 0.74 : 0.88);
  const k = inner / Math.max(bw, bh);
  const holder = new Container();
  g.scale.set(k);
  g.position.set(size / 2 - (b.minX + bw / 2) * k, size / 2 - (b.minY + bh / 2) * k);
  holder.addChild(g);
  const ss = 2; // supersample, then downscale with smoothing for clean small icons
  const raw = renderer.extract.canvas({ target: holder, frame: new Rectangle(0, 0, size, size), resolution: ss, antialias: true, clearColor: [0, 0, 0, 0] }) as HTMLCanvasElement;
  holder.destroy({ children: true });
  ctx.destroy();
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const c2 = out.getContext('2d')!;
  if (look.glow) {
    const gr = c2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
    gr.addColorStop(0, rgba(look.glow, 0.42)); gr.addColorStop(0.55, rgba(look.glow, 0.16)); gr.addColorStop(1, rgba(look.glow, 0));
    c2.fillStyle = gr;
    c2.fillRect(0, 0, size, size);
  }
  c2.imageSmoothingEnabled = true;
  c2.imageSmoothingQuality = 'high';
  c2.shadowColor = 'rgba(0,0,0,0.55)';
  c2.shadowBlur = size / 22;
  c2.shadowOffsetY = size / 40;
  c2.drawImage(raw, 0, 0, size, size);
  c2.shadowColor = 'transparent';
  tierFrame(c2, look, size);
  return out;
}

/** Tier frame painted into the icon (so every place that shows the icon shows the tier): corner brackets in the tier
 *  metal from Fine up, a Set mark, Ancient / Primal corner jewels and temper stars (docs/rework/gear/DESIGN.md §5). */
function tierFrame(g: CanvasRenderingContext2D, look: ItemLook, size: number): void {
  const fx = lookFx(look);
  if (!fx) return;
  const k = size / 64, T = fx.tier;
  if (T >= 3) {
    const col = fx.ancient === 2 ? PRIMAL_RED : fx.ancient === 1 ? ANCIENT_GOLD : GEAR_TIER_COLORS[T];
    const L = (8 + Math.min(6, T - 3) * 1.6) * k, w = (T >= 7 ? 2.4 : T >= 5 ? 2 : 1.5) * k, m = 2.5 * k;
    g.strokeStyle = rgba(col, T >= 6 ? 1 : 0.85); g.lineWidth = w; g.lineCap = 'round';
    g.shadowColor = T >= 6 ? rgba(col, 0.9) : 'transparent'; g.shadowBlur = T >= 6 ? 4 * k : 0;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [size - m, m, -1, 1], [m, size - m, 1, -1], [size - m, size - m, -1, -1]] as const) {
      g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke();
    }
    g.shadowBlur = 0; g.shadowColor = 'transparent';
    if (T >= 8) {
      for (const [x, y] of [[m + 1.5 * k, m + 1.5 * k], [size - m - 1.5 * k, m + 1.5 * k]] as const) {
        g.fillStyle = rgba(fx.ancient === 2 ? PRIMAL_CORE : 0xfff0c8, 1);
        g.beginPath(); g.moveTo(x, y - 3 * k); g.lineTo(x + 2.2 * k, y); g.lineTo(x, y + 3 * k); g.lineTo(x - 2.2 * k, y); g.closePath(); g.fill();
      }
    }
  }
  if (fx.set && SET_STYLE[fx.set]) {
    // Set mark: a small diamond in the Set's colour (bottom left)
    const x = 7 * k, y = size - 7 * k;
    g.fillStyle = rgba(SET_STYLE[fx.set].main, 1); g.strokeStyle = 'rgba(10,8,6,0.9)'; g.lineWidth = 1.2 * k;
    g.beginPath(); g.moveTo(x, y - 4 * k); g.lineTo(x + 3.4 * k, y); g.lineTo(x, y + 4 * k); g.lineTo(x - 3.4 * k, y); g.closePath(); g.fill(); g.stroke();
  }
  if (fx.temper > 0) {
    // temper stars (bottom right), one per step (+4 / +7 / +10)
    for (let i = 0; i < fx.temper; i++) {
      const cx = size - (7 + i * 9.6) * k, cy = size - 7.5 * k, r = 4.6 * k;
      g.fillStyle = fx.temper >= 3 ? '#fff4c8' : '#ffd65a'; g.strokeStyle = 'rgba(20,12,4,0.95)'; g.lineWidth = 1 * k;
      g.beginPath();
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
    }
  }
}

export function iconUrl(look: ItemLook, kind: ItemKind, size = 64): string {
  const key = keyOf(look, kind, size);
  const hit = urlCache.get(key);
  if (hit) return hit;
  const cv = renderIcon(look, kind, size);
  if (!cv) return '';
  const url = cv.toDataURL('image/png');
  if (urlCache.size > 600) urlCache.clear();
  urlCache.set(key, url);
  return url;
}

export function iconTexture(look: ItemLook, kind: ItemKind): Texture | null {
  const key = keyOf(look, kind, 48);
  let t = texCache.get(key);
  if (t) return t;
  const cv = renderIcon(look, kind, 48);
  if (!cv) return null;
  t = new Texture({ source: new CanvasSource({ resource: cv, resolution: 1, scaleMode: 'linear', autoGenerateMipmaps: true }) });
  if (texCache.size > 300) { for (const v of texCache.values()) v.destroy(true); texCache.clear(); }
  texCache.set(key, t);
  return t;
}
