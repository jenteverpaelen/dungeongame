export interface Preferences {
  masterVolume: number;
  effectsVolume: number;
  ambienceVolume: number;
  /** Loot, level-up and other fanfares (the "priority" sounds), separately from combat effects. */
  alertsVolume: number;
  muted: boolean;
  /** Silence the game while its window is not focused. */
  muteInBackground: boolean;
  cameraShake: boolean;
  /** 0..1 strength of camera shake while it is enabled. */
  shakeStrength: number;
  cameraZoom: number;
  /** Interface size multiplier for the HUD, panels and tooltips (accessibility: text is small at 1080p on large displays). */
  uiScale: number;
  reduceFlashes: boolean;
  lootQualityLabels: boolean;
  combatNumbers: boolean;
  /** Floating numbers: size, which kinds are shown. */
  numberSize: NumberSize;
  numbersOthers: boolean;
  numbersTaken: boolean;
  numbersHealing: boolean;
  numbersCritsOnly: boolean;
  contextualHints: boolean;
  manualSkills: boolean;
  /** Gear effects (docs/rework/gear/DESIGN.md §6): your hero, and other heroes. Baked ornaments always show. */
  gearEffects: GearEffects;
  otherGearEffects: GearEffects;
  /** Graphics (docs/rework/partials/SETTINGS.md): a preset plus the values it sets; editing a value makes it "custom". */
  graphicsPreset: GraphicsPreset;
  /** Render resolution: 0 = automatic (screen density, at most 2), otherwise a fixed resolution 0.5–2. */
  renderScale: number;
  effectsDensity: Density;
  ambientDensity: Density;
  /** Applied when the page next loads (the renderer cannot switch it live). */
  antialias: boolean;
  /** Frame-rate caps; 0 = no cap. Background = the window is visible but not focused. */
  maxFps: number;
  backgroundFps: number;
  /** Offer the Low preset when the game measures a low frame rate. */
  lowSpecHint: boolean;
  /** Reduce motion: follow the operating system, always reduce, or never. */
  motion: MotionPref;
  /** Rarity colours tuned for a colour-vision type (measured, scripts/rarity-palette.mjs). */
  colorVision: ColorVision;
  /** A small shape on every item slot (◆ magic, ▲ rare, ★ legendary, ⬢ set) so rarity never relies on colour. */
  rarityShapes: boolean;
  /** Weapon art preview (docs/rework/gear/ART-DIRECTION.md): the current drawings or the new maker series. Local only,
   *  applied when the page loads; `?weaponArt=series|current` overrides it for one page load. */
  weaponArt: WeaponArt;
}

export type GearEffects = 'full' | 'reduced' | 'off';
export type WeaponArt = 'current' | 'series';
export const WEAPON_ART_MODES: readonly WeaponArt[] = ['current', 'series'];
export const GEAR_EFFECT_LEVELS: readonly GearEffects[] = ['full', 'reduced', 'off'];
export type GraphicsPreset = 'low' | 'medium' | 'high' | 'custom';
export type Density = 'full' | 'reduced' | 'minimal';
export const DENSITIES: readonly Density[] = ['full', 'reduced', 'minimal'];
export type MotionPref = 'system' | 'reduce' | 'full';
export const MOTION_PREFS: readonly MotionPref[] = ['system', 'reduce', 'full'];
export type ColorVision = 'default' | 'protan' | 'deutan' | 'tritan';
export const COLOR_VISIONS: readonly ColorVision[] = ['default', 'protan', 'deutan', 'tritan'];
export type NumberSize = 'small' | 'normal' | 'large';
export const NUMBER_SIZES: readonly NumberSize[] = ['small', 'normal', 'large'];
export const FPS_CAPS: readonly number[] = [0, 30, 60, 120, 144];
export const BACKGROUND_FPS: readonly number[] = [0, 5, 15, 30];
export const RENDER_SCALES: readonly number[] = [0, 0.5, 0.75, 1, 1.5, 2];

/** What each preset sets. High is today's look; Medium drops supersampling and halves effect density; Low renders at
 *  three-quarter resolution with minimal particles and ambient life and no antialiasing (measured in SETTINGS.md). */
export const GRAPHICS_PRESETS: Readonly<Record<Exclude<GraphicsPreset, 'custom'>, Pick<Preferences, 'renderScale' | 'effectsDensity' | 'ambientDensity' | 'antialias'>>> = Object.freeze({
  high: { renderScale: 0, effectsDensity: 'full', ambientDensity: 'full', antialias: true },
  medium: { renderScale: 1, effectsDensity: 'reduced', ambientDensity: 'reduced', antialias: true },
  low: { renderScale: 0.75, effectsDensity: 'minimal', ambientDensity: 'minimal', antialias: false },
});
/** Which preset (if any) these values match exactly. */
export function presetOf(p: Pick<Preferences, 'renderScale' | 'effectsDensity' | 'ambientDensity' | 'antialias'>): GraphicsPreset {
  for (const [name, v] of Object.entries(GRAPHICS_PRESETS) as [Exclude<GraphicsPreset, 'custom'>, typeof GRAPHICS_PRESETS.high][])
    if (v.renderScale === p.renderScale && v.effectsDensity === p.effectsDensity && v.ambientDensity === p.ambientDensity && v.antialias === p.antialias) return name;
  return 'custom';
}
/** Particle budget multiplier per density (applied on top of the engine's own crowd budget). */
export const DENSITY_FACTOR: Readonly<Record<Density, number>> = Object.freeze({ full: 1, reduced: 0.5, minimal: 0.2 });

export const DEFAULT_CAMERA_ZOOM = 0.75;
export const MIN_CAMERA_ZOOM = 2 / 3;
export const MAX_CAMERA_ZOOM = 2;
export const DEFAULT_UI_SCALE = 1;
export const MIN_UI_SCALE = 0.85;
export const MAX_UI_SCALE = 1.5;
export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  masterVolume: 0.8, effectsVolume: 1, ambienceVolume: 1, alertsVolume: 1, muted: false, muteInBackground: false,
  cameraShake: true, shakeStrength: 1, cameraZoom: DEFAULT_CAMERA_ZOOM, uiScale: DEFAULT_UI_SCALE, reduceFlashes: false, lootQualityLabels: false,
  combatNumbers: true, numberSize: 'normal', numbersOthers: true, numbersTaken: true, numbersHealing: true, numbersCritsOnly: false,
  contextualHints: true, manualSkills: false,
  gearEffects: 'full', otherGearEffects: 'full',
  graphicsPreset: 'high', ...GRAPHICS_PRESETS.high, maxFps: 0, backgroundFps: 0, lowSpecHint: true,
  motion: 'system', colorVision: 'default', rarityShapes: true, weaponArt: 'current',
});
export const PREFERENCES_KEY = 'hearthfall.preferences.v1';
interface StorageAccess { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface PreferenceState { values: Readonly<Preferences>; retained: boolean }

const BOOLEAN_KEYS = ['muted', 'muteInBackground', 'cameraShake', 'reduceFlashes', 'lootQualityLabels', 'combatNumbers', 'numbersOthers', 'numbersTaken',
  'numbersHealing', 'numbersCritsOnly', 'contextualHints', 'manualSkills', 'antialias', 'lowSpecHint', 'rarityShapes'] as const;
const pick = <T>(v: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(v as T) ? v as T : undefined);

function normalize(input: Partial<Preferences>): Readonly<Preferences> {
  const value: Preferences = { ...DEFAULT_PREFERENCES };
  for (const key of ['masterVolume', 'effectsVolume', 'ambienceVolume', 'alertsVolume', 'shakeStrength'] as const) {
    const n = input[key];
    if (typeof n === 'number' && Number.isFinite(n)) value[key] = Math.max(0, Math.min(1, n));
  }
  for (const key of BOOLEAN_KEYS) if (typeof input[key] === 'boolean') value[key] = input[key];
  if (typeof input.cameraZoom === 'number' && Number.isFinite(input.cameraZoom)) value.cameraZoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, input.cameraZoom));
  if (typeof input.uiScale === 'number' && Number.isFinite(input.uiScale)) value.uiScale = Math.round(Math.max(MIN_UI_SCALE, Math.min(MAX_UI_SCALE, input.uiScale)) * 100) / 100;
  for (const key of ['gearEffects', 'otherGearEffects'] as const) value[key] = pick(input[key], GEAR_EFFECT_LEVELS) ?? value[key];
  for (const key of ['effectsDensity', 'ambientDensity'] as const) value[key] = pick(input[key], DENSITIES) ?? value[key];
  value.renderScale = pick(input.renderScale, RENDER_SCALES) ?? value.renderScale;
  value.maxFps = pick(input.maxFps, FPS_CAPS) ?? value.maxFps;
  value.backgroundFps = pick(input.backgroundFps, BACKGROUND_FPS) ?? value.backgroundFps;
  value.numberSize = pick(input.numberSize, NUMBER_SIZES) ?? value.numberSize;
  value.motion = pick(input.motion, MOTION_PREFS) ?? value.motion;
  value.colorVision = pick(input.colorVision, COLOR_VISIONS) ?? value.colorVision;
  value.weaponArt = pick(input.weaponArt, WEAPON_ART_MODES) ?? value.weaponArt;
  // The preset label always describes the values (a hand-edited value turns it into "custom").
  value.graphicsPreset = presetOf(value);
  return Object.freeze(value);
}

export class PreferenceStore {
  private state: PreferenceState;
  private listeners = new Set<() => void>();
  constructor(private storage?: StorageAccess) {
    let values = DEFAULT_PREFERENCES, retained = !!storage;
    let raw: string | null = null;
    try { raw = storage?.getItem(PREFERENCES_KEY) ?? null; } catch { retained = false; }
    if (raw) try {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && parsed.values && typeof parsed.values === 'object') values = normalize(parsed.values);
    } catch { /* Invalid preferences must not prevent the game from starting. */ }
    this.state = { values, retained };
  }
  get() { return this.state; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  set(patch: Partial<Preferences>) {
    // Choosing a preset applies its values; any other edit keeps the values and recomputes the label.
    const preset = patch.graphicsPreset && patch.graphicsPreset !== 'custom' ? GRAPHICS_PRESETS[patch.graphicsPreset] : {};
    const values = normalize({ ...this.state.values, ...patch, ...preset });
    let retained = false;
    try {
      if (this.storage) { this.storage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, values })); retained = true; }
    } catch { /* Continue with session settings when browser storage is unavailable. */ }
    this.state = { values, retained };
    for (const fn of [...this.listeners]) fn();
  }
  reset() { this.set(DEFAULT_PREFERENCES); }
}

function browserStorage(): StorageAccess | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
export const preferences = new PreferenceStore(browserStorage());

let motionQuery: MediaQueryList | null | undefined;
export function prefersReducedMotion(): boolean {
  if (motionQuery === undefined) { try { motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null; } catch { motionQuery = null; } }
  return !!motionQuery?.matches;
}
/** Effective reduce-motion: the player's choice, or the operating system's when set to follow it. */
export function motionReduced(prefs: Readonly<Preferences> = preferences.get().values, system = prefersReducedMotion()): boolean {
  return prefs.motion === 'reduce' || (prefs.motion === 'system' && system);
}

/** Effective gear-effect level for a hero: the player's choice, capped at 'reduced' when motion is reduced. */
export function gearEffectLevel(local: boolean, prefs: Readonly<Preferences> = preferences.get().values, reducedMotion = motionReduced(prefs)): GearEffects {
  const want = local ? prefs.gearEffects : prefs.otherGearEffects;
  return reducedMotion && want === 'full' ? 'reduced' : want;
}
