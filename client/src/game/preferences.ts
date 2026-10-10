export interface Preferences {
  masterVolume: number;
  effectsVolume: number;
  ambienceVolume: number;
  muted: boolean;
  cameraShake: boolean;
  cameraZoom: number;
  reduceFlashes: boolean;
  lootQualityLabels: boolean;
  combatNumbers: boolean;
  contextualHints: boolean;
  manualSkills: boolean;
  /** Gear effects (docs/rework/gear/DESIGN.md §6): your hero, and other heroes. Baked ornaments always show. */
  gearEffects: GearEffects;
  otherGearEffects: GearEffects;
}

export type GearEffects = 'full' | 'reduced' | 'off';
export const GEAR_EFFECT_LEVELS: readonly GearEffects[] = ['full', 'reduced', 'off'];

export const DEFAULT_CAMERA_ZOOM = 0.75;
export const MIN_CAMERA_ZOOM = 2 / 3;
export const MAX_CAMERA_ZOOM = 2;
export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  masterVolume: 0.8, effectsVolume: 1, ambienceVolume: 1, muted: false, cameraShake: true, cameraZoom: DEFAULT_CAMERA_ZOOM, reduceFlashes: false, lootQualityLabels: false, combatNumbers: true, contextualHints:true, manualSkills:false,
  gearEffects: 'full', otherGearEffects: 'full',
});
export const PREFERENCES_KEY = 'hearthfall.preferences.v1';
interface StorageAccess { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface PreferenceState { values: Readonly<Preferences>; retained: boolean }

function normalize(input: Partial<Preferences>): Readonly<Preferences> {
  const value = { ...DEFAULT_PREFERENCES };
  for (const key of ['masterVolume', 'effectsVolume', 'ambienceVolume'] as const) {
    const n = input[key];
    if (typeof n === 'number' && Number.isFinite(n)) value[key] = Math.max(0, Math.min(1, n));
  }
  for (const key of ['muted', 'cameraShake', 'reduceFlashes', 'lootQualityLabels', 'combatNumbers', 'contextualHints', 'manualSkills'] as const) if (typeof input[key] === 'boolean') value[key] = input[key];
  if (typeof input.cameraZoom === 'number' && Number.isFinite(input.cameraZoom)) value.cameraZoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, input.cameraZoom));
  for (const key of ['gearEffects', 'otherGearEffects'] as const) if (GEAR_EFFECT_LEVELS.includes(input[key] as GearEffects)) value[key] = input[key] as GearEffects;
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
    const values = normalize({ ...this.state.values, ...patch });
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

/** Effective gear-effect level for a hero: the player's choice, capped at 'reduced' when the OS asks for less motion. */
export function gearEffectLevel(local: boolean, prefs: Readonly<Preferences> = preferences.get().values, reducedMotion = prefersReducedMotion()): GearEffects {
  const want = local ? prefs.gearEffects : prefs.otherGearEffects;
  return reducedMotion && want === 'full' ? 'reduced' : want;
}
let motionQuery: MediaQueryList | null | undefined;
function prefersReducedMotion(): boolean {
  if (motionQuery === undefined) { try { motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null; } catch { motionQuery = null; } }
  return !!motionQuery?.matches;
}
