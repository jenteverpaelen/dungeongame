// Small math / colour helpers shared by every art file.

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t: number) => { t = clamp(t); return 1 - (1 - t) * (1 - t); };
export const easeOut3 = (t: number) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t: number) => { t = clamp(t); return t * t; };
export const easeIn3 = (t: number) => { t = clamp(t); return t * t * t; };
export const easeInOut = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOutBack = (t: number) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/** Exponential smoothing factor that is frame-rate independent. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}
export function fromRgb(r: number, g: number, b: number): number {
  return (Math.round(clamp(r, 0, 255)) << 16) | (Math.round(clamp(g, 0, 255)) << 8) | Math.round(clamp(b, 0, 255));
}
export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a), [br, bg, bb] = rgb(b);
  return fromRgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
/** Warm light: blends towards a creamy white. */
export const light = (c: number, t: number) => mix(c, 0xfff4d6, t);
/** Cool, slightly purple shadow (reads painterly next to the warm lights). */
export const shade = (c: number, t: number) => mix(c, 0x2a1830, t);
export const dark = (c: number, t: number) => mix(c, 0x120c10, t);
export function rgba(c: number, a = 1): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}
export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
/** HSL-ish saturation boost / luminance helper (cheap, good enough for tinting). */
export function luma(c: number): number {
  const [r, g, b] = rgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
export function tintScale(c: number, f: number): number {
  const [r, g, b] = rgb(c);
  return fromRgb(r * f, g * f, b * f);
}

/** Deterministic integer hash -> [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tiny seeded PRNG (mulberry32) returning a function. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Smooth value noise (self-contained so ground baking does not depend on shared internals). */
export function vnoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(seed: number, x: number, y: number, oct = 3): number {
  let amp = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += vnoise(seed + i * 977, x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
