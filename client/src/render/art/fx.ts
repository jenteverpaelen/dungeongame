// Shared renderer reference + one small canvas-baked sheet of soft shapes (shadow, glows, sparkle, rings,
// flame, swoosh arc). Canvas-backed, so the frames work in every Pixi renderer (the class-select previews
// run their own Application) and every view reuses the same texture source.

import { CanvasSource, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';

let rendererRef: Renderer | null = null;

export function setRenderer(r: Renderer): void { rendererRef = r; }
export function getRenderer(): Renderer | null { return rendererRef; }

export interface FxFrames {
  shadow: Texture;   // soft elliptical ground shadow (dark, alpha baked)
  glow: Texture;     // round white glow (tint + additive)
  glowSoft: Texture; // wider, flatter falloff
  sparkle: Texture;  // 4-point twinkle star (white)
  ring: Texture;     // flat elliptical ring (white)
  ringSoft: Texture; // soft elliptical disc with bright rim
  dot: Texture;      // small soft dot
  streak: Texture;   // horizontal motion streak, bright at the right end
  smoke: Texture;    // soft puff
  flame: Texture;    // teardrop flame (white, tint per layer), base at the bottom centre
  swoosh: Texture;   // 120° crescent arc fading towards its tail (weapon trails / whirlwind)
  star5: Texture;    // small 5-point star (stun)
  swirl: Texture;    // 3-arm spiral (white), rotate inside a squashed container for portals / vortices
  rays: Texture;     // soft god-ray fan (white) for shrines
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
  const R: Record<keyof FxFrames, Rectangle> = {} as Record<keyof FxFrames, Rectangle>;

  // shadow 96x48 at (0,0)
  ctx.save(); ctx.translate(48, 24); ctx.scale(1, 0.5);
  radial(ctx, 0, 0, 46, [[0, 'rgba(14,8,14,0.6)'], [0.5, 'rgba(14,8,14,0.46)'], [0.8, 'rgba(14,8,14,0.16)'], [1, 'rgba(14,8,14,0)']]);
  ctx.restore();
  R.shadow = new Rectangle(0, 0, 96, 48);

  // glow 128 at (96,0)
  radial(ctx, 96 + 64, 64, 62, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,0.62)'], [0.55, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
  R.glow = new Rectangle(96, 0, 128, 128);

  // glowSoft 128 at (224,0)
  radial(ctx, 224 + 64, 64, 62, [[0, 'rgba(255,255,255,0.7)'], [0.4, 'rgba(255,255,255,0.3)'], [0.75, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
  R.glowSoft = new Rectangle(224, 0, 128, 128);

  // sparkle 48 at (352,0)
  ctx.save(); ctx.translate(352 + 24, 24);
  radial(ctx, 0, 0, 22, [[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -22); ctx.quadraticCurveTo(2, -2, 22, 0); ctx.quadraticCurveTo(2, 2, 0, 22); ctx.quadraticCurveTo(-2, 2, -22, 0); ctx.quadraticCurveTo(-2, -2, 0, -22);
  ctx.fill();
  ctx.restore();
  R.sparkle = new Rectangle(352, 0, 48, 48);

  // dot 16 at (400,0)
  radial(ctx, 408, 8, 7.5, [[0, 'rgba(255,255,255,1)'], [0.6, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  R.dot = new Rectangle(400, 0, 16, 16);

  // star5 24 at (420,0)
  ctx.save(); ctx.translate(432, 12); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(40,24,10,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.2 : 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  R.star5 = new Rectangle(420, 0, 24, 24);

  // ring 128x64 at (0,128)
  ctx.save(); ctx.translate(64, 128 + 32); ctx.scale(1, 0.5);
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(0, 0, 57, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.arc(0, 0, 53, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  R.ring = new Rectangle(0, 128, 128, 64);

  // ringSoft 128x64 at (128,128)
  ctx.save(); ctx.translate(128 + 64, 128 + 32); ctx.scale(1, 0.5);
  radial(ctx, 0, 0, 62, [[0, 'rgba(255,255,255,0.05)'], [0.7, 'rgba(255,255,255,0.2)'], [0.9, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  ctx.restore();
  R.ringSoft = new Rectangle(128, 128, 128, 64);

  // streak 96x16 at (256,128)
  ctx.save(); ctx.translate(256 + 48, 128 + 8);
  const lg = ctx.createLinearGradient(-48, 0, 48, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.75, 'rgba(255,255,255,0.7)'); lg.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 0, 46, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  R.streak = new Rectangle(256, 128, 96, 16);

  // smoke 64 at (352,128)
  radial(ctx, 352 + 32, 128 + 32, 30, [[0, 'rgba(255,255,255,0.6)'], [0.55, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  R.smoke = new Rectangle(352, 128, 64, 64);

  // flame 64x96 at (0,256): teardrop, base at bottom centre
  ctx.save(); ctx.translate(32, 256 + 92);
  const fg = ctx.createRadialGradient(0, -26, 2, 0, -30, 40);
  fg.addColorStop(0, 'rgba(255,255,255,1)'); fg.addColorStop(0.55, 'rgba(255,255,255,0.92)'); fg.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -88);
  ctx.bezierCurveTo(6, -62, 28, -44, 26, -22);
  ctx.bezierCurveTo(24, -4, 12, 2, 0, 2);
  ctx.bezierCurveTo(-12, 2, -24, -4, -26, -22);
  ctx.bezierCurveTo(-28, -44, -6, -62, 0, -88);
  ctx.fill();
  ctx.restore();
  R.flame = new Rectangle(0, 256, 64, 96);

  // swoosh 128x128 at (64,256): crescent arc from -60° to +60° around (0,64) of the frame, radius 56
  ctx.save(); ctx.translate(64 + 8, 256 + 64);
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    const a0 = -Math.PI / 3 + t * (2 * Math.PI / 3);
    const a1 = a0 + (2 * Math.PI / 3) / 39 + 0.01;
    ctx.strokeStyle = `rgba(255,255,255,${(0.05 + 0.95 * t * t).toFixed(3)})`;
    ctx.lineWidth = 4 + 12 * t;
    ctx.beginPath(); ctx.arc(0, 0, 54 - 4 * t, a0, a1); ctx.stroke();
  }
  ctx.restore();
  R.swoosh = new Rectangle(64, 256, 128, 128);

  // swirl 128 at (192,256): three logarithmic spiral arms
  ctx.save(); ctx.translate(192 + 64, 256 + 64);
  for (let arm = 0; arm < 3; arm++) {
    for (let i = 0; i < 60; i++) {
      const t = i / 59;
      const a = arm * (Math.PI * 2 / 3) + t * 4.2;
      const r = 6 + t * 54;
      ctx.fillStyle = `rgba(255,255,255,${(0.9 * (1 - t) * Math.min(1, t * 6)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2 + t * 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  radial(ctx, 0, 0, 20, [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  ctx.restore();
  R.swirl = new Rectangle(192, 256, 128, 128);

  // rays 128x128 at (320,256): fan of soft rays from the bottom centre
  ctx.save(); ctx.translate(320 + 64, 256 + 124);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.2;
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * 120, Math.sin(a) * 120);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.05) * 120, Math.sin(a - 0.05) * 120); ctx.lineTo(Math.cos(a + 0.05) * 120, Math.sin(a + 0.05) * 120); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  R.rays = new Rectangle(320, 256, 128, 128);

  const source = new CanvasSource({ resource: cv, scaleMode: 'linear' });
  const f = (r: Rectangle) => new Texture({ source, frame: r });
  frames = {
    shadow: f(R.shadow), glow: f(R.glow), glowSoft: f(R.glowSoft), sparkle: f(R.sparkle), ring: f(R.ring),
    ringSoft: f(R.ringSoft), dot: f(R.dot), streak: f(R.streak), smoke: f(R.smoke), flame: f(R.flame),
    swoosh: f(R.swoosh), star5: f(R.star5), swirl: f(R.swirl), rays: f(R.rays),
  };
  return frames;
}

// ───────────────────────── sprite factories ─────────────────────────

export function shadowSprite(width: number, alpha = 1): Sprite {
  const s = new Sprite(fx().shadow);
  s.anchor.set(0.5);
  s.width = width; s.height = width * 0.42;
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

/** Flame sprite anchored at its base. */
export function flameSprite(color: number, h: number, alpha = 1, add = true): Sprite {
  const s = new Sprite(fx().flame);
  s.anchor.set(0.5, 0.96);
  s.height = h; s.width = h * 0.66;
  s.tint = color; s.alpha = alpha;
  if (add) s.blendMode = 'add';
  return s;
}

export function swooshSprite(color: number, radius: number, alpha = 1): Sprite {
  const s = new Sprite(fx().swoosh);
  s.anchor.set(8 / 128, 0.5);
  s.scale.set(radius / 54);
  s.tint = color; s.alpha = alpha;
  s.blendMode = 'add';
  return s;
}
