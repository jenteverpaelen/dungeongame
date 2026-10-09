export interface Preferences {
  masterVolume: number;
  effectsVolume: number;
  ambienceVolume: number;
  muted: boolean;
  cameraShake: boolean;
  reduceFlashes: boolean;
  lootQualityLabels: boolean;
  combatNumbers: boolean;
  contextualHints: boolean;
  manualSkills: boolean;
}

export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  masterVolume: 0.8, effectsVolume: 1, ambienceVolume: 1, muted: false, cameraShake: true, reduceFlashes: false, lootQualityLabels: false, combatNumbers: true, contextualHints:true, manualSkills:false,
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
