// The globes' moving interior drawn into one canvas per globe (docs/rework/PERF.md §4.1): the static glass and tint,
// the liquid (level, bob, two waves, glow, bubbles), the static floor / light / depth shading, and the glass grain with
// its slow swirl. As DOM this was 11 continuously animated compositor layers per globe — Blink re-styles each of them
// every frame — plus soft-light / overlay blend passes over moving content in the GPU process every frame.
//
// It reproduces the DOM version's layer stack and timing exactly: the static SVG layers are the same SVG markup
// rasterised once; moving layers are rasterised once and moved with bilinear filtering, as the compositor moves layers;
// the CSS keyframes, easings and delays are evaluated here; the blend modes are canvas soft-light / overlay, which follow
// the same compositing formulas as CSS mix-blend-mode.

import type { ResourceStyle } from './util';

export const R = 84; // liquid radius inside the 200-unit viewBox
function waveTop(period: number, amp: number, halfPeriods: number): string {
  const h = period / 2;
  let d = `M0 0Q${period / 4} ${-amp} ${h} 0`;
  for (let i = 2; i <= halfPeriods; i++) d += `T${h * i} 0`;
  return d;
}
const WAVE_F = waveTop(100, 9, 8);
const WAVE_B = waveTop(140, 11, 6);
export const BUBBLES: { x: number; y: number; r: number; dur: number; delay: number; rise: number }[] = [
  { x: 62, y: 150, r: 3, dur: 6.5, delay: -1, rise: 46 },
  { x: 88, y: 120, r: 1.6, dur: 5.2, delay: -3.2, rise: 38 },
  { x: 118, y: 160, r: 3.6, dur: 7.8, delay: -5, rise: 58 },
  { x: 140, y: 110, r: 1.5, dur: 4.6, delay: -2, rise: 30 },
  { x: 100, y: 170, r: 2, dur: 8.4, delay: -6.4, rise: 64 },
  { x: 74, y: 96, r: 1.3, dur: 5.8, delay: -0.4, rise: 28 },
  { x: 128, y: 140, r: 1.8, dur: 6.9, delay: -4.2, rise: 44 },
];

// ───────────────────────── CSS timing ─────────────────────────

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of input progress (Newton + bisection, like Blink's solver). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t, sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-7) return sy(t); const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-7) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
/** The swirl turns 13.8° a second; its grain group is re-made every 2° (about 7 times a second). A 2° turn of this soft
 *  conic gradient changes no pixel by more than about one level (its steepest ramp: 0.28 alpha over 70°, at 55 %). */
const GRAIN_STEP = Math.PI / 90;
const EASE_IN = cubicBezier(0.42, 0, 1, 1), EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);
export const LEVEL_EASE = cubicBezier(0.25, 0.85, 0.3, 1);
/** Iteration progress of an infinite CSS animation at time t (s). */
const iter = (t: number, dur: number, delay = 0) => { const a = (t - delay) / dur; return a - Math.floor(a); };

// ───────────────────────── static layers (the DOM version's SVG markup) ─────────────────────────

// viewBox and size are filled in per raster (load): whole device pixels, content at exactly k px per unit
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="__VB__" width="__W__" height="__H__" preserveAspectRatio="none">${body}</svg>`;
function layers(s: ResourceStyle): Record<'glass' | 'waveB' | 'waveF' | 'glow' | 'shade', string> {
  return {
    glass: svg(`<defs><radialGradient id="a" cx="50%" cy="38%" r="66%"><stop offset="0" stop-color="#241619"/><stop offset="0.6" stop-color="#0d0709"/><stop offset="1" stop-color="#030203"/></radialGradient>
      <radialGradient id="b" cx="50%" cy="92%" r="70%"><stop offset="0" stop-color="${s.mid}" stop-opacity=".34"/><stop offset="1" stop-color="${s.mid}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="100" cy="100" r="${R + 2}" fill="url(#a)"/><circle cx="100" cy="100" r="${R + 2}" fill="url(#b)"/>`),
    waveB: svg(`<defs><linearGradient id="c" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="160"><stop offset="0" stop-color="${s.hi}" stop-opacity=".95"/><stop offset="1" stop-color="${s.mid}" stop-opacity=".45"/></linearGradient></defs>
      <path d="${WAVE_B}V300H0Z" fill="url(#c)"/>`),
    waveF: svg(`<defs><linearGradient id="d" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="196"><stop offset="0" stop-color="${s.hi}"/><stop offset="0.05" stop-color="${s.mid}"/><stop offset="0.38" stop-color="${s.mid}"/><stop offset="0.78" stop-color="${s.lo}"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></linearGradient></defs>
      <path d="${WAVE_F}V300H0Z" fill="url(#d)"/><path d="${WAVE_F}" fill="none" stroke="${s.hi}" stroke-width="3" stroke-linecap="round" stroke-opacity=".95"/><path d="${WAVE_F}" fill="none" stroke="#fff" stroke-width=".9" stroke-opacity=".55" transform="translate(0 -1)"/>`),
    glow: svg(`<defs><radialGradient id="e" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${s.hi}" stop-opacity=".5"/><stop offset="0.6" stop-color="${s.hi}" stop-opacity=".12"/><stop offset="1" stop-color="${s.hi}" stop-opacity="0"/></radialGradient>
      <radialGradient id="f" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${s.hi}" stop-opacity=".45"/><stop offset="1" stop-color="${s.hi}" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="100" cy="14" rx="86" ry="22" fill="url(#f)"/><ellipse cx="96" cy="78" rx="74" ry="64" fill="url(#e)"/>`),
    shade: svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
      <linearGradient id="h" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="0.38" stop-color="#fff" stop-opacity="0"/><stop offset="0.72" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
      <radialGradient id="i" cx="50%" cy="46%" r="52%"><stop offset="0.42" stop-color="#000" stop-opacity="0"/><stop offset="0.78" stop-color="#000" stop-opacity=".22"/><stop offset="0.93" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".88"/></radialGradient></defs>
      <rect x="0" y="0" width="200" height="200" fill="url(#g)"/><circle cx="100" cy="100" r="${R + 2}" fill="url(#h)"/><circle cx="100" cy="100" r="${R + 2}" fill="url(#i)"/>`),
  };
}
/** The waves' painted extent (their SVG boxes overflow: crests above y = 0, bodies down to y = 300, 6–8 half periods). */
const WAVE_X0 = 0, WAVE_Y0 = -12, WAVE_W = 432, WAVE_H = 312;
/** The glass grain tile (hud.css --noise): 180 CSS px, white with turbulence alpha. */
const NOISE = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='180' height='180' filter='url(#n)'/></svg>`;
/** The swirl's conic stops (hud.css .globe-grain::after), CSS interpolates them in premultiplied space. */
const SWIRL: [number, number, number][] = [[0, 1, 0], [70, 1, 0.16], [130, 1, 0], [200, 0, 0.28], [260, 1, 0], [320, 1, 0.1], [360, 1, 0]];

/** An SVG layer as an image of whole w × h device pixels showing user space from (x0, y0) at k px per unit. */
function load(markup: string, w: number, h: number, k = 1, x0 = 0, y0 = 0): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup.replace('__VB__', `${x0} ${y0} ${w / k} ${h / k}`).replace('__W__', String(w)).replace('__H__', String(h)));
  });
}
/** A wave layer rasterised on the pixel grid of its SVG box origin (as the compositor rasterises the layer), rows from
 *  floor(WAVE_Y0 · k); drawn at that row offset plus the motion. */
function waveRaster(img: HTMLImageElement): HTMLCanvasElement {
  const [c, g] = bitmap(img.width, img.height);
  g.drawImage(img, 0, 0);
  return c;
}
const waveSize = (k: number) => ({ oy: Math.floor(WAVE_Y0 * k), w: Math.ceil(WAVE_W * k), h: Math.ceil(WAVE_H * k) + 1 });
function bitmap(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')!];
}

interface Raster { size: number; dpr: number; glass: HTMLCanvasElement; glow: HTMLCanvasElement; shade: HTMLCanvasElement; waveB: HTMLCanvasElement; waveF: HTMLCanvasElement; swirl: HTMLCanvasElement; noise: CanvasPattern; bubbles: HTMLCanvasElement[] }

/** One globe's interior. `size` = the globe's CSS size, the canvas covers the globe box. */
export class OrbCanvas {
  private raster: Raster | null = null;
  private building = '';
  private grain: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
  private grainAngle: number | null = null;
  // level (surface y in 200-unit coordinates) and its CSS-like transition
  private yFrom = 0; private yTo = 0; private yStart = -1; private yDur = 0;
  constructor(readonly canvas: HTMLCanvasElement, private style: ResourceStyle) {}

  setStyle(s: ResourceStyle) { if (s !== this.style) { this.style = s; this.raster = null; } }

  /** New target level; transitions like `.liquid { transition: transform 0.7s cubic-bezier(.25,.85,.3,1) }`. */
  setLevel(y: number, now: number, durMs: number) {
    if (this.yStart < 0) { this.yFrom = this.yTo = y; this.yStart = 0; return; }
    if (y === this.yTo) return;
    this.yFrom = this.levelAt(now); this.yTo = y; this.yStart = now; this.yDur = durMs;
  }
  levelAt(now: number): number {
    if (this.yDur <= 0 || now - this.yStart >= this.yDur) return this.yTo;
    return this.yFrom + (this.yTo - this.yFrom) * LEVEL_EASE((now - this.yStart) / this.yDur);
  }
  transitioning(now: number): boolean { return this.yDur > 0 && now - this.yStart < this.yDur; }

  /** (Re)rasterise the static and moving layers for a globe of `size` CSS px at `dpr`. */
  private async build(size: number, dpr: number): Promise<void> {
    const key = size + '@' + dpr; this.building = key;
    const s = this.style, S = size * dpr, k = S / 200;
    const L = layers(s);
    const full = Math.ceil(S), ws = waveSize(k);
    const [glassI, glowI, shadeI, waveBI, waveFI, noiseI] = await Promise.all([
      load(L.glass, full, full, k), load(L.glow, full, full, k), load(L.shade, full, full, k),
      load(L.waveB, ws.w, ws.h, k, WAVE_X0, ws.oy / k), load(L.waveF, ws.w, ws.h, k, WAVE_X0, ws.oy / k),
      load(NOISE.replace("width='180' height='180'>", `width='${180 * dpr}' height='${180 * dpr}' viewBox='0 0 180 180'>`), 180 * dpr, 180 * dpr),
    ]);
    if (key !== this.building) return;
    // the SVG images are whole-pixel sized at exactly k px per unit (load), so they are copied 1:1
    const draw = (img: HTMLImageElement, w: number, h: number) => { const [c, g] = bitmap(w, h); g.drawImage(img, 0, 0, w, h); return c; };
    const sq = (img: HTMLImageElement) => draw(img, full, full);
    // swirl: the conic gradient circle at angle 0 (the compositor rasterises it once and rotates the layer)
    const gs = 0.84 * S, [swirl, sg] = bitmap(gs, gs);
    const cg = sg.createConicGradient(-Math.PI / 2, gs / 2, gs / 2);
    for (let i = 0; i < SWIRL.length - 1; i++) {
      const [a0, c0, o0] = SWIRL[i], [a1, c1, o1] = SWIRL[i + 1];
      for (let j = 0; j < 16; j++) { // premultiplied interpolation, sampled densely
        const f = j / 16, o = o0 + (o1 - o0) * f, pc = c0 * o0 + (c1 * o1 - c0 * o0) * f, c = o > 0 ? Math.round((pc / o) * 255) : 255;
        cg.addColorStop((a0 + (a1 - a0) * f) / 360, `rgba(${c},${c},${c},${o})`);
      }
    }
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = cg; sg.beginPath(); sg.arc(gs / 2, gs / 2, gs / 2, 0, Math.PI * 2); sg.fill();
    const noiseTile = draw(noiseI, 180 * dpr, 180 * dpr);
    const bubbles = BUBBLES.map((b) => {
      const d = (b.r / 100) * S, [c, g] = bitmap(d + 2, d + 2);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(1 + d / 2, 1 + d / 2, d / 2, 0, Math.PI * 2); g.fill();
      return c;
    });
    this.raster = {
      size, dpr, glass: sq(glassI), glow: sq(glowI), shade: sq(shadeI),
      waveB: waveRaster(waveBI), waveF: waveRaster(waveFI),
      swirl, noise: null as unknown as CanvasPattern, bubbles,
    };
    this.grain = bitmap(gs, gs); this.grainAngle = null;
    this.raster.noise = this.grain[1].createPattern(noiseTile, 'repeat')!; // tiles from the grain box origin, like the CSS background
    this.building = '';
  }

  /** Draw the interior at animation time `t` (s) and wall time `now` (ms); `still`: no idle motion (Low, reduce motion). */
  draw(size: number, dpr: number, t: number, now: number, still: boolean): boolean {
    const r = this.raster;
    if (!r || r.size !== size || r.dpr !== dpr) { if (this.building !== size + '@' + dpr) void this.build(size, dpr).catch(() => { this.building = ''; }); if (!r) return false; size = r.size; dpr = r.dpr; }
    const c = this.canvas, S = size * dpr, k = S / 200;
    const W = Math.ceil(S);
    if (c.width !== W || c.height !== W) { c.width = W; c.height = W; }
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, W);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
    g.save();
    g.beginPath(); g.arc(100 * k, 100 * k, R * k, 0, Math.PI * 2); g.clip();
    g.drawImage(r.glass, 0, 0);
    // liquid: level, then the bob (ease-in-out, alternate) carrying the waves, the glow and the bubbles
    const level = this.levelAt(now) * k;
    let bob = 0, wb = 0, wf = 0;
    if (!still) {
      const cyc = (t / 3.6), ip = cyc - Math.floor(cyc), forward = Math.floor(cyc) % 2 === 0;
      bob = (-0.012 + 0.024 * EASE_IN_OUT(forward ? ip : 1 - ip)) * S;
      wb = -0.7 * (1 - iter(t, 7.4)) * S; // reverse
      wf = -0.5 * iter(t, 4.6) * S;
    }
    const y0 = level + bob;
    const wy0 = waveSize(k).oy;
    g.globalAlpha = 0.85; g.drawImage(r.waveB, wb, wy0 + y0);
    g.globalAlpha = 1; g.drawImage(r.waveF, wf, wy0 + y0);
    g.drawImage(r.glow, 0, y0);
    if (!still) BUBBLES.forEach((b, i) => {
      const p = iter(t, b.dur, b.delay);
      const o = p < 0.14 ? 0.7 * EASE_IN(p / 0.14) : p < 0.78 ? 0.7 - 0.25 * EASE_IN((p - 0.14) / 0.64) : 0.45 - 0.45 * EASE_IN((p - 0.78) / 0.22);
      if (o <= 0) return;
      const rise = (-b.rise / 200) * S * EASE_IN(p);
      g.globalAlpha = o;
      g.drawImage(r.bubbles[i], ((b.x - b.r) / 200) * S - 1, ((b.y - b.r) / 200) * S - 1 + y0 + rise);
    });
    g.globalAlpha = 1;
    g.drawImage(r.shade, 0, 0);
    // glass grain: noise with the swirl overlaid (an isolated group), soft-light at 55 % over everything beneath
    const [gc, gg] = this.grain!, gs = gc.width, off = 0.08 * S;
    const ang = still ? 0 : iter(t, 26) * Math.PI * 2;
    if (this.grainAngle === null || Math.abs(ang - this.grainAngle) >= GRAIN_STEP || (ang === 0) !== (this.grainAngle === 0)) {
      this.grainAngle = ang;
      gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'source-over'; gg.clearRect(0, 0, gs, gs);
      gg.save(); gg.beginPath(); gg.arc(0.42 * S, 0.42 * S, 0.42 * S, 0, Math.PI * 2); gg.clip();
      gg.fillStyle = r.noise; gg.fillRect(0, 0, gs, gs);
      gg.globalCompositeOperation = 'overlay';
      gg.translate(0.42 * S, 0.42 * S); gg.rotate(ang); gg.drawImage(r.swirl, -0.42 * S, -0.42 * S);
      gg.restore();
    }
    g.globalAlpha = 0.55; g.globalCompositeOperation = 'soft-light';
    g.drawImage(gc, off, off);
    g.restore();
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return true;
  }
}
