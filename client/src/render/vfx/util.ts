// Small shared helpers for the effects module: easing, colour maths, random helpers, element palettes.

export const TAU = Math.PI * 2;

export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export const randInt = (a: number, b: number): number => (a + Math.random() * (b - a + 1)) | 0;
export const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeOut3 = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
export const easeIn = (t: number): number => t * t;
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
export const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Overshooting ease-out ("back"), peaks ~1.1 around t = 0.6. */
export const easeOutBack = (t: number): number => {
  const c = 1.70158, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

/** Shortest signed angle from a to b. */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Deterministic PRNG (mulberry32) for baking textures and per-entity variation. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap integer hash -> [0, 1). */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** 0xRRGGBB -> 0xBBGGRR (the packed order the particle colour attribute wants). */
export const toBgr = (c: number): number => ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
}

export function scaleColor(c: number, k: number): number {
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

export function cssToInt(css: string): number {
  return parseInt(css.replace('#', ''), 16);
}

export function hex(c: number): string {
  return '#' + (c & 0xffffff).toString(16).padStart(6, '0');
}

export interface ElementPalette {
  /** Floating text tint. */
  text: number;
  /** Main effect colour. */
  main: number;
  /** Hot core colour (flashes, centres). */
  hot: number;
  /** Dark / smoke colour. */
  dark: number;
}

/** Indexed by ELEMENT_INDEX: physical, fire, cold, lightning, poison, arcane, holy. */
export const PALETTE: ElementPalette[] = [
  { text: 0xffffff, main: 0xf0e2c4, hot: 0xffffff, dark: 0x6e6256 },
  { text: 0xff8a3d, main: 0xff7a1a, hot: 0xffe08a, dark: 0x3a2a24 },
  { text: 0x7fd3ff, main: 0x7fd8ff, hot: 0xe8fbff, dark: 0x8fb4c6 },
  { text: 0xd6c2ff, main: 0xa98bff, hot: 0xf4f0ff, dark: 0x4b3f6a },
  { text: 0x8fd16a, main: 0x86e04e, hot: 0xe6ffb0, dark: 0x3b5a2a },
  { text: 0xc39bff, main: 0xb070ff, hot: 0xf0d8ff, dark: 0x3a2358 },
  { text: 0xffe9a0, main: 0xffd86a, hot: 0xffffff, dark: 0x8a7440 },
];

export const EL_PHYS = 0, EL_FIRE = 1, EL_COLD = 2, EL_LIGHT = 3, EL_POISON = 4, EL_ARCANE = 5, EL_HOLY = 6;

export function pal(el: number): ElementPalette {
  return PALETTE[el] ?? PALETTE[0];
}
