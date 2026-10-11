// Graphics quality and comfort settings applied to the running client (docs/rework/partials/SETTINGS.md):
// render resolution, frame-rate caps (foreground / unfocused), effect and ambient density read by the renderer,
// reduce-motion, colour-vision palette and rarity shapes as root attributes for CSS, and the low-spec suggestion.

import type { Application } from 'pixi.js';
import { RARITY_COLORS } from '@shared/items';
import type { Rarity } from '@shared/types';
import { DENSITY_FACTOR, motionReduced, preferences, type ColorVision, type PreferenceStore, type Preferences } from './preferences';

/** Particle budget multiplier for the current effects density (1, 0.5 or 0.2). */
export const effectsFactor = (p: Readonly<Preferences> = preferences.get().values): number => DENSITY_FACTOR[p.effectsDensity];
/** Share of decorative ambient life to show (critters, motes, walkers); 0 when motion is reduced (background movement off). */
export const ambientShare = (p: Readonly<Preferences> = preferences.get().values): number => (motionReduced(p) ? 0 : DENSITY_FACTOR[p.ambientDensity]);
/** Decorative background movement (mist drift, reeds, fireflies) runs only when motion is not reduced. */
export const backgroundMotion = (p: Readonly<Preferences> = preferences.get().values): boolean => !motionReduced(p);

/** Renderer resolution for a preference: automatic = screen density capped at 2 (today's behaviour). */
export function resolutionFor(p: Pick<Preferences, 'renderScale'>, dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1): number {
  return p.renderScale === 0 ? Math.min(2, dpr) : p.renderScale;
}
/** Frame cap: the unfocused cap applies only while the window is visible but not focused. 0 = no cap. */
export function fpsCapFor(p: Pick<Preferences, 'maxFps' | 'backgroundFps'>, focused: boolean): number {
  if (!focused && p.backgroundFps > 0) return p.maxFps > 0 ? Math.min(p.maxFps, p.backgroundFps) : p.backgroundFps;
  return p.maxFps;
}

/** Colour-vision rarity palettes, found by scripts/rarity-palette.mjs (Machado 2009 severity 1.0, OKLab ΔE×100, every
 *  colour ≥ 5:1 on the tooltip ink, normal-vision worst pair ≥ 19). Worst pair under the targeted vision, default → preset:
 *  protan 11.9 → 22.3 · deutan 12.2 → 20.9 · tritan 6.7 → 21.4. Default = the lead's palette in tokens.css. */
export const CVD_PALETTES: Readonly<Record<Exclude<ColorVision, 'default'>, Readonly<Record<'normal' | 'magic' | 'rare' | 'legendary' | 'set', string>>>> = Object.freeze({
  protan: { normal: '#e2f4fe', magic: '#9760fe', rare: '#f4d506', legendary: '#e54f11', set: '#5fb0b5' },
  deutan: { normal: '#f8eefb', magic: '#8b66f7', rare: '#f7c413', legendary: '#e25007', set: '#39c7d1' },
  tritan: { normal: '#fcece3', magic: '#6579f2', rare: '#c6a83c', legendary: '#f1401b', set: '#25e676' },
});
const DEFAULT_RARITY = { ...RARITY_COLORS };
const RARITY_KEYS = ['normal', 'magic', 'rare', 'legendary', 'set'] as const;

/** Rarity colours for world labels, beams, chat and feed (shared RARITY_COLORS) and CSS tokens (--r-*). */
export function applyColorVision(mode: ColorVision, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  const palette = mode === 'default' ? null : CVD_PALETTES[mode];
  for (const k of RARITY_KEYS) (RARITY_COLORS as Record<Rarity, string>)[k] = palette ? palette[k] : DEFAULT_RARITY[k];
  if (!root) return;
  for (const k of RARITY_KEYS) {
    if (palette) root.style.setProperty(`--r-${k}`, palette[k]); else root.style.removeProperty(`--r-${k}`);
  }
  root.dataset.cvd = mode;
}

/** Applies the comfort attributes CSS reads: reduce motion, rarity shapes. */
export function applyRootAttributes(p: Readonly<Preferences>, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  if (!root) return;
  root.dataset.motion = motionReduced(p) ? 'reduced' : 'full';
  root.dataset.rarityShapes = p.rarityShapes ? 'on' : 'off';
}

/** WebGL renderer names of software rasterisers: Chrome uses SwiftShader when the GPU or its driver is blocklisted, Linux
 *  falls back to llvmpipe, Windows to the Basic Render Driver. Every pixel is then drawn by the CPU. */
export function softwareRenderer(name: string): boolean {
  return /swiftshader|llvmpipe|softpipe|basic render driver|software rasterizer/i.test(name);
}
/** First-run graphics default (docs/rework/PERF.md §Low-end defaults): on a software rasteriser the game starts on the
 *  Low preset (measured: the reference fight +33 % fps, from 2.7 to 3.6; render scale 0.75 cuts the drawn pixels by 44 %).
 *  Machines with a real GPU keep High; saved choices are never touched. Returns true when it applied Low. */
export function applyFirstRunGraphics(store: Pick<PreferenceStore, 'firstRun' | 'set'>, rendererName: string): boolean {
  if (!store.firstRun || !softwareRenderer(rendererName)) return false;
  store.set({ graphicsPreset: 'low' });
  return true;
}

/** Low-spec suggestion: after this many consecutive in-game seconds under the threshold, offer the Low preset once. */
export const LOW_FPS = 40, LOW_FPS_SECONDS = 20;
export class LowSpecMonitor {
  private slow = 0;
  private offered = false;
  /** One sample per second; returns true exactly once when the suggestion should be shown. */
  sample(fps: number, inGame: boolean, visible: boolean, p: Readonly<Preferences>): boolean {
    if (!inGame || !visible || this.offered || !p.lowSpecHint || p.graphicsPreset === 'low') { this.slow = 0; return false; }
    // A frame cap below the threshold is the player's own choice, not a slow machine.
    if (p.maxFps > 0 && p.maxFps < LOW_FPS) { this.slow = 0; return false; }
    this.slow = fps > 0 && fps < LOW_FPS ? this.slow + 1 : 0;
    if (this.slow < LOW_FPS_SECONDS) return false;
    this.offered = true;
    return true;
  }
}

/** Keeps the live renderer in line with the preferences. */
export class GraphicsController {
  private focused = typeof document === 'undefined' ? true : document.hasFocus();
  constructor(private app: Application, private onResolution: (resolution: number) => void) {
    const apply = () => this.apply();
    preferences.subscribe(apply);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => { this.focused = true; apply(); });
      window.addEventListener('blur', () => { this.focused = false; apply(); });
      try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', apply); } catch { /* optional */ }
    }
    apply();
  }
  apply(): void {
    const p = preferences.get().values;
    this.app.ticker.maxFPS = fpsCapFor(p, this.focused);
    const res = resolutionFor(p);
    if (Math.abs(this.app.renderer.resolution - res) > 1e-6) {
      this.app.renderer.resize(this.app.screen.width, this.app.screen.height, res);
      this.onResolution(res);
    }
    applyRootAttributes(p);
    applyColorVision(p.colorVision);
  }
}
