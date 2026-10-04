// Shared renderer reference + one tiny canvas-baked sheet of soft shapes (shadow, glow, sparkle, rings).
// All views reuse these frames, so they batch together into one texture source.

import { Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';

let rendererRef: Renderer | null = null;

export function setRenderer(r: Renderer): void { rendererRef = r; }
export function getRenderer(): Renderer | null { return rendererRef; }
/** Bake resolution: crisp on HiDPI screens but never huge. */
export function bakeRes(): number { return Math.max(1, Math.min(2, rendererRef?.resolution ?? 1)); }

export interface FxFrames {
  shadow: Texture;   // soft elliptical ground shadow (black, alpha baked)
  glow: Texture;     // round white glow, tint + additive blend it
  glowSoft: Texture; // wider, flatter falloff
  sparkle: Texture;  // 4-point twinkle star (white)
  ring: Texture;     // flat elliptical ring (white) for ground rings
  ringSoft: Texture; // elliptical soft disc with ring edge
  dot: Texture;      // small soft dot
  streak: Texture;   // horizontal motion streak
  smoke: Texture;    // soft smoke puff
}

let frames: FxFrames | null = null;

function radial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

export function fx(): FxFrames {
  if (frames) return frames;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d')!;
  const rects: Record<string, Rectangle> = {};

  // shadow 96x48 at (0,0)
  ctx.save(); ctx.translate(48, 24); ctx.scale(1, 0.5);
  radial(ctx, 0, 0, 46, [[0, 'rgba(10,6,12,0.62)'], [0.55, 'rgba(10,6,12,0.42)'], [0.85, 'rgba(10,6,12,0.12)'], [1, 'rgba(10,6,12,0)']]);
  ctx.restore();
  rects.shadow = new Rectangle(0, 0, 96, 48);

  // glow 128 at (96,0)
  radial(ctx, 96 + 64, 64, 62, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.65)'], [0.55, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
  rects.glow = new Rectangle(96, 0, 128, 128);

  // glowSoft 128 at (224,0)
  radial(ctx, 224 + 64, 64, 62, [[0, 'rgba(255,255,255,0.75)'], [0.4, 'rgba(255,255,255,0.3)'], [0.75, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  rects.glowSoft = new Rectangle(224, 0, 128, 128);

  // sparkle 48 at (352,0)
  ctx.save(); ctx.translate(352 + 24, 24);
  radial(ctx, 0, 0, 22, [[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.quadraticCurveTo(2.2, -2.2, 22, 0); ctx.quadraticCurveTo(2.2, 2.2, 0, 22); ctx.quadraticCurveTo(-2.2, 2.2, -22, 0); ctx.quadraticCurveTo(-2.2, -2.2, 0, -22);
  ctx.fill();
  ctx.restore();
  rects.sparkle = new Rectangle(352, 0, 48, 48);

  // ring 128x64 at (0,128): ellipse ring
  ctx.save(); ctx.translate(64, 128 + 32); ctx.scale(1, 0.5);
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  rects.ring = new Rectangle(0, 128, 128, 64);

  // ringSoft 128x64 at (128,128): soft disc with ring rim
  ctx.save(); ctx.translate(128 + 64, 128 + 32); ctx.scale(1, 0.5);
  radial(ctx, 0, 0, 62, [[0, 'rgba(255,255,255,0.05)'], [0.7, 'rgba(255,255,255,0.22)'], [0.9, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  ctx.restore();
  rects.ringSoft = new Rectangle(128, 128, 128, 64);

  // dot 16 at (400,0)
  radial(ctx, 408, 8, 7.5, [[0, 'rgba(255,255,255,1)'], [0.6, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  rects.dot = new Rectangle(400, 0, 16, 16);

  // streak 96x16 at (256,128)
  ctx.save(); ctx.translate(256 + 48, 128 + 8); ctx.scale(1, 0.18);
  radial(ctx, 0, 0, 46, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
  ctx.restore();
  ctx.save(); ctx.translate(256 + 48, 128 + 8);
  const lg = ctx.createLinearGradient(-48, 0, 48, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 0, 46, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  rects.streak = new Rectangle(256, 128, 96, 16);

  // smoke 64 at (0,192)
  radial(ctx, 32, 192 + 32, 30, [[0, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
  rects.smoke = new Rectangle(0, 192, 64, 64);

  const base = Texture.from(cv);
  const f = (r: Rectangle) => new Texture({ source: base.source, frame: r });
  frames = {
    shadow: f(rects.shadow), glow: f(rects.glow), glowSoft: f(rects.glowSoft), sparkle: f(rects.sparkle),
    ring: f(rects.ring), ringSoft: f(rects.ringSoft), dot: f(rects.dot), streak: f(rects.streak), smoke: f(rects.smoke),
  };
  return frames;
}

// ───────────────────────── sprite factories ─────────────────────────

export function shadowSprite(width: number, alpha = 1): Sprite {
  const s = new Sprite(fx().shadow);
  s.anchor.set(0.5);
  s.width = width; s.height = width * 0.5;
  s.alpha = alpha;
  return s;
}

/** Additive glow blob. size = diameter in world units. */
export function glowSprite(color: number, size: number, alpha = 1, soft = false): Sprite {
  const s = new Sprite(soft ? fx().glowSoft : fx().glow);
  s.anchor.set(0.5);
  s.width = size; s.height = size;
  s.tint = color; s.alpha = alpha;
  s.blendMode = 'add';
  return s;
}

export function sparkleSprite(color: number, size: number, alpha = 1): Sprite {
  const s = new Sprite(fx().sparkle);
  s.anchor.set(0.5);
  s.width = size; s.height = size;
  s.tint = color; s.alpha = alpha;
  s.blendMode = 'add';
  return s;
}

export function ringSprite(color: number, width: number, alpha = 1, soft = false): Sprite {
  const s = new Sprite(soft ? fx().ringSoft : fx().ring);
  s.anchor.set(0.5);
  s.width = width; s.height = width * 0.5;
  s.tint = color; s.alpha = alpha;
  s.blendMode = 'add';
  return s;
}

/** Destroy a container but keep shared textures / contexts alive. */
export function disposeTree(c: Container): void {
  c.destroy({ children: true });
}
